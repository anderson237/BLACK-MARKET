import { requireAuth } from '~~/server/utils/auth'
import { deleteLocalPrice } from '~~/server/utils/storage'

// Admin local market price table (ST-017): delete one entry.
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  if (session.role !== 'admin') throw createError({ statusCode: 403, statusMessage: 'Accès administrateur requis.' })
  const id = String(getRouterParam(event, 'id') || '')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Identifiant manquant.' })
  const list = await deleteLocalPrice(id)
  return { success: true, prices: list }
})
