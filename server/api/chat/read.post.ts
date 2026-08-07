import { requireAuth } from '~~/server/utils/auth'
import { getThread, markClientRead } from '~~/server/utils/chat'

// Client marks a thread as read (updates clientReadTs) -> clears the badge.
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  const userId = session.userId || ''
  const body = await readBody(event).catch(() => ({}))
  const threadId = String(body?.threadId || '')
  if (!threadId) throw createError({ statusCode: 400, statusMessage: 'threadId requis.' })

  const thread = await getThread(threadId)
  if (!thread || thread.userId !== userId) {
    throw createError({ statusCode: 403, statusMessage: 'Discussion introuvable.' })
  }
  await markClientRead(threadId)
  return { success: true }
})
