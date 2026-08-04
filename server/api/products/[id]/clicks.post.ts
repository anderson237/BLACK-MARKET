import { loadProducts, saveProducts, withLock } from '~~/server/utils/storage'
import { rateLimit } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  rateLimit(120, 60_000)(event)
  const id = getRouterParam(event, 'id')
  return withLock('products', async () => {
    const products = await loadProducts()
    const idx = products.findIndex((p) => p.id === id)
    if (idx < 0) throw createError({ statusCode: 404, statusMessage: 'Produit introuvable.' })
    products[idx] = { ...products[idx], whatsappClicks: (Number(products[idx].whatsappClicks) || 0) + 1 }
    await saveProducts(products)
    return { success: true, whatsappClicks: products[idx].whatsappClicks }
  })
})