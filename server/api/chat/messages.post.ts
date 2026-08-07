import { requireAuth, rateLimit } from '~~/server/utils/auth'
import { addMessage, preThreadId, preItemThreadId, generalThreadId, ordThreadId } from '~~/server/utils/chat'
import { loadOrders, loadCart } from '~~/server/utils/storage'

// Client sends a message on:
//  - a per-article preorder thread   `pre:<userId>:<productId>`
//  - the legacy basket thread        `pre:<userId>`
//  - the general chat                `general:<userId>`
//  - one of their order threads      `ord:<orderId>` (locked once delivered)
// Threads are created on demand.
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  rateLimit(30, 60_000)(event)
  const userId = session.userId || ''
  if (!userId) throw createError({ statusCode: 401, statusMessage: 'Compte requis pour discuter.' })

  const body = await readBody(event).catch(() => ({}))
  const threadId = String(body?.threadId || '').trim()
  const text = String(body?.text || '').trim()
  if (!threadId || !text) throw createError({ statusCode: 400, statusMessage: 'threadId et texte requis.' })

  let kind: 'preorder' | 'order' | 'general' = 'preorder'
  let orderId: string | undefined
  let productId: string | undefined
  let productTitle = ''

  // ---- General chat (client space, always writable) ----
  if (threadId === generalThreadId(userId)) {
    kind = 'general'
  }
  // ---- Per-article preorder thread ----
  else if (threadId.startsWith(`pre:${userId}:`)) {
    productId = threadId.slice(`pre:${userId}:`.length)
    if (!productId) throw createError({ statusCode: 400, statusMessage: 'Article introuvable.' })
    const cart = await loadCart(userId)
    const item = (cart || []).find((c) => c.productId === productId)
    if (!item) {
      throw createError({ statusCode: 400, statusMessage: "Ajoutez d'abord cet article à vos précommandes pour discuter." })
    }
    productTitle = item.title || ''
  }
  // ---- Legacy basket thread (old clients / admin) ----
  else if (threadId === preThreadId(userId)) {
    const cart = await loadCart(userId)
    if (!cart?.length) {
      throw createError({ statusCode: 400, statusMessage: "Ajoutez d'abord des articles à vos précommandes." })
    }
    productTitle = cart.map((c) => c.title).slice(0, 3).join(', ')
  }
  // ---- Order thread ----
  else if (threadId.startsWith('ord:')) {
    orderId = threadId.slice(4)
    const orders = await loadOrders()
    const order = orders.find((o) => o.id === orderId)
    if (!order || (order.userId && order.userId !== userId)) {
      throw createError({ statusCode: 403, statusMessage: 'Commande introuvable.' })
    }
    if (order.status === 'completed') {
      throw createError({ statusCode: 400, statusMessage: 'Commande livrée — discussion fermée.' })
    }
    kind = 'order'
    productTitle = order.productTitle || ''
  } else {
    throw createError({ statusCode: 403, statusMessage: 'Discussion non autorisée.' })
  }

  const thread = await addMessage(
    { id: threadId, kind, userId, orderId, productId, productTitle, customerName: session.name || 'Client' },
    'client',
    text,
  )
  return { success: true, thread }
})
