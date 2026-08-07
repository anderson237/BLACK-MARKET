import { requireAuth } from '~~/server/utils/auth'
import { getAllThreads, adminUnreadCount } from '~~/server/utils/chat'
import { loadAccounts, loadOrders } from '~~/server/utils/storage'

// Admin console: all chat threads (preorders + orders) with the customer
// account joined and the number of unread CLIENT messages for badges.
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  if (session.role !== 'admin') throw createError({ statusCode: 403, statusMessage: 'Accès administrateur requis.' })

  const [threads, accounts, orders] = await Promise.all([getAllThreads(), loadAccounts(), loadOrders()])
  const byId = new Map((accounts || []).map((a) => [a.id, a]))
  const orderById = new Map((orders || []).map((o) => [o.id, o]))

  return {
    success: true,
    unread: threads.reduce((s, t) => s + adminUnreadCount(t, t.adminReadTs || 0), 0),
    threads: threads.map((t) => {
      const acc = t.userId ? byId.get(t.userId) : null
      const order = t.orderId ? orderById.get(t.orderId) : null
      return {
        id: t.id,
        kind: t.kind,
        orderId: t.orderId,
        productId: t.productId,
        userId: t.userId,
        productTitle: t.productTitle,
        customerName: t.customerName,
        customer: acc
          ? { name: acc.pseudo || acc.name || acc.email || 'Client', email: acc.email, phone: acc.phone, picture: acc.picture }
          : null,
        order: order ? { id: order.id, productTitle: order.productTitle, status: order.status, quantity: order.quantity } : null,
        locked: order ? order.status === 'completed' : false,
        unread: adminUnreadCount(t, t.adminReadTs || 0),
        messages: t.messages || [],
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      }
    }),
  }
})
