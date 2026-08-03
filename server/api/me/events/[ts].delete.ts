import { deleteUserEvent } from '~~/server/utils/storage'
import { requireAuth } from '~~/server/utils/auth'

// Client space: remove one of your own tracked events (view/click/like/share...).
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  const ts = Number(getRouterParam(event, 'ts') || '')
  if (!ts || !Number.isFinite(ts)) throw createError({ statusCode: 400, statusMessage: 'Événement invalide.' })
  const deleted = await deleteUserEvent(String(session.userId || ''), ts)
  if (!deleted) throw createError({ statusCode: 404, statusMessage: 'Événement introuvable ou déjà supprimé.' })
  return { success: true }
})
