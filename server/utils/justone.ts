// ---------------------------------------------------------------------------
// Just One API client (server-only) — multi-platform import pipeline (ST-017).
//
// Docs: https://docs.justoneapi.com/en/api/...
//   - xianyu-goofish: product-search-v1 + product-details-v1
//   - 1688:          search-item-list + get-item-detail
//   - tiktok-shop:   search-products-v1 + get-product-detail-v1
//   - amazon:        product-search-v1 (+ product-details-v1, best-sellers)
//   - douyin-ec:     product-search-v1 (+ item-details-v2)
//   - taobao:        product-search-v1 (+ get-item-detail-v1|v3|v4|v5|v6|v9)
//
// Endpoints used (all GET, auth via ?token=):
//   - Xianyu search:  /api/xianyu/search-item-list/v1?keyword=&page=&sort=
//   - Xianyu detail:  /api/xianyu/get-item-detail/v1?itemId=
//   - 1688 search:    /api/1688/search-item-list/v1?keyword=&page=
//   - 1688 detail:    /api/1688/get-item-detail/v1?itemId=
//   - TikTok search:  /api/tiktok-shop/search-products/v1?keyword=&region=&offset=
//   - TikTok detail:  /api/tiktok-shop/get-product-detail/v1?productId=&region=
//   - Amazon search:  /api/amazon/search-products/v1?keyword=&country=&sortBy=&page=
//   - Amazon detail:  /api/amazon/get-product-detail/v1?asin=&country=   (V1)
//   - Douyin search:  /api/douyin-ec/search-item-list/v1?keyword=&page=&searchId=
//   - Douyin detail:  /api/douyin-ec/item-details/v2?productId=
//   - Taobao search:  /api/taobao/search-item-list/v1?keyword=&sort=&tmall=&page=
//   - Taobao detail:  /api/taobao/get-item-detail/v1?itemId=
//
// Business codes: 0 = success, 100 = invalid token, 301 = collection failed
// (transient — RETRY), 302 = rate limit (RETRY after short backoff), 303 =
// daily quota, 400 = bad params, 500 = internal, 600 = permission denied,
// 601 = insufficient balance, 602 = budget exceeded.
// ---------------------------------------------------------------------------

const JUSTONE_BASE_URL = 'https://api.justoneapi.com'
const MAX_RETRIES = 2
const RETRY_BACKOFF_MS = 1500

export type JoPlatform = 'xianyu' | '1688' | 'tiktok-shop' | 'amazon' | 'douyin-ec' | 'taobao'
export type JoCurrency = 'CNY' | 'EUR' | 'USD'

export function justoneConfigured(): boolean {
  return Boolean(useRuntimeConfig().justone?.apiKey)
}

function justoneKey(): string {
  return String(useRuntimeConfig().justone?.apiKey || '')
}

