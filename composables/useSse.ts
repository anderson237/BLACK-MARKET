// Client-side SSE over fetch. Native EventSource cannot send the
// Authorization header, so we use fetch + ReadableStream and parse the
// `data: ...` frames manually. Auto-reconnects with backoff (0.5s..5s) and
// stops permanently on 401 (bad token).
export function useSse(
  url: string,
  token: string,
  handlers: { onMessage: (data: any) => void; onOpen?: () => void; onClose?: () => void },
) {
  let controller: AbortController | null = null
  let stopped = false
  let retry = 0

  async function connect() {
    if (stopped || !token) return
    controller = new AbortController()
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      })
      if (res.status === 401) {
        stopped = true // token invalid, no point reconnecting
        return
      }
      if (!res.ok || !res.body) throw new Error(`SSE HTTP ${res.status}`)
      handlers.onOpen?.()
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
                handlers.onMessage(JSON.parse(line.slice(6)))
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
    handlers.onClose?.()
    if (!stopped) {
      retry = Math.min(retry + 1, 10)
      setTimeout(connect, 500 * retry)
    }
  }

  function stop() {
    stopped = true
    controller?.abort()
  }

  return { start: connect, stop }
}
