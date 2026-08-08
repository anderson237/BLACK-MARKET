import { requireAuth } from '~~/server/utils/auth'
import { joDetail, importRemoteImage, priceToXof, type JoPlatform } from '~~/server/utils/justone'
import { findLocalPrice, estimateTransport } from '~~/server/utils/storage'

// Admin import pipeline (ST-017): draft a single product from any supported
// platform.
// Body: { platform, sourceId, titleFr?, keyword?, category?, region? }
// Fetches the full detail, imports the gallery into the project blob, and
// returns a ready-to-edit draft payload that the admin can validate/publish.
const VALID_PLATFORMS = new Set<JoPlatform>(['xianyu', '1688', 'taobao', 'tiktok-shop', 'amazon', 'douyin-ec'])

function sourceUrlFor(platform: JoPlatform, detail: any): string {
  switch (platform) {
    case 'xianyu':
      return `https://www.goofish.com/item?id=${detail.sourceId}`
    case '1688':
      return `https://s.1688.com/selloffer/offer_search.htm?keywords=${encodeURIComponent(detail.title)}`
    case 'taobao':
      return `https://item.taobao.com/item.htm?id=${detail.sourceId}`
    case 'tiktok-shop':
      return `https://shop.tiktok.com/search?productId=${detail.sourceId}`
    case 'amazon':
      return `https://www.amazon.fr/dp/${detail.sourceId}`
    case 'douyin-ec':
      return `https://haohuo.jinritemai.com/views/product/item2?id=${detail.sourceId}`
    default:
      return ''
  }
}

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  if (session.role !== 'admin') throw createError({ statusCode: 403, statusMessage: 'Accès administrateur requis.' })
  const body = await readBody(event)
  const rawPlatform = String(body?.platform || 'xianyu')
  const platform: JoPlatform = VALID_PLATFORMS.has(rawPlatform as JoPlatform) ? (rawPlatform as JoPlatform) : 'xianyu'
  const sourceId = String(body?.sourceId || '').trim()
  if (!sourceId) throw createError({ statusCode: 400, statusMessage: 'Identifiant source manquant.' })
  const titleFr = String(body?.titleFr || '').trim()
  const region = String(body?.region || '').toUpperCase() === 'FR' ? 'FR' : 'US'

  let detail
  try {
    detail = await joDetail(platform, sourceId, region)
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

  const priceXof = priceToXof(detail)

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
      url: sourceUrlFor(platform, detail),
      sourceTitle: detail.title,
      title: titleFr || detail.title, // French translation pre-filled from search when available
      chineseTitle: detail.title,
      chineseDescription: detail.desc,
      description: detail.desc,
      price: detail.price,
      currency: detail.currency,
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
      sales: detail.sales,
      rating: detail.rating,
      ratingCount: detail.ratingCount,
      date: new Date().toISOString(),
    },
  }
})
