import { requireAuth, rateLimit } from '~~/server/utils/auth'
import { addMessage, getThread, generalThreadId } from '~~/server/utils/chat'
import { loadOrders, loadAccounts, loadCart } from '~~/server/utils/storage'

// Admin replies on any thread (per-article preorder, legacy basket, general
// chat or order). If the thread does not exist yet it is bootstrapped from
// the order/customer so the admin can always reply. Order threads are locked
// once the order is delivered (status 'completed').
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  if (session.role !== 'admin') throw createError({ statusCode: 403, statusMessage: 'Accès administrateur requis.' })
  rateLimit(60, 60_000)(event)

  const body = await readBody(event).catch(() => ({}))
  const threadId = String(body?.threadId || '')
  const text = String(body?.text || '').trim()
  if (!threadId || !text) throw createError({ statusCode: 400, statusMessage: 'threadId et texte requis.' })

  const existing = await getThread(threadId)
  if (existing) {
    // Order threads cannot receive new messages once the order is delivered.
    if (existing.kind === 'order') {
      const orders = await loadOrders()
      const order = existing.orderId ? orders.find((o) => o.id === existing.orderId) : null
      if (order?.status === 'completed') {
        throw createError({ statusCode: 400, statusMessage: 'Commande livrée — discussion fermée.' })
      }
    }
    const thread = await addMessage(
      { id: existing.id, kind: existing.kind, userId: existing.userId, orderId: existing.orderId, productId: existing.productId, productTitle: existing.productTitle, customerName: existing.customerName },
      'admin',
      text,
    )
    return { success: true, thread }
  }

  // ---- Bootstrap a missing thread from its target ----
  const orders = await loadOrders()
  const accounts = await loadAccounts()
  const byId = new Map((accounts || []).map((a) => [a.id, a]))
  const customerNameFor = (userId: string): string => {
    const acc = userId ? byId.get(userId) : null
    return acc?.pseudo || acc?.name || acc?.email || 'Client'
  }

  // order thread
  if (threadId.startsWith('ord:')) {
    const orderId = threadId.slice(4)
    const order = orders.find((o) => o.id === orderId)
    if (!order) throw createError({ statusCode: 404, statusMessage: 'Commande introuvable.' })
    if (order.status === 'completed') {
      throw createError({ statusCode: 400, statusMessage: 'Commande livrée — discussion fermée.' })
    }
    const thread = await addMessage(
      { id: threadId, kind: 'order', userId: order.userId || '', orderId, productId: order.productId, productTitle: order.productTitle, customerName: order.customerName },
      'admin',
      text,
    )
    return { success: true, thread }
  }

  // general chat
  if (threadId.startsWith('general:')) {
    const userId = threadId.slice(8)
    const thread = await addMessage(
      { id: generalThreadId(userId), kind: 'general', userId, customerName: customerNameFor(userId) },
      'admin',
      text,
    )
    return { success: true, thread }
  }

  // preorder thread: `pre:<userId>` (legacy basket) or `pre:<userId>:<productId>` (per article)
  if (threadId.startsWith('pre:')) {
    const rest = threadId.slice(4)
    const colon = rest.indexOf(':')
    const userId = colon >= 0 ? rest.slice(0, colon) : rest
    const productId = colon >= 0 ? rest.slice(colon + 1) : undefined
    if (!userId) throw createError({ statusCode: 400, statusMessage: 'Client introuvable.' })
    // Try to recover the product title from the client's basket when possible.
    let productTitle = ''
    try {
      const cart = await loadCart(userId)
      const item = (cart || []).find((c) => c.productId === productId)
      productTitle = item?.title || ''
    } catch { /* keep empty title */ }
    const thread = await addMessage(
      { id: threadId, kind: 'preorder', userId, productId, productTitle, customerName: customerNameFor(userId) },
      'admin',
      text,
    )
    return { success: true, thread }
  }

  throw createError({ statusCode: 404, statusMessage: 'Discussion introuvable.' })
})
