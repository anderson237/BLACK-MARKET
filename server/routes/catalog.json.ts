import { loadProducts } from '~~/server/utils/storage'

export default defineEventHandler(async (event) => {
  const products = (await loadProducts()).filter((p) => !p.deleted)
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return products.length ? products : []
})