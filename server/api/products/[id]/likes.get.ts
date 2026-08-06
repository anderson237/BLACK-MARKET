import { getLikeCount, getLikeIndex } from '~~/server/utils/storage'
import { verifyToken, extractToken } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const count = await getLikeCount(id)
  // Whether the CURRENT visitor (when logged in) has liked this product —
  // authoritative, so the button state never depends on a device-local cache.
  let liked = false
  try {
    const session = await verifyToken(extractToken(event))
    if (session?.userId) {
      const { likedBy } = await getLikeIndex()
      liked = (likedBy[id] || []).includes(String(session.userId))
    }
  } catch {
    /* anonymous visitor */
  }
  return { success: true, count, liked }
})
