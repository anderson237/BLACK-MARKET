import { updateCommentIfOwner } from '~~/server/utils/storage'
import { requireAuth, rateLimit } from '~~/server/utils/auth'

// Client space: edit the text of one of your own comments.
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  rateLimit(20, 60_000)(event)
  const id = getRouterParam(event, 'id') || ''
  const body = await readBody(event)
  const text = String(body?.text || '').replace(/<[^>]*>/g, '').slice(0, 1000).trim()
  if (!text) throw createError({ statusCode: 400, statusMessage: 'Commentaire vide.' })
  const comment = await updateCommentIfOwner(id, String(session.userId || ''), text)
  if (!comment) throw createError({ statusCode: 404, statusMessage: 'Commentaire introuvable ou déjà supprimé.' })
  return { success: true, comment }
})
