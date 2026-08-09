import { requireAuth } from '~~/server/utils/auth'
import { buildDraft, type DraftSource } from '~~/server/utils/draftBuilder'
import { parseProductUrl, unsupportedHint } from '~~/server/utils/urlParser'
import { fetchProductDetail } from '~~/server/utils/engine'

// Admin import pipeline (ST-017): paste a product URL (Xianyu / 1688 / Taobao
// / TikTok Shop / Amazon / Douyin) -> platform + sourceId are detected, then
// the SAME draft pipeline as a search-result click runs: detail fetch, gallery
// download, price conversion, transport estimate, category suggestion,
// supplier contact pre-fill.
// Body: { url, titleFr?, keyword?, category? }
//
// BL-007 v2 (toggle de source) : le moteur est choisi dans le toggle admin
// (blob bm-sources, server/utils/sources.ts) :
//   - xianyu + toggle 'headless' (défaut) : scraper goofish gratuit (MTOP
//     intercepté) d'abord ; en cas d'échec (timeout / anti-bot / navigateur
//     indisponible) FALLBACK AUTOMATIQUE JustOneAPI.
//   - xianyu + toggle 'justone' : JustOneAPI directement.
//   - autres plateformes : JustOneAPI (le headless n'est testé que pour
//     goofish).
// Le champ `source.engine` retourné reflète le moteur EFFECTIVEMENT utilisé.

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

  // BL-007 v2 : consultation du toggle + fallback automatique (engine.ts).
  const { detail, engine } = await fetchProductDetail(parsed.platform, parsed.sourceId, parsed.region || 'US')
  draftSource.detail = detail
  draftSource.detailSource = engine
  console.log(
    `[from-url] ${parsed.platform} ${parsed.sourceId} : détail via ${engine} (${detail.price} ${detail.currency}, ${detail.images.length} image(s))`,
  )

  const draft = await buildDraft(draftSource)

  return {
    success: true,
    source: { platform: parsed.platform, label: parsed.label, sourceId: parsed.sourceId, engine },
    draft,
  }
})
