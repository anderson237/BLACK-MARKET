import { defineStore } from 'pinia'
import { useAuthStore } from './auth'

// Admin-side chat state: all threads (preorders + orders), the unread badge
// count for the sidebar, and helpers used by /admin/carts and /admin/orders.
export const useAdminChatStore = defineStore('adminChat', () => {
  const auth = useAuthStore()
  const threads = ref<any[]>([])
  const unread = ref(0)
  const loaded = ref(false)
  const loading = ref(false)

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
      threads.value = Array.isArray(json.threads) ? json.threads : []
      unread.value = Number(json.unread) || 0
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

  /** Lightweight badge poll for the admin layout sidebar. */
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
    threads.value = []
    unread.value = 0
    loaded.value = false
  }

  return { threads, unread, loaded, loading, load, refresh, pollUnread, threadFor, reset }
})
