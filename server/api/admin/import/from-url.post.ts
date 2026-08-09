import { requireAuth } from '~~/server/utils/auth'
import { buildDraft } from '~~/server/utils/draftBuilder'
import { parseProductUrl, unsupportedHint } from '~~/server/utils/urlParser'

// Admin import pipeline (ST-017): paste a product URL (Xianyu / 1688 / Taobao
// / TikTok Shop / Amazon / Douyin) -> platform + sourceId are detected, then
// the SAME draft pipeline as a search-result click runs: detail fetch, gallery
// download, price conversion, transport estimate, category suggestion,
// supplier contact pre-fill.
// Body: { url, titleFr?, keyword?, category? }

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

  const draft = await buildDraft({
    platform: parsed.platform,
    sourceId: parsed.sourceId,
    titleFr: String(body?.titleFr || ''),
    keyword: String(body?.keyword || ''),
    category: String(body?.category || ''),
    region: parsed.region,
  })

  return { success: true, source: { platform: parsed.platform, label: parsed.label, sourceId: parsed.sourceId }, draft }
})