async function joGet<T>(path: string, params: Record<string, string>): Promise<T> {
  if (!justoneConfigured()) {
    throw new Error('Just One API n\u2019est pas configur\u00e9 (cl\u00e9 API manquante).')
  }
  const qs = new URLSearchParams({ token: justoneKey(), ...params })
  let lastErr: any = null
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS * attempt))
    let res: Response
    try {
      res = await fetch(`${JUSTONE_BASE_URL}${path}?${qs.toString()}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(120_000),
      })
    } catch (err) {
      lastErr = err
      continue // network hiccup -> retry
    }
    const json = await res.json().catch(() => ({}))
    if (!res.ok || json?.code === 100) {
      console.error('[justone] request failed:', res.status, path, JSON.stringify(json).slice(0, 300))
      throw createError({ statusCode: 502, statusMessage: 'Just One API indisponible (vérifier le jeton et le solde du compte).' })
    }
    // Transient provider errors -> retry (TikTok 301 COLLECT FAILED observed;
    // 302 TOO FAST rate limit).
    if (json?.code === 301 || json?.code === 302) {
      lastErr = new Error(`justone transient code ${json.code}: ${String(json.message || '').slice(0, 80)}`)
      console.warn(`[justone] retry ${attempt + 1}/${MAX_RETRIES} (code ${json.code})`, path)
      continue
    }
    if (json?.code !== 0 && json?.code !== undefined) {
      // Balance / quota errors: surface a readable message to the admin.
      const msg =
        json.code === 601 || json.code === 602
          ? 'Solde Just One API insuffisant : rechargez le compte (dashboard.justoneapi.com) pour les appels de détail.'
          : json.code === 303
            ? 'Quota quotidien Just One API atteint, réessayez demain.'
            : `Just One API erreur ${json.code}: ${String(json.message || '').slice(0, 120)}`
      throw createError({ statusCode: 422, statusMessage: msg })
    }
    return json as T
  }
  console.error('[justone] retries exhausted:', path, String(lastErr?.message || lastErr || ''))
  throw createError({ statusCode: 422, statusMessage: 'Just One API : la collecte a échoué après plusieurs tentatives (301/302). Réessayez dans quelques instants.' })
}

// ---------------------------------------------------------------------------
// Normalized shapes (source-agnostic) — what the admin import screen consumes.
// ---------------------------------------------------------------------------

export interface JoSearchItem {
  platform: JoPlatform
  sourceId: string        // itemId / offerId / productId / asin
  title: string           // raw title (Chinese / EN / FR depending on platform)
  price: number           // price in the source currency (0 when unknown)
  currency: JoCurrency    // CNY / EUR / USD
  imageUrl: string        // main picture URL (remote)
  area?: string
  sellerNick?: string
  sourceUrl?: string
  // Trending / analytics signals (shown in the admin UI when present)
  sales?: number          // sold count / sales volume
  rating?: number         // star rating (0-5) or good ratio (%)
  ratingCount?: number    // number of reviews
  isBestSeller?: boolean
  isAmazonChoice?: boolean
  shopName?: string
  extra?: any             // remaining raw payload for the detail enrichment step
}

export interface JoDetail {
  platform: JoPlatform
  sourceId: string
  title: string
  desc: string
  images: string[]            // full gallery URLs (remote)
  price: number
  currency: JoCurrency
  condition?: string          // Xianyu: itemStatusStr (state declared by seller)
  features: { name: string; value: string }[]  // cpvLabels / spec labels
  seller?: {
    nick?: string
    city?: string
    soldCount?: number
    goodRemarkCnt?: number
    badRemarkCnt?: number
    replyRatio24h?: string
    newGoodRatioRate?: string
    zhimaVerified?: boolean
    itemCount?: number
  }
  wantCnt?: number
  browseCnt?: number
  favorCnt?: number
  sales?: number
  rating?: number
  ratingCount?: number
  extra?: any
}

// ---------------------------------------------------------------------------
// Xianyu — raw search cards (huge MTOP structure). The real product list is
// data.resultList[] with cards of type "DX"; each card exposes the item under
// data.item.main.exContent (title, price, picUrl, itemId, area, userNick…).
// ---------------------------------------------------------------------------

function flattenXianyuSearch(json: any): JoSearchItem[] {
  const out: JoSearchItem[] = []
  const list = json?.data?.resultList
  if (!Array.isArray(list)) return out
  for (const card of list) {
    if (card?.type !== 'DX') continue
    const ex = card?.data?.item?.main?.exContent
    if (!ex?.itemId) continue
    const priceNum = Number(String(ex?.displayPrice ?? ex?.soldPrice ?? ex?.price?.[1]?.text ?? '').replace(/[^0-9.]/g, ''))
    const pic = String(ex?.picUrl || '')
    const rawTitle = String(ex?.title || ex?.titleSpan?.content || '')
    const targetUrl = String(card?.data?.item?.main?.clickParam?.targetUrl || ex?.targetUrl || '')
    out.push({
      platform: 'xianyu',
      sourceId: String(ex.itemId),
      title: rawTitle,
      price: Number.isFinite(priceNum) ? priceNum : 0,
      currency: 'CNY',
      imageUrl: pic,
      area: String(ex?.area || ''),
      sellerNick: String(ex?.userNick || ex?.userNickName || ''),
      sourceUrl: targetUrl,
      extra: { ex },
    })
  }
  return out
}

function flattenXianyuDetail(json: any): JoDetail | null {
  const item = json?.data?.item
  if (!item?.itemId) return null
  const seller = json?.data?.sellerDO || {}
  const images: string[] = []
  for (const img of Array.isArray(item.imageInfos) ? item.imageInfos : []) {
    const url = String(img?.url || '')
    if (url) images.push(url)
  }
  const features: { name: string; value: string }[] = []
  for (const l of Array.isArray(item.cpvLabels) ? item.cpvLabels : []) {
    features.push({ name: String(l?.propertyName || ''), value: String(l?.valueName || '') })
  }
  const price = Number(String(item?.price ?? '').replace(/[^0-9.]/g, ''))
  return {
    platform: 'xianyu',
    sourceId: String(item.itemId),
    title: String(item.title || ''),
    desc: String(item.desc || ''),
    images,
    price: Number.isFinite(price) ? price : 0,
    currency: 'CNY',
    condition: String(item.itemStatusStr || ''),
    features,
    seller: {
      nick: String(seller.nick || seller.desensitizationNick || ''),
      city: String(seller.city || seller.publishCity || ''),
      soldCount: Number(seller.hasSoldNumInteger) || undefined,
      goodRemarkCnt: Number(seller.remarkDO?.sellerGoodRemarkCnt) || undefined,
      badRemarkCnt: Number(seller.remarkDO?.sellerBadRemarkCnt) || undefined,
      replyRatio24h: String(seller.replyRatio24h || ''),
      newGoodRatioRate: String(seller.newGoodRatioRate || ''),
      zhimaVerified: Boolean(seller.zhimaAuth),
      itemCount: Number(seller.itemCount) || undefined,
    },
    wantCnt: Number(item.wantCnt) || undefined,
    browseCnt: Number(item.browseCnt) || undefined,
    favorCnt: Number(item.favorCnt) || undefined,
    extra: { item },
  }
}

// ---------------------------------------------------------------------------
// 1688 — search returns data.data.OFFER.items[] (each item.data holds the
// offer: offerId, title, priceInfo, odPicUrl, linkUrl…).
// ---------------------------------------------------------------------------

function flatten1688Search(json: any): JoSearchItem[] {
  const out: JoSearchItem[] = []
  const items = json?.data?.data?.OFFER?.items
  if (!Array.isArray(items)) return out
  for (const card of items) {
    const d = card?.data
    if (!d?.offerId) continue
    const price = Number(String(d?.priceInfo?.price ?? d?.displayPrice ?? '').replace(/[^0-9.]/g, ''))
    out.push({
      platform: '1688',
      sourceId: String(d.offerId),
      title: String(d.title || '').replace(/<[^>]*>/g, ''),
      price: Number.isFinite(price) ? price : 0,
      currency: 'CNY',
      imageUrl: String(d?.odPicUrl || d?.offerPicUrl || ''),
      area: String(d?.city || d?.province || ''),
      sellerNick: String(d?.memberId || ''),
      sourceUrl: String(d?.linkUrl || d?.winPortUrl || ''),
      sales: Number(d?.saleCount) || undefined,
      extra: { d },
    })
  }
  return out
}

function flatten1688Detail(json: any): JoDetail | null {
  // Shape observed across 1688 detail responses: the offer object is nested
  // under data.data (content / offerContent). We defensively scan a couple of
  // known keys so the pipeline keeps working if the provider reshapes slightly.
  const root = json?.data
  const offer =
    root?.data?.offerContent ||
    root?.data?.content ||
    root?.offer ||
    root?.content ||
    root?.data ||
    null
  if (!offer) return null
  const sourceId = String(offer.offerId || root?.data?.offerId || '')
  if (!sourceId) return null
  const images: string[] = []
  const imgs = offer.image?.images || offer.images || offer.productImages || []
  if (Array.isArray(imgs)) {
    for (const i of imgs) {
      const url = String(i?.fullPathImageURI || i?.imageUrl || i?.url || i || '')
      if (url) images.push(url)
    }
  }
  return {
    platform: '1688',
    sourceId,
    title: String(offer.subject || offer.title || ''),
    desc: String(offer.detail || offer.description || offer.content || ''),
    images,
    price: Number(String(offer.priceInfo?.price ?? offer.price ?? offer.saleInfo?.price ?? '').replace(/[^0-9.]/g, '')) || 0,
    currency: 'CNY',
    features: [],
    extra: { offer },
  }
}

// ---------------------------------------------------------------------------
// Taobao / Tmall — search returns data.model.itemList[] (very close to 1688:
// itemId, itemName, discntPriceYuan, picUrlFull, shopId/shopName, orderPayUV).
// ---------------------------------------------------------------------------

function flattenTaobaoSearch(json: any): JoSearchItem[] {
  const out: JoSearchItem[] = []
  const items = json?.data?.model?.itemList
  if (!Array.isArray(items)) return out
  for (const d of items) {
    if (!d?.itemId) continue
    const price = Number(String(d?.discntPriceYuan ?? d?.priceYuanDouble ?? d?.priceZKYuanDouble ?? '').replace(/[^0-9.]/g, ''))
    const salesText = String(d?.orderPayUV || '')
    const salesNum = Number(salesText.replace(/[^0-9]/g, ''))
    const pic = String(d?.picUrlFull || '')
    out.push({
      platform: 'taobao',
      sourceId: String(d.itemId),
      title: String(d?.itemName || ''),
      price: Number.isFinite(price) ? price : 0,
      currency: 'CNY',
      imageUrl: pic.startsWith('http') ? pic : `https:${pic}`,
      area: String(d?.itemLoc || ''),
      sellerNick: String(d?.shopName || ''),
      sourceUrl: `https://item.taobao.com/item.htm?id=${d.itemId}`,
      sales: Number.isFinite(salesNum) ? salesNum : undefined,
      shopName: String(d?.shopName || ''),
      extra: { d },
    })
  }
  return out
}

