import { loadCart, saveCart, withLock, type CartItem } from '~~/server/utils/storage'
import { requireAuth } from '~~/server/utils/auth'

// Adds (or bumps quantity of) a product in the authenticated user's basket.
// Price snapshot is captured server-side from the client payload so the admin
// sees the exact price at the moment the item was added.
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  const body = await readBody(event).catch(() => ({}))
  const productId = String(body.productId || '').trim()
  if (!productId) throw createError({ statusCode: 400, statusMessage: 'Produit manquant.' })

  const quantity = Math.max(1, Number(body.quantity) || 1)
  const item: CartItem = {
    productId,
    title: String(body.title || 'Produit').slice(0, 200),
    imageUrl: String(body.imageUrl || '').slice(0, 500) || undefined,
    quantity,
    priceXof: Math.max(0, Number(body.priceXof) || 0),
    priceEur: Number(body.priceEur) || undefined,
    addedAt: new Date().toISOString(),
  }

  return withLock('cart:' + session.userId, async () => {
    const cart = await loadCart(session.userId)
    const existing = cart.find((c) => c.productId === productId)
    if (existing) {
      existing.quantity += quantity
      existing.title = item.title
      existing.imageUrl = item.imageUrl
      existing.priceXof = item.priceXof
      existing.priceEur = item.priceEur
      existing.addedAt = item.addedAt
    } else {
      cart.unshift(item)
    }
    await saveCart(session.userId, cart)
    return { success: true, cart }
  })
})
