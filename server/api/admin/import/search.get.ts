import { requireAuth } from '~~/server/utils/auth'
import { joSearch, priceToXof, type JoPlatform } from '~~/server/utils/justone'
import { getAI, geminiModel, geminiFallbackModel, generateContentWithRetry } from '~~/server/utils/ai'
import {
  getImportSearch,
  upsertImportSearch,
  importHistoryKey,
  findLocalPrice,
} from '~~/server/utils/storage'

// Admin import search (ST-017): query any supported platform by keyword.
// Query: ?platform=xianyu|1688|taobao|tiktok-shop|amazon|douyin-ec
//        &keyword=...&page=...&sort=...&region=US|FR&fresh=1
//
// CACHING — every search (platform|region|keyword|sort|page) is persisted in
// the import history. A repeated search returns the stored results WITHOUT
// hitting the paid Just One API. `fresh=1` forces a new API call (updates the
// cache). Responses carry `cached: true|false` so the UI can offer
// "Nouveautés API".
const VALID_PLATFORMS = new Set<JoPlatform>(['xianyu', '1688', 'taobao', 'tiktok-shop', 'amazon', 'douyin-ec'])

// Accessory markers (coque / film / écran / câble…). On 1688/Taobao/Xianyu the
// default sort is "relevance" which floods product keywords with high-volume
// accessories ("适用于iphone13" phone cases). We reorder — never remove — those
// listings after real products. Skipped when the keyword itself is an accessory
// term (e.g. "coque iphone13"), otherwise every result would be pushed down.
const ACCESSORY_MARKERS =
  /适用于|适用|兼容|compatible|coque|壳|膜|钢化|防摔|防窥|耳机|数据线|充电|贴膜|保护套|保护壳|手机壳|保护膜|屏保|screen\s?protector|\bcase\b|\bcover\b|\bstand\b|\bholder\b|\bbumper\b|\bprotector\b/i

function rankAccessoryItems(items: any[], keyword: string): any[] {
  const kw = String(keyword || '').toLowerCase()
  if (ACCESSORY_MARKERS.test(kw)) return items
  const mains: any[] = []
  const accessories: any[] = []
  for (const it of items) {
    const title = String(it?.title || it?.titleFr || '')
    if (ACCESSORY_MARKERS.test(title)) accessories.push(it)
    else mains.push(it)
  }
  return [...mains, ...accessories]
}

// Platforms whose JustOne API exposes NO sort parameter (TikTok Shop, Douyin,
// 1688). For those the `sort` query is applied client-side on the fetched items
// instead of being forwarded to the API (joSearch ignores it there). Supports
// price asc/desc, best sellers ("produits du moment") and top rating — the
// foundations of a winning-product scan.
const CLIENT_SORT_PLATFORMS = new Set<JoPlatform>(['tiktok-shop', 'douyin-ec', '1688'])

function applyClientSort(items: any[], sort: string): any[] {
  if (!sort) return items
  const list = [...items]
  switch (sort) {
    case 'price_asc':
      return list.sort((a, b) => (a?.price || 0) - (b?.price || 0))
    case 'price_desc':
      return list.sort((a, b) => (b?.price || 0) - (a?.price || 0))
    case 'sales_desc':
      return list.sort((a, b) => (b?.sales || 0) - (a?.sales || 0))
    case 'rating_desc':
      return list.sort((a, b) => (b?.rating || 0) - (a?.rating || 0))
    default:
      return items
  }
}

// Admin-side filters applied on the fetched items (prices in FCFA — the
// converted priceXof; priceSource in the platform source currency ¥/$/€;
// sales / rating are the platform signals; bestSellersOnly keeps items flagged
// is_best_seller by the platform — currently Amazon). Filters run BEFORE the
// limit truncation so "give me 10 with filters" returns 10 filtered products
// when available, and the max available otherwise.
interface SearchFilters {
  priceMin: number
  priceMax: number
  priceSourceMin: number
  priceSourceMax: number
  salesMin: number
  ratingMin: number
  bestSellersOnly: boolean
  limit: number
}

