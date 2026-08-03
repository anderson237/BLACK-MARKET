import { loadProducts } from '~~/server/utils/storage'
import { requireAuth } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const products = await loadProducts()
  return { success: true, products }
})