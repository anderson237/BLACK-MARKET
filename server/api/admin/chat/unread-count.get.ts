import { requireAuth } from '~~/server/utils/auth'
import { getAllThreads, adminUnreadCount } from '~~/server/utils/chat'

// Lightweight badge count for the admin sidebar (total unread client messages).
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  if (session.role !== 'admin') throw createError({ statusCode: 403, statusMessage: 'Accès administrateur requis.' })
  const threads = await getAllThreads()
  const unread = threads.reduce((s, t) => s + adminUnreadCount(t, t.adminReadTs || 0), 0)
  return { success: true, unread }
})
