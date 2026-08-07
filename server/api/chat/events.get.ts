import { createEventStream } from 'h3'
import { requireAuth } from '~~/server/utils/auth'
import { subscribe } from '~~/server/utils/realtime'

// Real-time chat events for one client: the browser holds this connection
// open and receives a push the instant one of its threads changes, so new
// messages appear immediately (no 30s refresh).
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  const userId = session.userId || ''
  if (!userId) throw createError({ statusCode: 401, statusMessage: 'Session invalide.' })

  const stream = createEventStream(event)
  const unsub = subscribe(`user:${userId}`, (payload) => {
    stream.push(JSON.stringify(payload))
  })
  // Heartbeat keeps the connection alive through proxies/gateways.
  const hb = setInterval(() => {
    stream.push(JSON.stringify({ type: 'ping' }))
  }, 15_000)

  stream.onClosed(() => {
    clearInterval(hb)
    unsub()
  })

  return stream.send()
})