function flattenTaobaoDetail(json: any): JoDetail | null {
  const root = json?.data
  const offer = root?.data?.item || root?.item || root?.data || null
  if (!offer) return null
  const sourceId = String(offer.itemId || offer.id || root?.itemId || '')
  if (!sourceId) return null
  const images: string[] = []
  const imgs = offer.images || offer.imageUrls || (Array.isArray(offer.image) ? offer.image : []) || []
  if (Array.isArray(imgs)) {
    for (const i of imgs) {
      const url = String(typeof i === 'string' ? i : i?.url || i?.imageUrl || i?.fullPathImageURI || '')
      if (url) images.push(url.startsWith('http') ? url : `https:${url}`)
    }
  }
  const price = Number(String(offer.priceInfo?.price ?? offer.price ?? offer.priceYuanDouble ?? offer.discntPriceYuan ?? '').replace(/[^0-9.]/g, ''))
  return {
    platform: 'taobao',
    sourceId,
    title: String(offer.title || offer.itemName || offer.subject || ''),
    desc: String(offer.detail || offer.description || offer.content || ''),
    images,
    price: Number.isFinite(price) ? price : 0,
    currency: 'CNY',
    features: [],
    extra: { offer },
  }
}

// ---------------------------------------------------------------------------
// TikTok Shop — search returns data.products[] (note: the payload nests the
// real list under data.data.products). Each product exposes product_id, title,
// image.url_list, product_price_info (sale_price_decimal, currency_name),
// rate_info, sold_info, seller_info, seo_url.canonical_url.
// ---------------------------------------------------------------------------

