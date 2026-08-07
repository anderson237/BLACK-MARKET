import { createEventStream } from 'h3'
import { subscribe } from '~~/server/utils/realtime'

// Public real-time site events: the browser holds this connection open and
// receives a push the instant the catalog / orders / stats change, so the
// catalogue, product pages, the client space and the admin console can refresh
// instantly (no 15s wait, no manual reload).
// No auth required: it only broadcasts "something changed" hints, never data.
export default defineEventHandler(async (event) => {
  const stream = createEventStream(event)
  const unsub = subscribe('site', (payload) => {
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
