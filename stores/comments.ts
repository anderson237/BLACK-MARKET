import { defineStore } from 'pinia'

/**
 * Shared, reactive source of truth for per-product comment counts.
 * Both the card badge (ProductActions.vue) and the comment list
 * (ProductComments.vue) read from this store, so posting a comment
 * immediately updates every counter on the page (two-way sync).
 *
 * Also tracks the products the CURRENT visitor has commented on
 * (persisted in localStorage) so product cards can keep glowing
 * after a page reload.
 */
export const useCommentsStore = defineStore('comments', () => {
  const counts = ref<Record<string, number>>({})
  const loaded = ref<Record<string, boolean>>({})
  const commentedSet = ref<Set<string>>(new Set())
  // Module-scoped flag: read localStorage only once per client page load.
  let clientLoaded = false

  const STORAGE_KEY = 'bm_commented_v1'

  function load() {
    if (clientLoaded) return
    clientLoaded = true
    if (import.meta.client) {
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) {
          const parsed = JSON.parse(raw)
          commentedSet.value = new Set(Array.isArray(parsed?.ids) ? parsed.ids : [])
          return
        }
      } catch {}
    }
    if (!(commentedSet.value instanceof Set)) commentedSet.value = new Set()
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ids: [...commentedSet.value] }))
    } catch {}
  }

  function getCount(id: string): number {
    return counts.value[id] ?? 0
  }

  function hasCommented(id: string): boolean {
    load()
    return commentedSet.value.has(id)
  }

  function markCommented(id: string) {
    load()
    commentedSet.value.add(id)
    persist()
  }

  async function refresh(id: string): Promise<number> {
    try {
      const res = await fetch(`/api/products/${encodeURIComponent(id)}/comments`, {
        headers: { Accept: 'application/json' },
      })
      if (res.ok) {
        const data = await res.json()
        const count = Number(data?.count)
        counts.value[id] = Number.isFinite(count) && count > 0 ? count : (Array.isArray(data?.comments) ? data.comments.length : 0)
        loaded.value[id] = true
        return counts.value[id]
      }
    } catch { /* keep previous value */ }
    return counts.value[id] ?? 0
  }

  function bump(id: string, delta: number) {
    counts.value[id] = (counts.value[id] ?? 0) + delta
    loaded.value[id] = true
  }

  /**
   * Seeds a product's count from the SSR payload (product.commentCount) so the
   * server-rendered HTML already shows the real number instead of 0.
   */
  function seed(id: string, count: number) {
    if (counts.value[id] == null) counts.value[id] = Math.max(0, Number(count) || 0)
    loaded.value[id] = true
  }

  return { counts, loaded, getCount, refresh, bump, seed, hasCommented, markCommented }
})
