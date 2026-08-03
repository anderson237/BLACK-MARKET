import { defineStore } from 'pinia'

export interface LikeState {
  liked: boolean
  count: number
}

/**
 * Local-first interaction store. Likes are instant (optimistic), persisted in
 * localStorage so the user's likes survive reloads. When the accounts backend
 * lands (Pilier 2/3), counts are synced per-user from /api/likes.
 */
export const useInteractionsStore = defineStore('interactions', () => {
  const likes = ref<Record<string, LikeState>>({})
  const likedSet = ref<Set<string>>(new Set())
  const initialized = ref(false)

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
    return likes.value[id] || { liked: false, count: 0 }
  }

  function toggleLike(id: string): LikeState {
    load()
    const cur = likes.value[id] || { liked: false, count: 0 }
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

  return { likes, likedSet, getLike, toggleLike }
})