function pickImage(urls: any): string {
  if (Array.isArray(urls)) return String(urls[0] || '')
  if (urls?.url_list?.length) return String(urls.url_list[0] || '')
  if (typeof urls === 'string') return urls
  return ''
}

function flattenTikTokSearch(json: any): JoSearchItem[] {
  const out: JoSearchItem[] = []
  // Defensive unwrap: the provider sometimes wraps the list one level deeper
  // ({code, data:{code, message, data:{products}}}).
  const data = json?.data?.data?.products ? json.data.data : json?.data
  const list = data?.products
  if (!Array.isArray(list)) return out
  for (const p of list) {
    if (!p?.product_id) continue
    const priceInfo = p?.product_price_info || {}
    const price = Number(String(priceInfo?.sale_price_decimal ?? priceInfo?.sale_price_format ?? '0').replace(/[^0-9.]/g, ''))
    const cur = String(priceInfo?.currency_name || 'USD').toUpperCase()
    out.push({
      platform: 'tiktok-shop',
      sourceId: String(p.product_id),
      title: String(p?.title || ''),
      price: Number.isFinite(price) ? price : 0,
      currency: cur === 'EUR' ? 'EUR' : cur === 'CNY' ? 'CNY' : 'USD',
      imageUrl: pickImage(p?.image),
      sourceUrl: String(p?.seo_url?.canonical_url || ''),
      sales: Number(p?.sold_info?.sold_count) || undefined,
      rating: Number(p?.rate_info?.score) || undefined,
      ratingCount: Number(p?.rate_info?.review_count) || undefined,
      shopName: String(p?.seller_info?.shop_name || ''),
      sellerNick: String(p?.seller_info?.shop_name || ''),
      extra: { p },
    })
  }
  return out
}

