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

  const key = importHistoryKey(platform, keyword, sort, page, region)

  // 1) Cache hit (and the admin didn't force a fresh fetch) -> return stored
  //    results without spending an API call.
  if (!fresh) {
    const cached = await getImportSearch(key)
    if (cached) {
      // Re-attach local market prices (table may have evolved since cache).
      const withLocal: any[] = []
      for (const item of cached.items) {
        const lp = await findLocalPrice(String(item.titleFr || item.title || ''), keyword)
        withLocal.push({ ...item, localPriceXof: lp ? lp.priceXof : undefined, localPriceLabel: lp ? lp.label : undefined })
      }
      return { success: true, platform, keyword, page, region, cached: true, fromCache: true, items: withLocal }
    }
  }

  // 2) Fresh search: hit the JustOne API. TikTok FR may fall back to US when
  //    the FR collection keeps failing (301 COLLECT FAILED observed).
  let items
  try {
    items = await joSearch(platform, keyword, page, sort, region)
  } catch (err: any) {
    if (platform === 'tiktok-shop' && region === 'FR') {
      console.warn('[import] TikTok FR failed, falling back to US:', err?.statusMessage || err?.message)
      items = await joSearch(platform, keyword, page, sort, 'US')
    } else {
      throw err
    }
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
      priceXof: priceToXof(item),
      localPriceXof: lp ? lp.priceXof : undefined,
      localPriceLabel: lp ? lp.label : undefined,
    })
  }

  // 3) Persist for the history (cache).
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

  return { success: true, platform, keyword, page, region, cached: false, items: out }
})
