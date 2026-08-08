import { requireAuth } from '~~/server/utils/auth'
import { joSearch, cnyToXof } from '~~/server/utils/justone'
import { getAI, geminiModel, geminiFallbackModel, generateContentWithRetry } from '~~/server/utils/ai'
import {
  getImportSearch,
  upsertImportSearch,
  importHistoryKey,
  findLocalPrice,
} from '~~/server/utils/storage'

// Admin import search (ST-017): query Xianyu or 1688 by keyword.
// Query: ?platform=xianyu|1688&keyword=...&page=...&sort=...&fresh=1
//
// CACHING — every search (platform|keyword|sort|page) is persisted in the
// import history. A repeated search returns the stored results WITHOUT hitting
// the paid JustOne API. `fresh=1` forces a new API call (updates the cache).
// Responses carry `cached: true|false` so the UI can offer "Nouveautés API".
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  if (session.role !== 'admin') throw createError({ statusCode: 403, statusMessage: 'Accès administrateur requis.' })
  const q = getQuery(event)
  const platform = String(q?.platform || 'xianyu') === '1688' ? '1688' : 'xianyu'
  const keyword = String(q?.keyword || '').trim()
  if (!keyword) throw createError({ statusCode: 400, statusMessage: 'Mot-clé de recherche manquant.' })
  const page = Math.max(1, Number(q?.page) || 1)
  const sort = String(q?.sort || 'active')
  const fresh = String(q?.fresh || '') === '1'

  const key = importHistoryKey(platform, keyword, sort, page)

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
      return { success: true, platform, keyword, page, cached: true, fromCache: true, items: withLocal }
    }
  }

  // 2) Fresh search: hit the JustOne API.
  const items = await joSearch(platform, keyword, page, sort)

  // Batch-translate the page titles to French in a single Gemini call
  // (fallback: keep the raw Chinese title when the AI is not configured or
  // the translation fails — the search must never fail because of it).
  const ai = getAI()
  const titles = items.map((i) => i.title).filter(Boolean)
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
            systemInstruction: 'Tu traduis des annonces chinoises (Xianyu/1688) en français commercial clair. Garde les marques et chiffres.',
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
      priceXof: cnyToXof(item.priceCny || 0),
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
    items: out,
    updatedAt: new Date().toISOString(),
  })

  return { success: true, platform, keyword, page, cached: false, items: out }
})
