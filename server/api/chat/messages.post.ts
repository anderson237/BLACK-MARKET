import { requireAuth, rateLimit } from '~~/server/utils/auth'
import { addMessage, preThreadId, ordThreadId } from '~~/server/utils/chat'
import { loadOrders, loadCart } from '~~/server/utils/storage'

// Client sends a message on their preorder thread (`pre:<userId>`) or on one
// of their order threads (`ord:<orderId>`). The thread is created on demand.
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  rateLimit(30, 60_000)(event)
  const userId = session.userId || ''
  if (!userId) throw createError({ statusCode: 401, statusMessage: 'Compte requis pour discuter.' })

  const body = await readBody(event).catch(() => ({}))
  const text = String(body?.text || '').trim()
  if (!text) throw createError({ statusCode: 400, statusMessage: 'Message vide.' })

  let threadId = ''
  let kind: 'preorder' | 'order' = 'preorder'
  let orderId: string | undefined
  let productTitle = ''

  if (body?.orderId) {
    orderId = String(body.orderId)
    const orders = await loadOrders()
    const order = orders.find((o) => o.id === orderId)
    if (!order || (order.userId && order.userId !== userId)) {
      throw createError({ statusCode: 403, statusMessage: 'Commande introuvable.' })
    }
    threadId = ordThreadId(orderId)
    kind = 'order'
    productTitle = order.productTitle || ''
  } else {
    // Preorder thread: tied to the user's basket.
    threadId = preThreadId(userId)
    const cart = await loadCart(userId)
    if (!cart?.length) {
      throw createError({ statusCode: 400, statusMessage: "Ajoutez d'abord des articles à vos précommandes." })
    }
    productTitle = cart.map((c) => c.title).slice(0, 3).join(', ')
  }

  const thread = await addMessage(
    { id: threadId, kind, userId, orderId, productTitle, customerName: session.name || 'Client' },
    'client',
    text,
  )
  return { success: true, thread }
})
