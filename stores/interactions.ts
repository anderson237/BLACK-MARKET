import { defineStore } from 'pinia'

export interface LikeState {
  liked: boolean
  count: number
}

/**
 * Interactions store, centralized on the server backend.
 * Likes are optimistic locally (instant UI + survives reload), while the true
 * count is authoritative on the server (`/api/products/:id/likes` ->
 * social.likes). `refreshCount` syncs the global total so every visitor sees
 * the same stats instead of a device-local number.
 */
export const useInteractionsStore = defineStore('interactions', () => {
  const likes = ref<Record<string, LikeState>>({})
  const likedSet = ref<Set<string>>(new Set())
  const initialized = ref(false)
  const refreshing = ref<Record<string, boolean>>({})

  function load() {
    if (initialized.value) return
    try {
      const raw = localStorage.getItem('bm_likes_v1')
      if (raw) {
        const parsed = JSON.parse(raw)
        likes.value = parsed.likes || {}
        likedSet.value = new Set(parsed.likedIds || [])
      }
    } catch {}
    initialized.value = true
  }

  function persist() {
    try {
      localStorage.setItem(
        'bm_likes_v1',
        JSON.stringify({
          likes: likes.value,
          likedIds: [...likedSet.value],
        }),
      )
    } catch {}
  }

  function getLike(id: string): LikeState {
    load()
    return likes.value[id] || { liked: likedSet.value.has(id), count: 0 }
  }

  async function refreshCount(id: string): Promise<number> {
    load()
    if (refreshing.value[id]) return likes.value[id]?.count ?? 0
    refreshing.value[id] = true
    try {
      const res = await fetch(`/api/products/${encodeURIComponent(id)}/likes`, {
        headers: { Accept: 'application/json' },
      })
      if (res.ok) {
        const data = await res.json()
        const count = Number(data?.count)
        if (Number.isFinite(count)) {
          likes.value[id] = { liked: likedSet.value.has(id), count }
        }
      }
    } catch {
      /* keep previous value */
    } finally {
      refreshing.value[id] = false
    }
    return likes.value[id]?.count ?? 0
  }

  function bounceLike(id: string, delta: number) {
    load()
    const cur = likes.value[id] || { liked: likedSet.value.has(id), count: 0 }
    likes.value[id] = { ...cur, count: Math.max(0, cur.count + delta) }
  }

  function toggleLike(id: string): LikeState {
    load()
    const cur = likes.value[id] || { liked: likedSet.value.has(id), count: 0 }
    const next: LikeState = {
      liked: !cur.liked,
      count: cur.count + (cur.liked ? -1 : 1),
    }
    likes.value[id] = next
    if (next.liked) likedSet.value.add(id)
    else likedSet.value.delete(id)
    persist()
    return next
  }

  return { likes, likedSet, getLike, toggleLike, bounceLike, refreshCount }
})
