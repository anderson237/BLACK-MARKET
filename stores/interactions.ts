import { defineStore } from 'pinia'
import { useAuthStore } from '~/stores/auth'

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
  // Module-scoped (never serialized into the SSR payload): forces a fresh
  // localStorage read on every client page load, while SSR keeps its state.
  let clientLoaded = false
  const refreshing = ref<Record<string, boolean>>({})
  // Timestamp of the last local toggle per product: the optimistic value must
  // not be clobbered by a stale server read arriving right after the click.
  const lastLocal = ref<Record<string, number>>({})

  function load() {
    if (clientLoaded) return
    clientLoaded = true
    if (import.meta.client) {
      try {
        const raw = localStorage.getItem('bm_likes_v1')
        if (raw) {
          const parsed = JSON.parse(raw)
          likes.value = parsed.likes || {}
          likedSet.value = new Set(parsed.likedIds || [])
          return
        }
      } catch {}
    }
    // SSR or no local data: keep whatever was seeded, but guarantee a real Set.
    if (!(likedSet.value instanceof Set)) likedSet.value = new Set()
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
    // Cooldown: right after a local like/unlike, the /api/events POST may not
    // have reached the server yet — an immediate refresh would show a stale
    // (pre-click) count and override the optimistic value.
    if (Date.now() - (lastLocal.value[id] || 0) < 800) return likes.value[id]?.count ?? 0
    refreshing.value[id] = true
    try {
      const auth = useAuthStore()
      const headers: Record<string, string> = { Accept: 'application/json' }
      if (auth.token) headers.Authorization = `Bearer ${auth.token}`
      const res = await fetch(`/api/products/${encodeURIComponent(id)}/likes`, { headers })
      if (res.ok) {
        const data = await res.json()
        const count = Number(data?.count)
        if (Number.isFinite(count)) {
          // Server truth for the COUNT; for the "liked" STATE we keep the local
          // optimistic value unless the server positively confirms the like:
          // if the like POST was dropped (blob contention, refresh right after
          // the click…) the server would answer liked:false and switching the
          // button off on every reload would break the expected persistence.
          const localLiked = likedSet.value.has(id)
          const liked = data?.liked === true || localLiked
          likes.value[id] = { liked, count }
          if (liked) likedSet.value.add(id)
          else likedSet.value.delete(id)
          persist()
          // Repair a dropped like: the visitor DID like (local memory) but the
          // server doesn't know yet (the /api/events POST never landed, e.g.
          // reload right after the click). Re-send it — the server is now
          // idempotent per user so this can never double-count. Only when a
          // session exists, otherwise the server can't attribute the like.
          if (localLiked && data?.liked !== true && auth.token) {
            await fetch('/api/events', {
              method: 'POST',
              headers: { ...headers, 'Content-Type': 'application/json' },
              body: JSON.stringify({ type: 'like', productId: id, url: window.location.pathname }),
              keepalive: true,
            }).catch(() => {})
          }
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

  /**
   * Seeds a product's count from the SSR payload (product.likeCount) so the
   * very first paint — including the server-rendered HTML — already shows the
   * real centralized number instead of 0. Never overrides a locally toggled
   * value.
   */
  function seed(id: string, count: number) {
    load()
    const cur = likes.value[id]
    if (cur) return
    likes.value[id] = { liked: likedSet.value.has(id), count: Math.max(0, Number(count) || 0) }
  }

  function toggleLike(id: string): LikeState {
    load()
    const cur = likes.value[id] || { liked: likedSet.value.has(id), count: 0 }
    const next: LikeState = {
      liked: !cur.liked,
      // Never go below 0 (an unlike on a yet-unsynced count must not show -1).
      count: Math.max(0, cur.count + (cur.liked ? -1 : 1)),
    }
    likes.value[id] = next
    if (next.liked) likedSet.value.add(id)
    else likedSet.value.delete(id)
    lastLocal.value[id] = Date.now()
    persist()
    return next
  }

  return { likes, likedSet, getLike, toggleLike, bounceLike, seed, refreshCount }
})
