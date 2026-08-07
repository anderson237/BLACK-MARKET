import { requireAuth, rateLimit } from '~~/server/utils/auth'
import { addMessage, getThread, ordThreadId } from '~~/server/utils/chat'
import { loadOrders, loadAccounts } from '~~/server/utils/storage'

// Admin replies on any thread (preorder or order). If the thread does not
// exist yet (e.g. a manual order created without a prior conversation), it is
// created on the fly from the order/customer so the admin can always reply.
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  if (session.role !== 'admin') throw createError({ statusCode: 403, statusMessage: 'Accès administrateur requis.' })
  rateLimit(60, 60_000)(event)

  const body = await readBody(event).catch(() => ({}))
  const threadId = String(body?.threadId || '')
  const text = String(body?.text || '').trim()
  if (!threadId || !text) throw createError({ statusCode: 400, statusMessage: 'threadId et texte requis.' })

  let existing = await getThread(threadId)

  if (!existing) {
    // Try to bootstrap from an order (ord:<id>) or a preorder (pre:<userId>).
    if (threadId.startsWith('ord:')) {
      const orderId = threadId.slice(4)
      const orders = await loadOrders()
      const order = orders.find((o) => o.id === orderId)
      if (!order) throw createError({ statusCode: 404, statusMessage: 'Commande introuvable.' })
      existing = await addMessage(
        { id: threadId, kind: 'order', userId: order.userId || '', orderId, productTitle: order.productTitle, customerName: order.customerName },
        'admin',
        text,
      )
      return { success: true, thread: existing }
    }
    if (threadId.startsWith('pre:')) {
      const userId = threadId.slice(4)
      const accounts = await loadAccounts()
      const acc = (accounts || []).find((a) => a.id === userId)
      existing = await addMessage(
        { id: threadId, kind: 'preorder', userId, productTitle: '', customerName: acc?.pseudo || acc?.name || acc?.email || 'Client' },
        'admin',
        text,
      )
      return { success: true, thread: existing }
    }
    throw createError({ statusCode: 404, statusMessage: 'Discussion introuvable.' })
  }

  const thread = await addMessage(
    { id: existing.id, kind: existing.kind, userId: existing.userId, orderId: existing.orderId, productTitle: existing.productTitle, customerName: existing.customerName },
    'admin',
    text,
  )
  return { success: true, thread }
})
