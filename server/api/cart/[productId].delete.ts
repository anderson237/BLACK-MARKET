import { loadCart, saveCart, withLock } from '~~/server/utils/storage'
import { requireAuth } from '~~/server/utils/auth'

// Removes an item from the authenticated user's basket.
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  const productId = String(getRouterParam(event, 'productId') || '').trim()
  if (!productId) throw createError({ statusCode: 400, statusMessage: 'Produit manquant.' })

  return withLock('cart:' + session.userId, async () => {
    const cart = await loadCart(session.userId)
    const next = cart.filter((c) => c.productId !== productId)
    await saveCart(session.userId, next)
    return { success: true, cart: next }
  })
})
