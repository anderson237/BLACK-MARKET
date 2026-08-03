import { deleteCommentIfOwner } from '~~/server/utils/storage'
import { requireAuth } from '~~/server/utils/auth'

// Client space: delete one of your own comments.
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  const id = getRouterParam(event, 'id') || ''
  const deleted = await deleteCommentIfOwner(id, String(session.userId || ''))
  if (!deleted) throw createError({ statusCode: 404, statusMessage: 'Commentaire introuvable ou déjà supprimé.' })
  return { success: true }
})
