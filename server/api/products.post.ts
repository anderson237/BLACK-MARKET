import { loadProducts, saveProducts } from '~~/server/utils/storage'
import { requireAuth } from '~~/server/utils/auth'
import { sanitizeProduct } from '~~/server/utils/product'

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const body = await readBody(event)
  const product = sanitizeProduct(body)
  if (!product.title) throw createError({ statusCode: 400, statusMessage: 'Le produit doit avoir un titre.' })
  if (!product.id) {
    throw createError({ statusCode: 400, statusMessage: 'Identifiant produit manquant ou invalide (alphanumérique, tirets et underscores uniquement).' })
  }
  const products = await loadProducts()
  const idx = products.findIndex((p) => p.id === product.id)
  if (idx >= 0) products[idx] = product
  else products.unshift(product)
  await saveProducts(products)
  return { success: true }
})