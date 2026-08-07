import { requireAuth } from '~~/server/utils/auth'
import { getThread, markAdminRead } from '~~/server/utils/chat'

// Admin marks a thread as read (updates adminReadTs) -> clears the badge.
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  if (session.role !== 'admin') throw createError({ statusCode: 403, statusMessage: 'Accès administrateur requis.' })

  const body = await readBody(event).catch(() => ({}))
  const threadId = String(body?.threadId || '')
  if (!threadId) throw createError({ statusCode: 400, statusMessage: 'threadId requis.' })

  const thread = await getThread(threadId)
  if (!thread) throw createError({ statusCode: 404, statusMessage: 'Discussion introuvable.' })
  await markAdminRead(threadId)
  return { success: true }
})
