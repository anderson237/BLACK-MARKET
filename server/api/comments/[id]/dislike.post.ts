import { toggleCommentReaction } from '~~/server/utils/storage'
import { requireAuth, rateLimit } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  rateLimit(30, 60_000)(event)
  const id = getRouterParam(event, 'id') || ''
  const comment = await toggleCommentReaction(id, String(session.userId || ''), 'dislike')
  if (!comment) throw createError({ statusCode: 404, statusMessage: 'Commentaire introuvable.' })
  return { success: true, comment }
})
