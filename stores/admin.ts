import { defineStore } from 'pinia'
import type { Product } from '~/types'
import { useAuthStore } from './auth'

interface AdminStats {
  totalProducts: number
  totalOrders: number
  totalClicks: number
  totalRevenueXof: number
  totalRevenueEur: number
  interactions: {
    views: number
    clicks: number
    likes: number
    shares: number
    copies: number
    unlikes: number
    comments: number
    events: number
  }
  salesByCategory: { category: string; orders: number; revenueXof: number }[]
  revenueSeries: { label: string; revenueXof: number; revenueEur: number; orders: number }[]
  clickSeries: { label: string; clicks: number }[]
  topProducts: { id: string; title: string; imageUrl: string; clicks: number; revenueXof: number; revenueEur: number }[]
  analytics: {
    totalUsers: number
    engagedUsers: number
    products: {
      viewed: TopItem[]
      clicked: TopItem[]
      liked: TopItem[]
      commented: TopItem[]
      preordered: TopItem[]
      whatsapp: TopItem[]
    }
    users: {
      likers: TopUser[]
      commenters: TopUser[]
      preorders: TopUser[]
      viewers: TopUser[]
      sharers: TopUser[]
      engaged: TopUser[]
    }
  }
}

interface TopItem {
  id: string
  title: string
  imageUrl: string
  count: number
}

interface TopUser {
  id: string
  name: string
  pseudo: string
  picture: string
  count: number
}

export interface AdminOrder {
  id: string
  productId: string
  productTitle: string
  productImage: string
  customerName: string
  customerPhone: string
  customerLocation: string
  quantity: number
  priceXof: number
  priceEur: number
  status: 'pending' | 'processing' | 'completed' | 'shipped' | 'cancelled'
  createdAt: string
}

export interface AdminCustomer {
  id: string
  name?: string
  email?: string
  phone?: string
  phonePrefix?: string
  country?: string
  provider?: string
  picture?: string
  role?: string
  status?: string
  createdAt?: string
  lastLoginAt?: string
}

/**
 * Shared admin data store. Attaches the admin JWT to every request so the
 * auth-gated routes (/api/products, /api/orders, /api/stats, ...) work.
 */
