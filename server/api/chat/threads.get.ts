import { requireAuth } from '~~/server/utils/auth'
import { getClientThreads, clientUnreadCount } from '~~/server/utils/chat'
import { loadOrders } from '~~/server/utils/storage'

// Client space: every chat thread belonging to this user (preorders + orders)
// with the number of unread ADMIN replies for badge rendering.
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  const userId = session.userId || ''
  const threads = await getClientThreads(userId)

  // Join with orders so the client UI can show the order context (status etc.).
  const orders = (await loadOrders()).filter((o) => o.userId === userId)
  const byOrderId = new Map(orders.map((o) => [o.id, o]))

  return {
    success: true,
    unread: threads.reduce((s, t) => s + clientUnreadCount(t, t.clientReadTs || 0), 0),
    threads: threads.map((t) => {
      const order = t.orderId ? byOrderId.get(t.orderId) || null : null
      return {
        id: t.id,
        kind: t.kind,
        orderId: t.orderId,
        productId: t.productId,
        productTitle: t.productTitle,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        unread: clientUnreadCount(t, t.clientReadTs || 0),
        locked: order ? order.status === 'completed' : false,
        order,
        messages: t.messages || [],
      }
    }),
  }
})
