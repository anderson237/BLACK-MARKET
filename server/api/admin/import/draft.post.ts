import { requireAuth } from '~~/server/utils/auth'
import { joSearch, joDetail, importRemoteImage, cnyToXof } from '~~/server/utils/justone'
import { findLocalPrice, estimateTransport } from '~~/server/utils/storage'

// Admin import pipeline (ST-017): draft a single product from Xianyu or 1688.
// Body: { platform: 'xianyu'|'1688', sourceId }
// Fetches the full detail, imports the gallery into the project blob, and
// returns a ready-to-edit draft payload that the admin can validate/publish.
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  if (session.role !== 'admin') throw createError({ statusCode: 403, statusMessage: 'Accès administrateur requis.' })
  const body = await readBody(event)
  const platform = body?.platform === '1688' ? '1688' : 'xianyu'
  const sourceId = String(body?.sourceId || '').trim()
  if (!sourceId) throw createError({ statusCode: 400, statusMessage: 'Identifiant source manquant.' })
  const titleFr = String(body?.titleFr || '').trim()

  let detail
  try {
    detail = await joDetail(platform, sourceId)
  } catch (err: any) {
    // Balance / quota errors must surface verbatim to the admin so they can
    // recharge the Just One API account (see utils/justone for the mapping).
    throw err
  }

  // Download up to 5 pictures locally (degraded: remote URL kept when it fails).
  const gallery: string[] = []
  for (let i = 0; i < Math.min(5, detail.images.length); i++) {
    gallery.push(await importRemoteImage(detail.images[i], i))
  }
  const mainImage = gallery[0] || ''

  const priceXof = cnyToXof(detail.priceCny)

  // Third price: local market approximation (only when a table entry matches).
  const lp = await findLocalPrice(String(titleFr || detail.title || ''), String(body?.keyword || ''))

  // Transport estimate (emballage inclus) — category defaults to "Autre" until
  // the admin picks one; the front asks /api/admin/import/transport for rates.
  const transport = await estimateTransport(String(body?.category || ''))

  return {
    success: true,
    draft: {
      platform,
      sourceId,
      url: detail.extra?.item
        ? `https://www.goofish.com/item?id=${detail.sourceId}`
        : `https://s.1688.com/selloffer/offer_search.htm?keywords=${encodeURIComponent(detail.title)}`,
      sourceTitle: detail.title,
      title: titleFr || detail.title, // French translation pre-filled from search when available
      chineseTitle: detail.title,
      chineseDescription: detail.desc,
      description: detail.desc,
      priceCny: detail.priceCny,
      priceXof,
      localPriceXof: lp ? lp.priceXof : undefined,
      localPriceLabel: lp ? lp.label : undefined,
      transport,
      imageUrl: mainImage,
      gallery,
      condition: detail.condition || undefined,
      features: detail.features || [],
      seller: detail.seller || undefined,
      metrics: {
        wantCnt: detail.wantCnt,
        browseCnt: detail.browseCnt,
        favorCnt: detail.favorCnt,
      },
      date: new Date().toISOString(),
    },
  }
})