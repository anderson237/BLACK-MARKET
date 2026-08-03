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

  const events = (social.events || [])
    .filter((e) => e.userId === userId)
    .sort((a, b) => (b.ts || 0) - (a.ts || 0))
    .slice(0, MAX)

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

  const stats = {
    comments: comments.length,
    likes: events.filter((e) => e.type === 'like').length,
    views: events.filter((e) => e.type === 'view').length,
    clicks: events.filter((e) => e.type === 'click').length,
    shares: events.filter((e) => e.type === 'share' || e.type === 'copy').length,
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
          phone: account.phone,
          phonePrefix: account.phonePrefix,
          country: account.country,
          role: account.role,
          createdAt: account.createdAt,
        }
      : null,
    comments: enrich(comments),
    events: enrich(events),
    orders: enrich(orders),
    stats,
  }
})
