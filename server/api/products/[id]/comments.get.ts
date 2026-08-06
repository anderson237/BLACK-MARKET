import { getComments, getCommentCount, loadAccounts } from '~~/server/utils/storage'
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

  // Comments store a picture snapshot at post time; resolve each author's
  // CURRENT avatar so a profile update is reflected on every comment instantly
  // (falls back to the stored snapshot when no account is found).
  const accounts = await loadAccounts()
  const pictureByUser = new Map<string, string>()
  for (const a of accounts) pictureByUser.set(String(a.id), a.picture || '')

  const enriched = comments.map((c) => ({
    ...c,
    picture: pictureByUser.get(String(c.userId || '')) || c.picture || undefined,
    likedByMe: userId ? (c.likedBy || []).includes(userId) : false,
    dislikedByMe: userId ? (c.dislikedBy || []).includes(userId) : false,
    reportedByMe: userId ? (c.reportedBy || []).includes(userId) : false,
  }))
  return { success: true, comments: enriched, count }
})
