// ---------------------------------------------------------------------------
// Just One API client (server-only) — Xianyu (Goofish) + 1688 import pipeline
// (ST-017).
//
// Docs: https://docs.justoneapi.com/en/api/xianyu-goofish/product-search-v1
//       https://docs.justoneapi.com/en/api/xianyu-goofish/product-details-v1
//       https://docs.justoneapi.com/en/api/1688/ (search-item-list + detail)
//
// Endpoints used (all GET, auth via ?token=):
//   - Xianyu search:  /api/xianyu/search-item-list/v1?keyword=&page=&sort=
//   - Xianyu detail:  /api/xianyu/get-item-detail/v1?itemId=
//   - 1688 search:    /api/1688/search-item-list/v1?keyword=&page=
//   - 1688 detail:    /api/1688/get-item-detail/v1?itemId=
//
// Cost (per request): Xianyu search ¥0.20 / detail ¥0.20 ; 1688 search
// ¥0.10 / detail ¥0.10. Both share the SAME dashboard balance — when it is
// empty, detail calls fail with code 601 (INSUFFICIENT BALANCE).
//
// Business codes: 0 = success, 100 = invalid token, 301 = collection failed,
// 302 = rate limit, 303 = daily quota, 400 = bad params, 500 = internal,
// 600 = permission denied, 601 = insufficient balance, 602 = budget exceeded.
// ---------------------------------------------------------------------------

const JUSTONE_BASE_URL = 'https://api.justoneapi.com'

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
  const res = await fetch(`${JUSTONE_BASE_URL}${path}?${qs.toString()}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(120_000),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json?.code === 100) {
    console.error('[justone] request failed:', res.status, path, JSON.stringify(json).slice(0, 300))
    throw createError({ statusCode: 502, statusMessage: 'Just One API indisponible (vérifier le jeton et le solde du compte).' })
  }
  if (json?.code !== 0 && json?.code !== undefined) {
    // Balance / quota errors: surface a readable message to the admin.
    const msg =
      json.code === 601 || json.code === 602
        ? 'Solde Just One API insuffisant : rechargez le compte (dashboard.justoneapi.com) pour les appels de détail.'
        : json.code === 303
          ? 'Quota quotidien Just One API atteint, réessayez demain.'
          : json.code === 302
            ? 'Limite de débit Just One API atteinte, réessayez dans quelques instants.'
            : `Just One API erreur ${json.code}: ${String(json.message || '').slice(0, 120)}`
    throw createError({ statusCode: 422, statusMessage: msg })
  }
  return json as T
}

// ---------------------------------------------------------------------------
// Normalized shapes (source-agnostic) — what the admin import screen consumes.
// ---------------------------------------------------------------------------

export interface JoSearchItem {
  platform: 'xianyu' | '1688'
  sourceId: string        // itemId / offerId
  title: string           // raw title (mostly Chinese)
  priceCny: number        // price in ¥ (0 when unknown)
  imageUrl: string        // main picture URL (remote, alicdn)
  area?: string
  sellerNick?: string
  sourceUrl?: string
  extra?: any             // remaining raw payload for the detail enrichment step
}

export interface JoDetail {
  platform: 'xianyu' | '1688'
  sourceId: string
  title: string
  desc: string
  images: string[]            // full gallery URLs (remote)
  priceCny: number
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
      priceCny: Number.isFinite(priceNum) ? priceNum : 0,
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
    priceCny: Number.isFinite(price) ? price : 0,
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
      priceCny: Number.isFinite(price) ? price : 0,
      imageUrl: String(d?.odPicUrl || d?.offerPicUrl || ''),
      area: String(d?.city || d?.province || ''),
      sellerNick: String(d?.memberId || ''),
      sourceUrl: String(d?.linkUrl || d?.winPortUrl || ''),
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
    priceCny: Number(String(offer.priceInfo?.price ?? offer.price ?? offer.saleInfo?.price ?? '').replace(/[^0-9.]/g, '')) || 0,
    features: [],
    extra: { offer },
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function joSearch(
  platform: 'xianyu' | '1688',
  keyword: string,
  page = 1,
  sort: string = 'active',
): Promise<JoSearchItem[]> {
  if (platform === 'xianyu') {
    const json = await joGet<any>('/api/xianyu/search-item-list/v1', { keyword, page: String(page), sort })
    return flattenXianyuSearch(json)
  }
  const json = await joGet<any>('/api/1688/search-item-list/v1', { keyword, page: String(page) })
  return flatten1688Search(json)
}

export async function joDetail(platform: 'xianyu' | '1688', sourceId: string): Promise<JoDetail> {
  if (platform === 'xianyu') {
    const json = await joGet<any>('/api/xianyu/get-item-detail/v1', { itemId: sourceId })
    const detail = flattenXianyuDetail(json)
    if (!detail) throw createError({ statusCode: 422, statusMessage: 'Produit Xianyu introuvable.' })
    return detail
  }
  const json = await joGet<any>('/api/1688/get-item-detail/v1', { itemId: sourceId })
  const detail = flatten1688Detail(json)
  if (!detail) throw createError({ statusCode: 422, statusMessage: 'Produit 1688 introuvable.' })
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
// CNY -> XOF conversion. Uses the same fixed anchor as the storefront
// (runtimeConfig.public.rmbToXofRate, default 95). The admin asked for a
// transparent "1 yuan = 95 FCFA" conversion: the XOF price is exactly
// priceCny * rate (no hidden margin multiplier by default).
// ---------------------------------------------------------------------------

export function cnyToXof(priceCny: number, margin = 1): number {
  const rate = Number(useRuntimeConfig().public.rmbToXofRate) || 95
  return Math.round(priceCny * rate * margin)
}