function flattenTikTokDetail(json: any): JoDetail | null {
  const data = json?.data?.data?.product || json?.data?.product || json?.data?.data || json?.data
  const p = data?.product || data?.data?.product || data
  if (!p?.product_id && !p?.id) return null
  const sourceId = String(p?.product_id || p?.id || '')
  const priceInfo = p?.product_price_info || {}
  const price = Number(String(priceInfo?.sale_price_decimal ?? priceInfo?.sale_price_format ?? '0').replace(/[^0-9.]/g, ''))
  const cur = String(priceInfo?.currency_name || 'USD').toUpperCase()
  const images: string[] = []
  for (const g of Array.isArray(p?.images) ? p.images : []) {
    const url = pickImage(g)
    if (url) images.push(url)
  }
  const features: { name: string; value: string }[] = []
  for (const s of Array.isArray(p?.sku_info) ? p.sku_info : []) {
    features.push({ name: 'SKU', value: String(s?.SkuId || s?.sku_id || '') })
  }
  return {
    platform: 'tiktok-shop',
    sourceId,
    title: String(p?.title || ''),
    desc: String(p?.description || p?.desc || ''),
    images,
    price: Number.isFinite(price) ? price : 0,
    currency: cur === 'EUR' ? 'EUR' : cur === 'CNY' ? 'CNY' : 'USD',
    features,
    sales: Number(p?.sold_info?.sold_count) || undefined,
    rating: Number(p?.rate_info?.score) || undefined,
    ratingCount: Number(p?.rate_info?.review_count) || undefined,
    extra: { p },
  }
}

// ---------------------------------------------------------------------------
// Amazon — search returns data.products[] (asin, product_title, product_price
// "949,00 €", currency, product_photo, product_url, is_best_seller,
// is_amazon_choice, sales_volume, product_num_ratings…).
// ---------------------------------------------------------------------------

