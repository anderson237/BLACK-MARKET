import { defineStore } from 'pinia'
import { useAuthStore } from './auth'
import { useSse } from '~~/composables/useSse'

// Client-side chat state: threads (preorder + order), unread badge count.
// Real-time: an SSE connection pushes the instant a thread changes (new
// message, read receipt) and a fast fallback poll (2s when disconnected,
// 6s as a safety net when connected) covers serverless instance splits.
export const useChatStore = defineStore('chat', () => {
  const auth = useAuthStore()
  const threads = ref<any[]>([])
  const unread = ref(0)
  const loaded = ref(false)
  const loading = ref(false)
  const sseConnected = ref(false)

  let sse: ReturnType<typeof useSse> | null = null
  let pollTimer: ReturnType<typeof setInterval> | null = null
  let refreshQueued = false

  function headers() {
    return { Accept: 'application/json', Authorization: `Bearer ${auth.token}` }
  }

  async function load(force = false) {
    if (!auth.isAuthed) return
    if (loaded.value && !force) return
    loading.value = true
    try {
      const res = await fetch('/api/chat/threads', { headers: headers() })
      const json = await res.json().catch(() => ({}))
      // N'écrase l'état que si les données ont réellement changé : évite les
      // re-renders inutiles du poll 2 s (et les micro-flashes associés).
      const nextThreads = Array.isArray(json.threads) ? json.threads : []
      const nextUnread = Number(json.unread) || 0
      if (JSON.stringify(nextThreads) !== JSON.stringify(threads.value) || nextUnread !== unread.value) {
        threads.value = nextThreads
        unread.value = nextUnread
      }
      loaded.value = true
    } catch {
      /* keep previous state */
    } finally {
      loading.value = false
    }
  }

  async function refresh() {
    loaded.value = false
    await load(true)
  }

  /** Debounce bursts of SSE events into a single refresh. */
  function queueRefresh() {
    if (refreshQueued) return
    refreshQueued = true
    setTimeout(() => {
      refreshQueued = false
      load(true)
    }, 250)
  }

  /** Open the real-time SSE connection + start the fallback poll. */
  function startRealtime() {
    stopRealtime()
    if (!auth.isAuthed) return
    sse = useSse(
      '/api/chat/events',
      auth.token,
      {
        onMessage: (data: any) => {
          if (data?.type === 'chat') queueRefresh()
        },
        onOpen: () => {
          sseConnected.value = true
        },
        onClose: () => {
          sseConnected.value = false
        },
      },
    )
    sse.start()
    // Fast fallback poll: guarantees a new message shows up within ~2s even
    // when the SSE push cannot cross serverless instances. The SSE push
    // delivers instantly when POST and connection share an instance.
    pollTimer = setInterval(() => {
      load(true)
    }, 2000)
  }

  function stopRealtime() {
    sse?.stop()
    sse = null
    sseConnected.value = false
    if (pollTimer) clearInterval(pollTimer)
    pollTimer = null
  }

  function reset() {
    stopRealtime()
    threads.value = []
    unread.value = 0
    loaded.value = false
  }

  return { threads, unread, loaded, loading, sseConnected, load, refresh, startRealtime, stopRealtime, reset }
})