export const useAdminStore = defineStore('admin', () => {
  const auth = useAuthStore()
  const products = ref<Product[]>([])
  const orders = ref<AdminOrder[]>([])
  const trashOrders = ref<AdminOrder[]>([])
  const customers = ref<AdminCustomer[]>([])
  const stats = ref<AdminStats | null>(null)
  const admins = ref<string[]>([])

  interface AdminUsers {
    owner?: string
    admins?: string[]
    currentEmail?: string
    logins?: any[]
  }
  const users = ref<AdminUsers>({})

  const loaded = ref(false)
  const loading = ref(false)
  const authError = ref('')

  function headers(extra: Record<string, string> = {}) {
    return {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(auth.token ? { Authorization: `Bearer ${auth.token}` } : {}),
      ...extra,
    }
  }

  function isAdmin() {
    return auth.isAuthed && auth.role === 'admin'
  }

  async function loadProducts() {
    if (!isAdmin()) return
    if (loaded.value) return
    loading.value = true
    authError.value = ''
    try {
      const res = await fetch('/api/products', { headers: headers() })
      if (res.status === 401) {
        authError.value = 'Session expirée ou invalide.'
        products.value = []
        return
      }
      if (!res.ok) throw new Error(String(res.status))
      const json = await res.json()
      products.value = Array.isArray(json?.products) ? json.products : []
      loaded.value = true
    } catch (e: any) {
      authError.value = e?.message || 'Impossible de charger le catalogue.'
    } finally {
      loading.value = false
    }
  }

  async function loadOrders() {
    if (!isAdmin()) return
    try {
      const res = await fetch('/api/orders', { headers: headers() })
      if (!res.ok) throw new Error(String(res.status))
      const json = await res.json()
      orders.value = Array.isArray(json?.orders) ? json.orders : []
      trashOrders.value = Array.isArray(json?.trash) ? json.trash : []
    } catch (e: any) {
      authError.value = e?.message || 'Impossible de charger les commandes.'
    }
  }

  async function loadStats() {
    if (!isAdmin()) return
    try {
      const res = await fetch('/api/stats', { headers: headers() })
      if (!res.ok) throw new Error(String(res.status))
      const json = await res.json()
      stats.value = json?.stats || null
    } catch (e: any) {
      authError.value = e?.message || 'Impossible de charger les statistiques.'
    }
  }

  async function loadCustomers() {
    if (!isAdmin()) return
    try {
      const res = await fetch('/api/customers', { headers: headers() })
      if (!res.ok) throw new Error(String(res.status))
      const json = await res.json()
      customers.value = Array.isArray(json?.customers) ? json.customers : []
    } catch (e: any) {
      authError.value = e?.message || 'Impossible de charger les clients.'
    }
  }

  async function loadAdmins() {
    if (!isAdmin()) return
    try {
      const res = await fetch('/api/auth/admins', { headers: headers() })
      if (!res.ok) throw new Error(String(res.status))
      const json = await res.json()
      admins.value = Array.isArray(json?.admins) ? json.admins : []
    } catch (e: any) {
      authError.value = e?.message || 'Impossible de charger les administrateurs.'
    }
  }

  async function loadUsers() {
    if (!isAdmin()) return
    try {
      const res = await fetch('/api/users', { headers: headers() })
      if (!res.ok) throw new Error(String(res.status))
      const json = await res.json()
      users.value = json?.users || {}
      admins.value = Array.isArray(users.value?.admins) ? users.value.admins : []
    } catch (e: any) {
      authError.value = e?.message || 'Impossible de charger les utilisateurs.'
    }
  }

  /** Permanently delete a customer account (any provider: Google, email, phone). */
  async function deleteUser(id: string) {
    const res = await fetch(`/api/users/${encodeURIComponent(id)}`, { method: 'DELETE', headers: headers() })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      throw new Error(j?.statusMessage || `Erreur ${res.status}`)
    }
    await loadUsers()
  }

  async function saveAdmins(list: string[]) {
    const res = await fetch('/api/users/admins', {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify({ admins: list }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      throw new Error(j?.statusMessage || `Erreur ${res.status}`)
    }
    const json = await res.json().catch(() => ({ admins: list }))
    admins.value = Array.isArray(json?.admins) ? json.admins : list
    users.value = { ...users.value, admins: admins.value }
    return admins.value
  }

  async function createOrder(body: Partial<AdminOrder>) {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      throw new Error(j?.statusMessage || j?.error || `Erreur ${res.status}`)
    }
    const json = await res.json().catch(() => ({ order: body }))
    const order = json?.order || json?.lead || body
    orders.value.unshift(order)
    return order
  }

  async function updateOrderStatus(id: string, status: AdminOrder['status']) {
    const res = await fetch(`/api/orders/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify({ status }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      throw new Error(j?.statusMessage || `Erreur ${res.status}`)
    }
    const idx = orders.value.findIndex((o) => o.id === id)
    if (idx >= 0) orders.value[idx] = { ...orders.value[idx], status }
  }

  async function deleteOrder(id: string) {
    const res = await fetch(`/api/orders/${encodeURIComponent(id)}`, { method: 'DELETE', headers: headers() })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      throw new Error(j?.statusMessage || `Erreur ${res.status}`)
    }
    const j = await res.json().catch(() => ({}))
    const trashed = j?.trashed
    const order = orders.value.find((o) => o.id === id)
    orders.value = orders.value.filter((o) => o.id !== id)
    if (trashed && order) {
      trashOrders.value.unshift({ ...order, deleted: true, deletedAt: new Date().toISOString() })
    }
    // Keep the dashboard KPI (Commandes / Revenu) in sync right away, not only
    // on the 12s timer or the intra-instance SSE push.
    await loadStats().catch(() => {})
  }

  /** Restore a soft-deleted order from the admin trash. */
  async function restoreOrder(id: string) {
    const res = await fetch(`/api/orders/${encodeURIComponent(id)}/restore`, { method: 'POST', headers: headers() })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      throw new Error(j?.statusMessage || `Erreur ${res.status}`)
    }
    const restored = trashOrders.value.find((o) => o.id === id)
    trashOrders.value = trashOrders.value.filter((o) => o.id !== id)
    if (restored) {
      const clean = { ...restored }
      delete clean.deleted
      delete clean.deletedAt
      orders.value.unshift(clean)
    }
    await loadStats().catch(() => {})
  }

  /** Permanently purge an order (no way back). */
  async function deleteOrderPermanent(id: string) {
    const res = await fetch(`/api/orders/${encodeURIComponent(id)}/permanent`, { method: 'DELETE', headers: headers() })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      throw new Error(j?.statusMessage || `Erreur ${res.status}`)
    }
    trashOrders.value = trashOrders.value.filter((o) => o.id !== id)
    await loadStats().catch(() => {})
  }

  async function createProduct(body: Product) {
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      throw new Error(j?.error || `Erreur ${res.status}`)
    }
    const saved = await res.json().catch(() => body)
    products.value.unshift(saved?.product || saved || body)
    return saved?.product || saved || body
  }

  async function updateProduct(body: Product) {
    const list = products.value.map((p) => (p.id === body.id ? body : p))
    const res = await fetch('/api/products', {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(list),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      throw new Error(j?.error || `Erreur ${res.status}`)
    }
    products.value = list
    return body
  }

  async function deleteProduct(id: string) {
    const res = await fetch('/api/products/' + encodeURIComponent(id), { method: 'DELETE', headers: headers() })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      throw new Error(j?.error || `Erreur ${res.status}`)
    }
    // Soft delete -> move to trash.
    products.value = products.value.map((p) => (p.id === id ? { ...p, deleted: true, deletedAt: new Date().toISOString() } as any : p))
  }

  async function restoreProduct(id: string) {
    const res = await fetch(`/api/products/${encodeURIComponent(id)}/restore`, { method: 'POST', headers: headers() })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      throw new Error(j?.statusMessage || j?.error || `Erreur ${res.status}`)
    }
    products.value = products.value.map((p) => {
      if (p.id !== id) return p
      const { deleted, deletedAt, ...rest } = p as any
      return rest
    })
  }

  async function permanentDeleteProduct(id: string) {
    const res = await fetch(`/api/products/${encodeURIComponent(id)}/permanent`, { method: 'DELETE', headers: headers() })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      throw new Error(j?.statusMessage || j?.error || `Erreur ${res.status}`)
    }
    products.value = products.value.filter((p) => p.id !== id)
  }

  const trashProducts = computed(() => (products.value as any[]).filter((p) => p.deleted))
  const activeProducts = computed(() => (products.value as any[]).filter((p) => !p.deleted))

  function refresh() {
    loaded.value = false
    products.value = []
    orders.value = []
    customers.value = []
    stats.value = null
  }

  return {
    products, orders, customers, stats, admins, users,
    trashProducts, activeProducts, trashOrders,
    loaded, loading, authError,
    isAdmin, headers,
    loadProducts, loadOrders, loadStats, loadCustomers, loadAdmins, loadUsers,
    saveAdmins, deleteUser,
    updateOrderStatus, deleteOrder, createOrder, restoreOrder, deleteOrderPermanent,
    createProduct, updateProduct, deleteProduct, restoreProduct, permanentDeleteProduct,
    refresh,
  }
})
