import { requireAuth } from '~~/server/utils/auth'
import { joSearch } from '~~/server/utils/justone'

// Admin import search (ST-017): query Xianyu or 1688 by keyword.
// Query: ?platform=xianyu|1688&keyword=...&page=...
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  if (session.role !== 'admin') throw createError({ statusCode: 403, statusMessage: 'Accès administrateur requis.' })
  const q = getQuery(event)
  const platform = String(q?.platform || 'xianyu') === '1688' ? '1688' : 'xianyu'
  const keyword = String(q?.keyword || '').trim()
  if (!keyword) throw createError({ statusCode: 400, statusMessage: 'Mot-clé de recherche manquant.' })
  const page = Math.max(1, Number(q?.page) || 1)
  const sort = String(q?.sort || 'active')

  const items = await joSearch(platform, keyword, page, sort)
  return { success: true, platform, keyword, page, items }
})