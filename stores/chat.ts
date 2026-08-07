import { defineStore } from 'pinia'
import { useAuthStore } from './auth'

// Client-side chat state: threads (preorder + order), unread badge count,
// and a lightweight refresh used by /compte.
export const useChatStore = defineStore('chat', () => {
  const auth = useAuthStore()
  const threads = ref<any[]>([])
  const unread = ref(0)
  const loaded = ref(false)
  const loading = ref(false)

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

  function reset() {
    threads.value = []
    unread.value = 0
    loaded.value = false
  }

  return { threads, unread, loaded, loading, load, refresh, reset }
})
