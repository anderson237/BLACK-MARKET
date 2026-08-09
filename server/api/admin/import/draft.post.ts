import { requireAuth } from '~~/server/utils/auth'
import { buildDraft } from '~~/server/utils/draftBuilder'
import type { JoPlatform } from '~~/server/utils/justone'
import { fetchProductDetail } from '~~/server/utils/engine'

// Admin import pipeline (ST-017): draft a single product from any supported
// platform after a search-result click.
// Body: { platform, sourceId, titleFr?, keyword?, category?, region? }
// BL-007 v2 : pour xianyu le moteur suit le toggle admin (headless par défaut,
// fallback JustOneAPI automatique) — même logique que la route from-url.
const VALID_PLATFORMS = new Set<JoPlatform>(['xianyu', '1688', 'taobao', 'tiktok-shop', 'amazon', 'douyin-ec'])

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  if (session.role !== 'admin') throw createError({ statusCode: 403, statusMessage: 'Accès administrateur requis.' })
  const body = await readBody(event)
  const rawPlatform = String(body?.platform || 'xianyu')
  const platform: JoPlatform = VALID_PLATFORMS.has(rawPlatform as JoPlatform) ? (rawPlatform as JoPlatform) : 'xianyu'
  const sourceId = String(body?.sourceId || '').trim()
  if (!sourceId) throw createError({ statusCode: 400, statusMessage: 'Identifiant source manquant.' })
  const region = String(body?.region || '').toUpperCase() === 'FR' ? 'FR' : 'US'

  // BL-007 v2 : consultation du toggle + fallback automatique (engine.ts).
  const { detail, engine } = await fetchProductDetail(platform, sourceId, region)

  const draft = await buildDraft({
    platform,
    sourceId,
    titleFr: String(body?.titleFr || ''),
    keyword: String(body?.keyword || ''),
    category: String(body?.category || ''),
    region,
    moq: Number(body?.moq),
    priceTiers: Array.isArray(body?.priceTiers) && body.priceTiers.length ? body.priceTiers : undefined,
    stock: Number(body?.stock),
    detail,
    detailSource: engine,
  })

  return { success: true, source: { platform, sourceId, engine }, draft }
})
