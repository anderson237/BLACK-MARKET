import { reportComment } from '~~/server/utils/storage'
import { requireAuth, rateLimit } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  rateLimit(10, 60_000)(event)
  const id = getRouterParam(event, 'id') || ''
  const { comment, alreadyReported } = await reportComment(id, String(session.userId || ''))
  if (!comment) throw createError({ statusCode: 404, statusMessage: 'Commentaire introuvable.' })
  return { success: true, alreadyReported, comment }
})
