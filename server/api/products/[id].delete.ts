import { loadProducts, saveProducts } from '~~/server/utils/storage'
import { requireAuth } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const id = getRouterParam(event, 'id')
  const products = await loadProducts()
  const p = products.find((p) => p.id === id)
  if (!p) throw createError({ statusCode: 404, statusMessage: 'Produit introuvable.' })
  p.deleted = true
  p.deletedAt = new Date().toISOString()
  await saveProducts(products)
  return { success: true, deleted: true }
})
