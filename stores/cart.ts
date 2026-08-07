import { defineStore } from 'pinia'
import { useAuthStore } from '~/stores/auth'

export interface CartItem {
  productId: string
  title: string
  imageUrl?: string
  quantity: number
  priceXof: number
  priceEur?: number
  addedAt: string
}

/**
 * Server-persisted preorder basket (per user). "PRÉCOMMANDER" adds the product
 * here instead of opening WhatsApp; the client confirms the preorder later from
 * their dashboard, which is the moment the order is created + WhatsApp opens.
 */
export const useCartStore = defineStore('cart', () => {
  const items = ref<CartItem[]>([])
  const loaded = ref(false)
  const loading = ref(false)

  const auth = useAuthStore()

  const count = computed(() => items.value.reduce((s, c) => s + Number(c.quantity) || 0, 0))
  const totalXof = computed(() => items.value.reduce((s, c) => s + (Number(c.priceXof) || 0) * (Number(c.quantity) || 1), 0))

  async function load() {
    if (!auth.isAuthed || loaded.value) return
    loading.value = true
    try {
      const res = await fetch('/api/cart', { headers: { Accept: 'application/json', Authorization: `Bearer ${auth.token}` } })
      if (res.ok) {
        const json = await res.json().catch(() => ({}))
        items.value = Array.isArray(json?.cart) ? json.cart : []
        loaded.value = true
      }
    } catch {
      /* keep local */
    } finally {
      loading.value = false
    }
  }

  /** Add (or bump) a product in the basket. Fires a toast for instant feedback. */
  async function add(p: { productId: string; title: string; imageUrl?: string; priceXof: number; priceEur?: number; quantity?: number }) {
    if (!auth.isAuthed) {
      auth.requireAuth(() => add(p), 'Connectez-vous pour précommander ce drop')
      return
    }
    // optimistic local update
    const existing = items.value.find((c) => c.productId === p.productId)
    if (existing) {
      existing.quantity += Math.max(1, Number(p.quantity) || 1)
    } else {
      items.value.unshift({
        productId: p.productId,
        title: p.title,
        imageUrl: p.imageUrl,
        quantity: Math.max(1, Number(p.quantity) || 1),
        priceXof: Number(p.priceXof) || 0,
        priceEur: p.priceEur,
        addedAt: new Date().toISOString(),
      })
    }
    window.dispatchEvent(new CustomEvent('bm:copied', { detail: '✓ Ajouté à vos précommandes — à confirmer depuis votre espace client' }))

    try {
      const res = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
        body: JSON.stringify({
          productId: p.productId,
          title: p.title,
          imageUrl: p.imageUrl,
          quantity: Math.max(1, Number(p.quantity) || 1),
          priceXof: Number(p.priceXof) || 0,
          priceEur: p.priceEur || undefined,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (res.ok && Array.isArray(json?.cart)) items.value = json.cart
    } catch {
      /* optimistic value stays */
    }
  }

  async function remove(productId: string) {
    items.value = items.value.filter((c) => c.productId !== productId)
    try {
      await fetch(`/api/cart/${encodeURIComponent(productId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${auth.token}` },
      })
    } catch {
      /* ignore */
    }
  }

  async function clear() {
    const ids = [...new Set(items.value.map((c) => c.productId))]
    items.value = []
    try {
      await Promise.all(ids.map((id) =>
        fetch(`/api/cart/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${auth.token}` } }),
      ))
    } catch {
      /* ignore */
    }
  }

  function reset() {
    items.value = []
    loaded.value = false
  }

  // hydrate once the session exists
  watch(
    () => auth.isAuthed,
    (v) => {
      if (v) load()
    },
    { immediate: true },
  )

  return { items, loaded, loading, count, totalXof, load, add, remove, clear, reset }
})