function parsePriceString(s: string): number {
  // "949,00 €" | "$26.99" | "1 299,00 €" -> number
  if (!s) return 0
  const cleaned = String(s).replace(/[^\d.,]/g, '')
  const withDot = cleaned.replace(/\s/g, '')
  let num = Number(withDot)
  if (Number.isNaN(num)) {
    // French style "949,00" -> 949.00
    if (withDot.includes(',')) {
      num = Number(withDot.replace(/\./g, '').replace(',', '.'))
    }
  }
  return Number.isFinite(num) ? num : 0
}

function flattenAmazonSearch(json: any): JoSearchItem[] {
  const out: JoSearchItem[] = []
  const list = json?.data?.products
  if (!Array.isArray(list)) return out
  for (const p of list) {
    if (!p?.asin) continue
    const cur = String(p?.currency || 'USD').toUpperCase()
    const salesText = String(p?.sales_volume || '')
    const salesNum = Number(salesText.replace(/[^0-9]/g, ''))
    out.push({
      platform: 'amazon',
      sourceId: String(p.asin),
      title: String(p?.product_title || ''),
      price: parsePriceString(String(p?.product_price || '')),
      currency: cur === 'EUR' ? 'EUR' : cur === 'CNY' ? 'CNY' : 'USD',
      imageUrl: String(p?.product_photo || ''),
      sourceUrl: String(p?.product_url || ''),
      sales: Number.isFinite(salesNum) ? salesNum : undefined,
      rating: Number(p?.product_star_rating) || undefined,
      ratingCount: Number(p?.product_num_ratings) || undefined,
      isBestSeller: Boolean(p?.is_best_seller),
      isAmazonChoice: Boolean(p?.is_amazon_choice),
      sellerNick: String(p?.product_num_offers ? `${p.product_num_offers} offre(s)` : ''),
      extra: { p },
    })
  }
  return out
}

function flattenAmazonDetail(json: any): JoDetail | null {
  const p = json?.data?.product || json?.data?.data?.product || json?.data
  if (!p?.asin) return null
  const cur = String(p?.currency || 'USD').toUpperCase()
  const images: string[] = []
  for (const g of Array.isArray(p?.images) ? p.images : []) {
    const url = String(typeof g === 'string' ? g : g?.url || g?.large || '')
    if (url) images.push(url)
  }
  return {
    platform: 'amazon',
    sourceId: String(p.asin),
    title: String(p?.product_title || p?.title || ''),
    desc: String(p?.description || p?.product_description || ''),
    images,
    price: parsePriceString(String(p?.product_price || p?.price || '')),
    currency: cur === 'EUR' ? 'EUR' : cur === 'CNY' ? 'CNY' : 'USD',
    features: [],
    sales: Number(String(p?.sales_volume || '').replace(/[^0-9]/g, '')) || undefined,
    rating: Number(p?.product_star_rating) || undefined,
    ratingCount: Number(p?.product_num_ratings) || undefined,
    extra: { p },
  }
}

// ---------------------------------------------------------------------------
// Douyin E-commerce — search returns data.summary_promotions[]. Each entry:
// product_id, base_model.product_info (name, main_img.url_list, detail_url,
// month_sale.origin, good_ratio.origin, sale_axis[]) and the PRICE lives in
// base_model.marketing_info.price_desc.price.origin (in 分 / cents: 1590 =
// ¥15.90) + regular_price.origin.
// ---------------------------------------------------------------------------

