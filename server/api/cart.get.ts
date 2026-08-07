import { loadCart } from '~~/server/utils/storage'
import { requireAuth } from '~~/server/utils/auth'

// Returns the authenticated user's preorder basket (server-persisted).
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  const cart = await loadCart(session.userId)
  return { success: true, cart }
})
