import { joDetail, importRemoteImage, priceToXof, type JoPlatform, type JoDetail } from '~~/server/utils/justone'
import { findLocalPrice, estimateTransport, getSupplierContact } from '~~/server/utils/storage'
import { detectCategory } from '~~/server/utils/category'

// ---------------------------------------------------------------------------
// Shared draft builder (ST-017): fetch a product detail from any supported
// platform, download its gallery locally, convert prices to XOF and assemble
// the ready-to-edit draft payload. Used by BOTH the search-result click
// (/api/admin/import/draft) and the paste-a-link flow (/api/admin/import/from-url).
// ---------------------------------------------------------------------------

export interface DraftSource {
  platform: JoPlatform
  sourceId: string
  titleFr?: string
  keyword?: string
  category?: string
  region?: 'US' | 'FR'
  moq?: number
  priceTiers?: any[]
  stock?: number
  /**
   * Détail déjà extrait (BL-007 headless goofish). Quand présent, buildDraft
   * l'utilise TEL QUEL au lieu d'appeler joDetail() → le chemin JustOneAPI
   * (défaut) reste byte-identical. `detail` doit être une JoDetail au format
   * identique au flattener (scraperGoofish.ts le garantit).
   */
  detail?: JoDetail
  /** Moteur ayant produit `detail` — journalisation / réponse API. */
  detailSource?: 'justone' | 'headless'
}

function sourceUrlFor(platform: JoPlatform, sourceId: string): string {
  switch (platform) {
    case 'xianyu':
      return `https://www.goofish.com/item?id=${sourceId}`
    case '1688':
      return `https://detail.1688.com/offer/${sourceId}.html`
    case 'taobao':
      return `https://item.taobao.com/item.htm?id=${sourceId}`
    case 'tiktok-shop':
      return `https://shop.tiktok.com/view/product/${sourceId}`
    case 'amazon':
      return `https://www.amazon.fr/dp/${sourceId}`
    case 'douyin-ec':
      return `https://haohuo.jinritemai.com/views/product/item2?id=${sourceId}`
    default:
      return ''
  }
}

export async function buildDraft(source: DraftSource): Promise<any> {
  const { platform, sourceId } = source
  const titleFr = String(source.titleFr || '').trim()
  const region = source.region || 'US'

  let detail
  if (source.detail) {
    // BL-007 : détail pré-extrait (headless goofish) — pas d'appel JustOneAPI.
    detail = source.detail
  } else {
    try {
      detail = await joDetail(platform, sourceId, region)
    } catch (err: any) {
      // Balance / quota errors surface verbatim so the admin can recharge.
      throw err
    }
  }

  // Download up to 5 pictures locally (degraded: remote URL kept on failure).
  const gallery: string[] = []
  for (let i = 0; i < Math.min(5, detail.images.length); i++) {
    gallery.push(await importRemoteImage(detail.images[i], i))
  }
  const mainImage = gallery[0] || ''

  const priceXof = await priceToXof(detail)

  // Third price: local market approximation (only when a table entry matches).
  const lp = await findLocalPrice(String(titleFr || detail.title || ''), String(source.keyword || ''))

  // Transport estimate (emballage inclus).
  const transport = await estimateTransport(String(source.category || ''))

  // Automatic category suggestion (vitrine filter).
  const suggestedCategory = detectCategory(detail.title, detail.desc)

  // Previously captured supplier contact — pre-fill the draft.
  const sc = await getSupplierContact(platform, sourceId)

  return {
    platform,
    sourceId,
    url: sourceUrlFor(platform, sourceId),
    sourceTitle: detail.title,
    title: titleFr || detail.title,
    chineseTitle: detail.title,
    chineseDescription: detail.desc,
    description: detail.desc,
    price: detail.price,
    currency: detail.currency,
    priceXof,
    localPriceXof: lp ? lp.priceXof : undefined,
    localPriceLabel: lp ? lp.label : undefined,
    transport,
    suggestedCategory,
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
    moq: Number.isFinite(source.moq as any) && (source.moq as any) > 0 ? source.moq : detail.moq || undefined,
    priceTiers: source.priceTiers?.length ? source.priceTiers : detail.priceTiers || undefined,
    stock: Number.isFinite(source.stock as any) && (source.stock as any) > 0 ? source.stock : detail.stock || undefined,
    supplierContact: sc
      ? { wechat: sc.wechat, email: sc.email, whatsapp: sc.whatsapp, phone: sc.phone, website: sc.website, note: sc.note }
      : undefined,
    date: new Date().toISOString(),
  }
}