function flattenDouyinSearch(json: any): JoSearchItem[] {
  const out: JoSearchItem[] = []
  const list = json?.data?.summary_promotions || json?.data?.promotions
  if (!Array.isArray(list)) return out
  for (const p of list) {
    const bm = p?.base_model || {}
    const pi = bm?.product_info || {}
    const mk = bm?.marketing_info?.price_desc || {}
    if (!p?.product_id) continue
    const priceCents = Number(mk?.price?.origin ?? 0)
    const price = priceCents > 0 ? priceCents / 100 : 0
    out.push({
      platform: 'douyin-ec',
      sourceId: String(p.product_id),
      title: String(pi?.name || ''),
      price,
      currency: 'CNY',
      imageUrl: pickImage(pi?.main_img),
      sourceUrl: String(pi?.detail_url || ''),
      sales: Number(pi?.month_sale?.origin) || undefined,
      rating: Number(pi?.good_ratio?.origin) || undefined, // % of good ratio
      shopName: String(bm?.shop_info?.shop_name || ''),
      sellerNick: String(bm?.shop_info?.shop_name || ''),
      extra: { p, saleAxis: pi?.sale_axis || [] },
    })
  }
  return out
}

function flattenDouyinDetail(json: any): JoDetail | null {
  const p = json?.data?.data || json?.data || {}
  const pi = p?.product_info || p?.data?.product_info || {}
  const mk = p?.marketing_info?.price_desc || {}
  if (!p?.product_id && !pi?.product_id) return null
  const sourceId = String(p?.product_id || pi?.product_id || '')
  const priceCents = Number(mk?.price?.origin ?? 0)
  const images: string[] = []
  for (const g of Array.isArray(p?.images) ? p.images : []) {
    const url = pickImage(g)
    if (url) images.push(url)
  }
  if (!images.length && pi?.main_img?.url_list?.length) images.push(String(pi.main_img.url_list[0]))
  return {
    platform: 'douyin-ec',
    sourceId,
    title: String(pi?.name || p?.title || ''),
    desc: String(p?.desc || p?.description || ''),
    images,
    price: priceCents > 0 ? priceCents / 100 : 0,
    currency: 'CNY',
    features: [],
    sales: Number(pi?.month_sale?.origin) || Number(p?.month_sale?.origin) || undefined,
    rating: Number(pi?.good_ratio?.origin) || Number(p?.good_ratio?.origin) || undefined,
    extra: { p },
  }
}

// ---------------------------------------------------------------------------
// Public API — search & detail across all platforms.
// ---------------------------------------------------------------------------

export async function joSearch(
  platform: JoPlatform,
  keyword: string,
  page = 1,
  sort: string = '',
  region: string = 'US',
): Promise<JoSearchItem[]> {
  switch (platform) {
    case 'xianyu': {
      const json = await joGet<any>('/api/xianyu/search-item-list/v1', { keyword, page: String(page), sort: sort || 'active' })
      return flattenXianyuSearch(json)
    }
    case '1688': {
      const json = await joGet<any>('/api/1688/search-item-list/v1', { keyword, page: String(page) })
      return flatten1688Search(json)
    }
    case 'taobao': {
      const json = await joGet<any>('/api/taobao/search-item-list/v1', { keyword, page: String(page), sort: sort || '_sale' })
      return flattenTaobaoSearch(json)
    }
    case 'tiktok-shop': {
      // Region US default (FR possible). On a repeated 301/302 the joGet retry
      // loop already kicked in; if the caller passed FR and still failed we
      // fall back to US below (done in the route via the fallback param).
      const json = await joGet<any>('/api/tiktok-shop/search-products/v1', {
        keyword,
        region,
        offset: String((page - 1) * 20),
      })
      return flattenTikTokSearch(json)
    }
    case 'amazon': {
      const json = await joGet<any>('/api/amazon/search-products/v1', {
        keyword,
        country: region,
        sortBy: sort || 'RELEVANCE',
        page: String(page),
      })
      return flattenAmazonSearch(json)
    }
    case 'douyin-ec': {
      const json = await joGet<any>('/api/douyin-ec/search-item-list/v1', { keyword, page: String(page) })
      return flattenDouyinSearch(json)
    }
    default:
      throw createError({ statusCode: 400, statusMessage: `Plateforme inconnue: ${platform}` })
  }
}

