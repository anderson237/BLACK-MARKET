import { getComments, getCommentCount } from '~~/server/utils/storage'
import { requireAuth } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const comments = await getComments(id)
  const count = await getCommentCount(id)

  // Optional auth: let the viewer know their own reaction state (best effort).
  let userId = ''
  try {
    const session = await requireAuth(event)
    userId = String(session.userId || '')
  } catch {
    /* public read: no token / invalid token is fine */
  }

  const enriched = comments.map((c) => ({
    ...c,
    likedByMe: userId ? (c.likedBy || []).includes(userId) : false,
    dislikedByMe: userId ? (c.dislikedBy || []).includes(userId) : false,
    reportedByMe: userId ? (c.reportedBy || []).includes(userId) : false,
  }))
  return { success: true, comments: enriched, count }
})
