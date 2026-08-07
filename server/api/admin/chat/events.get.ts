import { createEventStream } from 'h3'
import { requireAuth } from '~~/server/utils/auth'
import { subscribe } from '~~/server/utils/realtime'

// Real-time chat events for the admin console: every thread change (client
// message, read receipt, migration) is pushed instantly so the badge and the
// open chat panels update without polling.
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  if (session.role !== 'admin') throw createError({ statusCode: 403, statusMessage: 'Accès administrateur requis.' })

  const stream = createEventStream(event)
  const unsub = subscribe('admin', (payload) => {
    stream.push(JSON.stringify(payload))
  })
  const hb = setInterval(() => {
    stream.push(JSON.stringify({ type: 'ping' }))
  }, 15_000)

  stream.onClosed(() => {
    clearInterval(hb)
    unsub()
  })

  return stream.send()
})
