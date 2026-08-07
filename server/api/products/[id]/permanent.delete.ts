import { loadProducts, saveProducts } from '~~/server/utils/storage'
import { requireAuth } from '~~/server/utils/auth'
import { publishSiteUpdate } from '~~/server/utils/realtime'

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  if (session.role !== 'admin') throw createError({ statusCode: 403, statusMessage: 'Accès administrateur requis.' })
  const id = getRouterParam(event, 'id')
  const products = await loadProducts()
  const next = products.filter((p) => p.id !== id)
  if (next.length === products.length) throw createError({ statusCode: 404, statusMessage: 'Produit introuvable.' })
  await saveProducts(next)
  publishSiteUpdate('catalog')
  return { success: true, permanentlyDeleted: true }
})
