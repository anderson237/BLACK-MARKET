import { loadProducts, saveProducts } from '~~/server/utils/storage'
import { requireAuth, rateLimit } from '~~/server/utils/auth'
import { sanitizeProduct } from '~~/server/utils/product'

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  rateLimit(30, 60_000)(event)
  const body = await readBody(event)
  if (!Array.isArray(body)) throw createError({ statusCode: 400, statusMessage: 'Le corps doit être un tableau de produits.' })
  if (body.length > 500) throw createError({ statusCode: 400, statusMessage: 'Trop de produits dans une seule requête (max 500).' })
  const products = body.map(sanitizeProduct)
  await saveProducts(products)
  return { success: true }
})