function applyFilters(items: any[], o: SearchFilters): any[] {
  let list = items
  if (o.priceMin) list = list.filter((i) => (i?.priceXof || 0) >= o.priceMin)
  if (o.priceMax) list = list.filter((i) => (i?.priceXof || 0) <= o.priceMax)
  if (o.priceSourceMin) list = list.filter((i) => (i?.price || 0) >= o.priceSourceMin)
  if (o.priceSourceMax) list = list.filter((i) => (i?.price || 0) <= o.priceSourceMax)
  if (o.salesMin) list = list.filter((i) => (i?.sales || 0) >= o.salesMin)
  if (o.ratingMin) list = list.filter((i) => (i?.rating || 0) >= o.ratingMin)
  if (o.bestSellersOnly) list = list.filter((i) => i?.isBestSeller === true)
  return o.limit ? list.slice(0, o.limit) : list
}

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  if (session.role !== 'admin') throw createError({ statusCode: 403, statusMessage: 'Accès administrateur requis.' })
  const q = getQuery(event)
  const rawPlatform = String(q?.platform || 'xianyu')
  const platform: JoPlatform = VALID_PLATFORMS.has(rawPlatform as JoPlatform) ? (rawPlatform as JoPlatform) : 'xianyu'
  const keyword = String(q?.keyword || '').trim()
  if (!keyword) throw createError({ statusCode: 400, statusMessage: 'Mot-clé de recherche manquant.' })
  const page = Math.max(1, Number(q?.page) || 1)
  const sort = String(q?.sort || '')
  const region = String(q?.region || '').toUpperCase() === 'FR' ? 'FR' : 'US'
  const fresh = String(q?.fresh || '') === '1'

  // Result count + filters (admin-controllable). limit=0 means "no cap" (the
  // platform default per page). When filters are active we fetch up to 3× the
  // requested count so the post-filter result can still reach `limit`.
  const limitRaw = Number(q?.limit)
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(100, Math.floor(limitRaw)) : 0
  const priceMin = Number(q?.priceMin) > 0 ? Number(q?.priceMin) : 0
  const priceMax = Number(q?.priceMax) > 0 ? Number(q?.priceMax) : 0
  const priceSourceMin = Number(q?.priceSourceMin) > 0 ? Number(q?.priceSourceMin) : 0
  const priceSourceMax = Number(q?.priceSourceMax) > 0 ? Number(q?.priceSourceMax) : 0
  const salesMin = Number(q?.salesMin) > 0 ? Number(q?.salesMin) : 0
  const ratingMin = Number(q?.ratingMin) > 0 ? Number(q?.ratingMin) : 0
  const bestSellersOnly = String(q?.bestSellersOnly || '') === '1'
  const hasFilters = !!(priceMin || priceMax || priceSourceMin || priceSourceMax || salesMin || ratingMin || bestSellersOnly)
  const filters: SearchFilters = { priceMin, priceMax, priceSourceMin, priceSourceMax, salesMin, ratingMin, bestSellersOnly, limit }
  const fetchLimit = limit ? (hasFilters ? Math.min(100, limit * 3) : limit) : 0
  const need = limit ? (hasFilters ? Math.min(100, limit * 3) : limit) : 0

  const key = importHistoryKey(platform, keyword, sort, page, region)

  // 1) Cache hit (and the admin didn't force a fresh fetch) -> return stored
  //    results without spending an API call. The cache key does NOT include the
  //    filters/limit so a previous larger search (≥ need items) is reused and
  //    filtered locally; otherwise we fall through to a fresh API search.
  if (!fresh) {
    const cached = await getImportSearch(key)
    if (cached && cached.items.length >= need) {
      // Re-attach local market prices (table may have evolved since cache).
      const withLocal: any[] = []
      for (const item of cached.items) {
        const lp = await findLocalPrice(String(item.titleFr || item.title || ''), keyword)
        withLocal.push({ ...item, localPriceXof: lp ? lp.priceXof : undefined, localPriceLabel: lp ? lp.label : undefined })
      }
      return { success: true, platform, keyword, page, region, cached: true, fromCache: true, items: applyFilters(withLocal, filters) }
    }
  }

  // 2) Fresh search: hit the JustOne API. TikTok FR may fall back to US when
  //    the FR collection keeps failing (301 COLLECT FAILED observed).
  let items
  try {
    items = await joSearch(platform, keyword, page, sort, region, fetchLimit)
  } catch (err: any) {
    if (platform === 'tiktok-shop' && region === 'FR') {
      console.warn('[import] TikTok FR failed, falling back to US:', err?.statusMessage || err?.message)
      items = await joSearch(platform, keyword, page, sort, 'US', fetchLimit)
    } else {
      throw err
    }
  }

  // Client-side sort for platforms whose API has no sort parameter
  // (TikTok/Douyin/1688). An explicit client sort wins; otherwise reorder the
  // accessory listings after the real products (1688/taobao/xianyu).
  if (CLIENT_SORT_PLATFORMS.has(platform) && sort) {
    items = applyClientSort(items, sort)
  } else {
    items = rankAccessoryItems(items, keyword)
  }

  // Batch-translate the page titles to French in a single Gemini call
  // (fallback: keep the raw title when the AI is not configured or the
  // translation fails — the search must never fail because of it).
  // Amazon FR titles are already French -> skip the translation entirely.
  const ai = getAI()
  const needsTranslation = !(platform === 'amazon' && region === 'FR')
  const titles = needsTranslation ? items.map((i) => i.title).filter(Boolean) : []
  let frMap: Record<number, string> = {}
  if (ai && titles.length) {
    try {
      const response = await generateContentWithRetry(
        ai,
        {
          model: geminiModel,
          contents: [
            {
              text: `Traduis chaque titre de produit en français (marché africain francophone). Réponds STRICTEMENT en JSON avec un tableau "translations" de la même longueur que la liste d'entrée.\nTitres:\n${titles
                .map((t, i) => `${i + 1}. ${t}`)
                .join('\n')}`,
            },
          ],
          config: {
            systemInstruction: 'Tu traduis des annonces e-commerce (chinoises ou anglaises) en français commercial clair. Garde les marques et chiffres.',
            temperature: 0.2,
            responseMimeType: 'application/json',
          },
        },
        geminiFallbackModel,
      )
      const parsed = JSON.parse(response.text || '{}')
      const translations = Array.isArray(parsed.translations) ? parsed.translations : []
      titles.forEach((_, idx) => {
        const t = String(translations[idx] || '').trim()
        if (t) frMap[idx] = t
      })
    } catch {
      /* translation is best-effort */
    }
  }

  const out = []
  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx]
    const lp = await findLocalPrice(String(frMap[idx] || item.title || ''), keyword)
    out.push({
      ...item,
      titleFr: frMap[idx] || '',
      priceXof: await priceToXof(item),
      localPriceXof: lp ? lp.priceXof : undefined,
      localPriceLabel: lp ? lp.label : undefined,
    })
  }

  // Apply the admin filters (prices FCFA / sales / rating) then the requested
  // result count. The cache stores the FULL unfiltered page(s) so a later
  // search with other filters can reuse it.
  const filtered = applyFilters(out, filters)

  // 3) Persist for the history (cache) — full page, before filters.
  await upsertImportSearch({
    key,
    platform,
    keyword,
    sort,
    page,
    region,
    items: out,
    updatedAt: new Date().toISOString(),
  })

  return { success: true, platform, keyword, page, region, cached: false, items: filtered }
})
