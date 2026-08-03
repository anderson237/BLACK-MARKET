import { loadProducts, saveProducts } from '~~/server/utils/storage'
import { requireAuth } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const id = getRouterParam(event, 'id')
  const products = await loadProducts()
  const p = products.find((p) => p.id === id)
  if (!p) throw createError({ statusCode: 404, statusMessage: 'Produit introuvable.' })
  delete p.deleted
  delete p.deletedAt
  await saveProducts(products)
  return { success: true, restored: true }
})
