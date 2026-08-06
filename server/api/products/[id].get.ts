import { loadProducts, attachSocialCounts } from '~~/server/utils/storage'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const products = await loadProducts()
  const p = products.find((pp) => pp.id === id && !pp.deleted)
  if (!p) throw createError({ statusCode: 404, statusMessage: 'Produit introuvable.' })
  const [enriched] = await attachSocialCounts([p])
  return { success: true, product: enriched }
})