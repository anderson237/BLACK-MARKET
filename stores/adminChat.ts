import { defineStore } from 'pinia'
import { useAuthStore } from './auth'
import { useSse } from '~~/composables/useSse'

// Admin-side chat state: all threads (preorders + orders), the unread badge
// count for the sidebar, and helpers used by /admin/carts and /admin/orders.
// Real-time: SSE pushes every thread change instantly; a fallback poll (2s
// when disconnected, 6s safety net when connected) covers instance splits.
export const useAdminChatStore = defineStore('adminChat', () => {
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
    if (!auth.isAuthed || auth.role !== 'admin') return
    if (loaded.value && !force) return
    loading.value = true
    try {
      const res = await fetch('/api/admin/chat/threads', { headers: headers() })
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
    if (!auth.isAuthed || auth.role !== 'admin') return
    sse = useSse(
      '/api/admin/chat/events',
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

  /** Lightweight badge poll kept for compatibility. */
  async function pollUnread() {
    if (!auth.isAuthed || auth.role !== 'admin') return
    try {
      const res = await fetch('/api/admin/chat/unread-count', { headers: headers() })
      const json = await res.json().catch(() => ({}))
      unread.value = Number(json.unread) || 0
    } catch {
      /* ignore */
    }
  }

  function threadFor(threadId: string) {
    return threads.value.find((t) => t.id === threadId) || null
  }

  function reset() {
    stopRealtime()
    threads.value = []
    unread.value = 0
    loaded.value = false
  }

  return { threads, unread, loaded, loading, sseConnected, load, refresh, pollUnread, startRealtime, stopRealtime, threadFor, reset }
})