export async function joDetail(platform: JoPlatform, sourceId: string, region: string = 'US'): Promise<JoDetail> {
  let json: any
  switch (platform) {
    case 'xianyu':
      json = await joGet<any>('/api/xianyu/get-item-detail/v1', { itemId: sourceId })
      break
    case '1688':
      json = await joGet<any>('/api/1688/get-item-detail/v1', { itemId: sourceId })
      break
    case 'taobao':
      json = await joGet<any>('/api/taobao/get-item-detail/v1', { itemId: sourceId })
      break
    case 'tiktok-shop':
      json = await joGet<any>('/api/tiktok-shop/get-product-detail/v1', { productId: sourceId, region })
      break
    case 'amazon':
      json = await joGet<any>('/api/amazon/get-product-detail/v1', { asin: sourceId, country: region })
      break
    case 'douyin-ec':
      json = await joGet<any>('/api/douyin-ec/item-details/v2', { productId: sourceId })
      break
    default:
      throw createError({ statusCode: 400, statusMessage: `Plateforme inconnue: ${platform}` })
  }

  let detail: JoDetail | null = null
  switch (platform) {
    case 'xianyu': detail = flattenXianyuDetail(json); break
    case '1688': detail = flatten1688Detail(json); break
    case 'taobao': detail = flattenTaobaoDetail(json); break
    case 'tiktok-shop': detail = flattenTikTokDetail(json); break
    case 'amazon': detail = flattenAmazonDetail(json); break
    case 'douyin-ec': detail = flattenDouyinDetail(json); break
  }
  if (!detail) throw createError({ statusCode: 422, statusMessage: `Produit ${platform} introuvable.` })
  return detail
}

// ---------------------------------------------------------------------------
// Image import: download a remote image, persist it to the project blob (bm-
// images) with a 16-hex id and return the local /api/img/<id>.jpg URL. Falls
// back to the remote URL when download fails (degraded mode).
// ---------------------------------------------------------------------------

import { saveImage, looksLikeImage } from '~~/server/utils/storage'
import crypto from 'node:crypto'

export async function importRemoteImage(url: string, index = 0): Promise<string> {
  const id = crypto.createHash('md5').update(`jo_${url}_${index}_${Date.now()}`).digest('hex').slice(0, 16)
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) })
    if (!res.ok) return url
    const buffer = Buffer.from(await res.arrayBuffer())
    if (!looksLikeImage(buffer)) return url
    await saveImage(id, buffer)
    return `/api/img/${id}.jpg`
  } catch {
    return url
  }
}

// ---------------------------------------------------------------------------
// Currency conversions -> XOF. The storefront XOF is the canonical currency.
//   - CNY: anchored at runtimeConfig.public.rmbToXofRate (default 95, the
//     "1 yuan = 95 FCFA" transparent rule the admin asked for).
//   - EUR: fixed official peg 655.957 XOF per EUR (runtimeConfig.public.
//     eurToXofRate).
//   - USD: configurable approximation runtimeConfig.public.usdToXofRate
//     (default 700; NOT a fixed peg).
// ---------------------------------------------------------------------------

export function cnyToXof(priceCny: number, margin = 1): number {
  const rate = Number(useRuntimeConfig().public.rmbToXofRate) || 95
  return Math.round(priceCny * rate * margin)
}

export function eurToXof(priceEur: number, margin = 1): number {
  const rate = Number(useRuntimeConfig().public.eurToXofRate) || 655.957
  return Math.round(priceEur * rate * margin)
}

export function usdToXof(priceUsd: number, margin = 1): number {
  const rate = Number(useRuntimeConfig().public.usdToXofRate) || 700
  return Math.round(priceUsd * rate * margin)
}

/** Convert a JoSearchItem/JoDetail price to XOF using its own currency. */
export function priceToXof(item: { price: number; currency: JoCurrency }): number {
  if (!item?.price) return 0
  switch (item.currency) {
    case 'EUR': return eurToXof(item.price)
    case 'USD': return usdToXof(item.price)
    default: return cnyToXof(item.price)
  }
}
