import { requireAuth } from '~~/server/utils/auth'
import { buildDraft, type DraftSource } from '~~/server/utils/draftBuilder'
import { parseProductUrl, unsupportedHint } from '~~/server/utils/urlParser'
import { scrapeGoofishDetail } from '~~/server/utils/scraperGoofish'

// Admin import pipeline (ST-017): paste a product URL (Xianyu / 1688 / Taobao
// / TikTok Shop / Amazon / Douyin) -> platform + sourceId are detected, then
// the SAME draft pipeline as a search-result click runs: detail fetch, gallery
// download, price conversion, transport estimate, category suggestion,
// supplier contact pre-fill.
// Body: { url, titleFr?, keyword?, category? }
//
// BL-007 (prototype headless goofish): pour Xianyu on tente d'abord le scraper
// headless gratuit (scraperGoofish.ts, interception de l'API interne MTOP) —
// il fonctionne même quand le solde JustOneAPI est à zéro (code 601). En cas
// d'échec headless, fallback sur JustOneAPI (chemin existant intact). Le champ
// `detail` injecté dans buildDraft est une JoDetail au même format que le
// flattener → UI / pipeline inchangés.

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  if (session.role !== 'admin') throw createError({ statusCode: 403, statusMessage: 'Accès administrateur requis.' })
  const body = await readBody(event)
  const url = String(body?.url || '').trim()
  if (!url) throw createError({ statusCode: 400, statusMessage: 'Collez le lien du produit (Xianyu, 1688, Taobao, TikTok Shop, Amazon ou Douyin).' })

  const parsed = parseProductUrl(url)
  if (!parsed) {
    const hint = unsupportedHint(url)
    throw createError({
      statusCode: 422,
      statusMessage: hint || 'Lien non reconnu. Collez l\'URL d\'une page produit (Xianyu, 1688, Taobao, TikTok Shop, Amazon ou Douyin).',
    })
  }

  const draftSource: DraftSource = {
    platform: parsed.platform,
    sourceId: parsed.sourceId,
    titleFr: String(body?.titleFr || ''),
    keyword: String(body?.keyword || ''),
    category: String(body?.category || ''),
    region: parsed.region,
  }

  // BL-007 : goofish headless d'abord, JustOneAPI en fallback (inchangé).
  let engine: 'justone' | 'headless' = 'justone'
  if (parsed.platform === 'xianyu') {
    try {
      const headlessDetail = await scrapeGoofishDetail(parsed.sourceId)
      draftSource.detail = headlessDetail
      draftSource.detailSource = 'headless'
      engine = 'headless'
      console.log(
        `[from-url] xianyu ${parsed.sourceId} : détail via headless goofish (${headlessDetail.price} CNY, ${headlessDetail.images.length} image(s))`,
      )
    } catch (err: any) {
      console.warn(
        `[from-url] headless goofish indisponible pour ${parsed.sourceId}, fallback JustOneAPI : ${String(err?.message || err).slice(0, 160)}`,
      )
    }
  }

  const draft = await buildDraft(draftSource)

  return {
    success: true,
    source: { platform: parsed.platform, label: parsed.label, sourceId: parsed.sourceId, engine },
    draft,
  }
})
