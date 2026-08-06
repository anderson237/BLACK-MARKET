import { loadProducts, attachSocialCounts } from '~~/server/utils/storage'

export default defineEventHandler(async (event) => {
  const products = (await loadProducts()).filter((p) => !p.deleted)
  const enriched = await attachSocialCounts(products)
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return enriched.length ? enriched : []
})