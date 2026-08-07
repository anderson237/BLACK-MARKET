// Public site-wide real-time events. A single connection is opened per page
// (started once in app.vue) and forwards every "site" push as a window
// CustomEvent `bm:site` with `detail = { kind: 'catalog' | 'orders' | ... }`.
// Pages listen for the kinds they care about and refresh instantly, so the
// catalogue, product pages, the client space and the admin console update the
// moment something changes (no 15s wait, no manual reload).
// Auto-reconnects with backoff (0.5s..5s). No auth required.
export function useSiteEvents() {
  let controller: AbortController | null = null
  let stopped = false
  let retry = 0

  async function connect() {
    if (stopped) return
    controller = new AbortController()
    try {
      const res = await fetch('/api/events', { signal: controller.signal })
      if (!res.ok || !res.body) throw new Error(`SSE HTTP ${res.status}`)
      retry = 0
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let idx: number
        while ((idx = buffer.indexOf('\n\n')) >= 0) {
          const frame = buffer.slice(0, idx)
          buffer = buffer.slice(idx + 2)
          for (const line of frame.split('\n')) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))
                if (data?.type === 'site' && data?.kind) {
                  window.dispatchEvent(new CustomEvent('bm:site', { detail: { kind: data.kind, at: data.at } }))
                }
              } catch {
                /* ignore malformed frames (e.g. ping) */
              }
            }
          }
        }
      }
    } catch {
      /* connection dropped, schedule a retry */
    }
    if (!stopped) {
      retry = Math.min(retry + 1, 10)
      setTimeout(connect, 500 * retry)
    }
  }

  function start() {
    stop()
    stopped = false
    connect()
  }

  function stop() {
    stopped = true
    controller?.abort()
  }

  return { start, stop }
}
