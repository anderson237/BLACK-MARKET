import { findAccount, getSocial, loadOrders, loadProducts } from '~~/server/utils/storage'
import { requireAuth } from '~~/server/utils/auth'

const MAX = 120

// Client space: every interaction this user has had with BLACK MARKET
// (comments, views, clicks, likes, shares) + their preorders/orders.
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  const account = session.userId ? await findAccount({ id: session.userId }) : null
  const userId = account?.id || session.userId || ''
  const phone = String(account?.phone || '').replace(/\D/g, '')

  const social = await getSocial()

  const comments = (social.comments || [])
    .filter((c) => c.userId === userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, MAX)

  // Full event history for this user (stats must NOT be sliced by the timeline cap).
  const mine = (social.events || [])
    .filter((e) => e.userId === userId)
    .sort((a, b) => (b.ts || 0) - (a.ts || 0))

  // Current like state per product: last like/unlike event wins.
  const likeState = new Map<string, boolean>()
  for (const e of mine) {
    if (e.type === 'like') likeState.set(e.productId, true)
    else if (e.type === 'unlike') likeState.set(e.productId, false)
  }
  const likedIds = [...likeState.entries()].filter(([, liked]) => liked).map(([productId]) => productId)

  const orders = (await loadOrders())
    .filter((o) =>
      (o.userId && o.userId === userId) ||
      (phone && o.customerPhone && String(o.customerPhone).replace(/\D/g, '') === phone),
    )
    .slice(0, MAX)

  // Enrich with product info (title/thumbnail) so the timeline is readable.
  const products = await loadProducts()
  const productIndex = new Map<string, { title?: string; imageUrl?: string }>()
  for (const p of products) {
    productIndex.set(p.id, { title: p.title, imageUrl: p.imageUrl })
  }
  const enrich = (items: any[]) => items.map((it) => {
    const meta = productIndex.get(it.productId) || {}
    return {
      ...it,
      productTitle: it.productTitle || meta.title || '',
      productImage: it.productImage || meta.imageUrl || '',
    }
  })

  // Timeline: latest events, then make sure currently-liked products always
  // show their like even if the event fell outside the slice.
  const timeline = mine.slice(0, MAX)
  const seenProducts = new Set(timeline.map((e) => e.productId))
  for (const e of mine) {
    if (e.type === 'like' && likedIds.includes(e.productId) && !seenProducts.has(e.productId)) {
      timeline.push(e)
      seenProducts.add(e.productId)
    }
    if (timeline.length >= MAX + 24) break
  }
  timeline.sort((a, b) => (b.ts || 0) - (a.ts || 0))

  const stats = {
    comments: comments.length,
    likes: likedIds.length,
    views: mine.filter((e) => e.type === 'view').length,
    clicks: mine.filter((e) => e.type === 'click').length,
    shares: mine.filter((e) => e.type === 'share' || e.type === 'copy').length,
    orders: orders.length,
  }

  return {
    success: true,
    user: account
      ? {
          id: account.id,
          email: account.email,
          name: account.name,
          pseudo: account.pseudo,
          picture: account.picture,
          mood: account.mood,
          phone: account.phone,
          phonePrefix: account.phonePrefix,
          country: account.country,
          role: account.role,
          createdAt: account.createdAt,
        }
      : null,
    comments: enrich(comments),
    events: enrich(timeline),
    liked: enrich(likedIds.map((id) => ({ productId: id }))),
    orders: enrich(orders),
    stats,
  }
})
