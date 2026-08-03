<script setup lang="ts">
import { formatPriceXof } from '~/composables/useCatalog'
import { useAuthStore } from '~/stores/auth'

definePageMeta({ layout: 'admin' })

const store = useAdminStore()

onMounted(async () => {
  await Promise.all([store.loadStats(), store.loadOrders(), store.loadCustomers()])
})

const resetting = ref(false)
async function resetStats() {
  if (!window.confirm('Remettre à ZÉRO les stats de tous les utilisateurs (vues, précommandes, likes, partages, commentaires) ? Les produits et commandes sont conservés.')) return
  resetting.value = true
  try {
    const auth = useAuthStore()
    const res = await fetch('/api/admin/stats/reset', {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth.token}` },
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data?.statusMessage || `Erreur ${res.status}`)
    await store.loadStats()
  } catch (e: any) {
    window.alert(e?.message || 'Erreur lors de la réinitialisation.')
  } finally {
    resetting.value = false
  }
}

const CATEGORY_COLORS = ['#ff2a2a', '#f59e0b', '#22d3ee', '#a78bfa', '#34d399', '#fb7185', '#facc15', '#818cf8']

const formatMoney = (v: number) => Number(v || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' F'

const stats = computed(() => store.stats)
const revenue = computed(() => stats.value?.totalRevenueXof ?? 0)
const totalOrders = computed(() => stats.value?.totalOrders ?? 0)
const totalClicks = computed(() => stats.value?.totalClicks ?? 0)
const totalProducts = computed(() => stats.value?.totalProducts ?? 0)

/* ---------------- Revenue area chart ---------------- */
const AREA = { W: 620, H: 210, PAD_L: 66, PAD_R: 10, PAD_T: 12, PAD_B: 26 }
const area = computed(() => {
  const series = stats.value?.revenueSeries || []
  const { W, H, PAD_L, PAD_R, PAD_T, PAD_B } = AREA
  const innerW = W - PAD_L - PAD_R
  const innerH = H - PAD_T - PAD_B
  const max = Math.max(1, ...series.map((d) => d.revenueXof))
  const n = series.length
  const pts = series.map((d, i) => ({
    label: d.label,
    x: PAD_L + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW),
    y: PAD_T + innerH - (d.revenueXof / max) * innerH,
  }))
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const baseY = PAD_T + innerH
  const first = pts[0]?.x ?? PAD_L
  const last = pts[pts.length - 1]?.x ?? PAD_L + innerW
  const fill = `${line} L${last.toFixed(1)},${baseY} L${first.toFixed(1)},${baseY} Z`
  const ticks = [0, 1, 2, 3, 4].map((k) => ({
    y: PAD_T + innerH - (k / 4) * innerH,
    label: formatMoney((max * k) / 4),
  }))
  return { pts, line, fill, ticks }
})

/* ---------------- Category donut ---------------- */
const donut = computed(() => {
  const data = stats.value?.salesByCategory || []
  const entries = data.length
    ? data.map((c) => ({ category: c.category, orders: c.orders }))
    : [{ category: 'Aucune vente', orders: 1 }]
  const total = entries.reduce((s, c) => s + c.orders, 0) || 1
  const R = 62
  const C = 2 * Math.PI * R
  let acc = 0
  return entries.map((c, i) => {
    const frac = c.orders / total
    const seg = {
      ...c,
      color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
      dash: `${(frac * C).toFixed(2)} ${(C - frac * C).toFixed(2)}`,
      offset: (-acc * C).toFixed(2),
      frac,
    }
    acc += frac
    return seg
  })
})
const donutTotal = computed(() => donut.value.reduce((s, c) => s + c.orders, 0))

/* ---------------- Top products (horizontal bars) ---------------- */
const topProd = computed(() =>
  (stats.value?.topProducts || [])
    .slice(0, 6)
    .map((p) => ({
      ...p,
      short: p.title.length > 24 ? p.title.slice(0, 24) + '…' : p.title,
    })),
)
const barMax = computed(() => Math.max(1, ...topProd.value.map((p) => p.clicks)))

/* ---------------- Recent orders ---------------- */
const recentOrders = computed(() =>
  [...store.orders]
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, 6),
)

const statusLabel: Record<string, string> = {
  pending: 'En attente',
  processing: 'En traitement',
  shipped: 'Expédiée',
  completed: 'Terminée',
  cancelled: 'Annulée',
}
const statusClass: Record<string, string> = {
  completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  cancelled: 'bg-red-500/10 text-red-400 border-red-500/30',
  processing: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
  shipped: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
}

const fmtShortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })

const trends = {
  revenue: { up: true, value: '+12.4%' },
  orders: { up: true, value: '+8.2%' },
  clicks: { up: true, value: '+15.7%' },
  products: { up: false, value: '-2.1%' },
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <p class="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Vue d'ensemble</p>
      <button @click="resetStats" :disabled="resetting"
        class="text-[10px] font-mono text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-500/60 px-3 py-1.5 rounded-xl transition-all disabled:opacity-50">
        {{ resetting ? 'Réinitialisation…' : 'Réinitialiser les stats' }}
      </button>
    </div>
    <!-- KPI Widgets -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div v-if="stats" class="bg-[#0d0d14] rounded-2xl p-5 border border-zinc-800 space-y-3 relative overflow-hidden group hover:border-[#ff2a2a]/40 transition-all">
        <div class="flex items-center justify-between">
          <span class="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Revenu Total</span>
          <div class="w-9 h-9 rounded-xl flex items-center justify-center" style="background: rgba(255,42,42,0.12); color: #facc15">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
            </svg>
          </div>
        </div>
        <div>
          <h4 class="text-2xl font-black font-mono text-white leading-none">{{ formatMoney(revenue) }}</h4>
          <div class="flex items-center gap-2 mt-2">
            <span class="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border"
              :class="trends.revenue.up ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M7 7h10v10" /><path d="M7 17 17 7" />
              </svg>
              {{ trends.revenue.value }}
            </span>
            <span class="text-[9px] font-mono text-zinc-500">Toutes commandes</span>
          </div>
        </div>
      </div>

      <div v-if="stats" class="bg-[#0d0d14] rounded-2xl p-5 border border-zinc-800 space-y-3 relative overflow-hidden group hover:border-[#ff2a2a]/40 transition-all">
        <div class="flex items-center justify-between">
          <span class="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Commandes</span>
          <div class="w-9 h-9 rounded-xl flex items-center justify-center" style="background: rgba(255,42,42,0.12); color: #ff2a2a">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
          </div>
        </div>
        <div>
          <h4 class="text-2xl font-black font-mono text-white leading-none">{{ totalOrders }}</h4>
          <div class="flex items-center gap-2 mt-2">
            <span class="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border"
              :class="trends.orders.up ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M7 7h10v10" /><path d="M7 17 17 7" />
              </svg>
              {{ trends.orders.value }}
            </span>
            <span class="text-[9px] font-mono text-zinc-500">Enregistrées</span>
          </div>
        </div>
      </div>

      <div v-if="stats" class="bg-[#0d0d14] rounded-2xl p-5 border border-zinc-800 space-y-3 relative overflow-hidden group hover:border-[#ff2a2a]/40 transition-all">
        <div class="flex items-center justify-between">
          <span class="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Intérêt WhatsApp</span>
          <div class="w-9 h-9 rounded-xl flex items-center justify-center" style="background: rgba(255,42,42,0.12); color: #34d399">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m9 9 5 12 1.8-5.2L21 14Z" /><path d="M7.2 2.2 8 5.1" /><path d="m5.1 8 -2.9 -.8" /><path d="M14 4.1 12 6" /><path d="m6 12 -1.9 2" />
            </svg>
          </div>
        </div>
        <div>
          <h4 class="text-2xl font-black font-mono text-white leading-none">{{ totalClicks }}</h4>
          <div class="flex items-center gap-2 mt-2">
            <span class="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border"
              :class="trends.clicks.up ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M7 7h10v10" /><path d="M7 17 17 7" />
              </svg>
              {{ trends.clicks.value }}
            </span>
            <span class="text-[9px] font-mono text-zinc-500">Clics PRÉCOMMANDER</span>
          </div>
        </div>
      </div>

      <div v-if="stats" class="bg-[#0d0d14] rounded-2xl p-5 border border-zinc-800 space-y-3 relative overflow-hidden group hover:border-[#ff2a2a]/40 transition-all">
        <div class="flex items-center justify-between">
          <span class="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Produits</span>
          <div class="w-9 h-9 rounded-xl flex items-center justify-center" style="background: rgba(255,42,42,0.12); color: #22d3ee">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m7.5 4.27 9 5.15" /><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" />
            </svg>
          </div>
        </div>
        <div>
          <h4 class="text-2xl font-black font-mono text-white leading-none">{{ totalProducts }}</h4>
          <div class="flex items-center gap-2 mt-2">
            <span class="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border"
              :class="trends.products.up ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="m7 7 10 10" /><path d="M17 7v10H7" />
              </svg>
              {{ trends.products.value }}
            </span>
            <span class="text-[9px] font-mono text-zinc-500">Au catalogue</span>
          </div>
        </div>
      </div>

      <div v-if="!stats" v-for="n in 4" :key="n" class="skeleton h-32 rounded-2xl" />
    </div>

    <!-- Revenue Area Chart + Sale by category -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div class="lg:col-span-2 bg-[#0d0d14] rounded-2xl p-5 border border-zinc-800">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h3 class="text-sm font-extrabold text-white font-mono uppercase tracking-wider">REVENU DES 7 DERNIERS JOURS</h3>
            <p class="text-[10px] font-mono text-zinc-500">Suivi des ventes (F CFA)</p>
          </div>
          <span class="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-1 rounded-full flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" />
            </svg>
            +2.8%
          </span>
        </div>
        <div class="h-64">
          <svg v-if="area.pts.length" :viewBox="`0 0 ${AREA.W} ${AREA.H}`" class="w-full h-full" preserveAspectRatio="none">
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#ff2a2a" stop-opacity="0.35" />
                <stop offset="100%" stop-color="#ff2a2a" stop-opacity="0" />
              </linearGradient>
            </defs>
            <g v-for="t in area.ticks" :key="t.y">
              <line :x1="AREA.PAD_L" :x2="AREA.W - AREA.PAD_R" :y1="t.y" :y2="t.y" stroke="#1f1f2b" stroke-dasharray="3 3" />
              <text :x="AREA.PAD_L - 6" :y="t.y + 3" text-anchor="end" fill="#71717a" font-size="10" font-family="monospace">{{ t.label }}</text>
            </g>
            <path :d="area.fill" fill="url(#colorRevenue)" />
            <path :d="area.line" fill="none" stroke="#ff2a2a" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
            <circle v-for="p in area.pts" :key="p.label" :cx="p.x" :cy="p.y" r="3" fill="#ff2a2a" />
            <text v-for="p in area.pts" :key="'l' + p.label" :x="p.x" :y="AREA.H - 8" text-anchor="middle" fill="#71717a" font-size="10" font-family="monospace">{{ p.label }}</text>
          </svg>
          <div v-else class="h-full grid place-items-center text-zinc-600 font-mono text-[11px]">Aucune donnée</div>
        </div>
      </div>

      <div class="bg-[#0d0d14] rounded-2xl p-5 border border-zinc-800">
        <h3 class="text-sm font-extrabold text-white font-mono uppercase tracking-wider mb-4">VENTES PAR CATÉGORIE</h3>
        <div class="h-48 relative">
          <svg viewBox="0 0 160 160" class="w-full h-full">
            <g transform="rotate(-90 80 80)">
              <circle cx="80" cy="80" :r="62" fill="none" stroke="#1f1f2b" stroke-width="26" />
              <circle
                v-for="s in donut"
                :key="s.category"
                cx="80" cy="80" :r="62" fill="none"
                :stroke="s.color" stroke-width="26"
                :stroke-dasharray="s.dash" :stroke-dashoffset="s.offset"
                stroke-linecap="butt"
              />
            </g>
            <text x="80" y="76" text-anchor="middle" fill="#fff" font-size="20" font-weight="900" font-family="monospace">{{ donutTotal }}</text>
            <text x="80" y="92" text-anchor="middle" fill="#71717a" font-size="8" font-family="monospace">COMMANDES</text>
          </svg>
        </div>
        <div class="mt-2 space-y-1.5 max-h-28 overflow-y-auto pr-1">
          <div v-for="(c, i) in donut" :key="c.category" class="flex items-center justify-between text-[10px] font-mono">
            <span class="flex items-center gap-1.5 text-zinc-400">
              <span class="w-2 h-2 rounded-full" :style="{ background: c.color }" />
              {{ c.category }}
            </span>
            <span class="text-zinc-200 font-bold">{{ c.orders }} cmd</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Top products + Recent orders -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div class="bg-[#0d0d14] rounded-2xl p-5 border border-zinc-800">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-sm font-extrabold text-white font-mono uppercase tracking-wider">TOP PRODUITS</h3>
          <NuxtLink to="/admin/catalog" class="text-[10px] font-mono text-[#ff2a2a] hover:underline">Tout voir</NuxtLink>
        </div>
        <div class="h-52">
          <div v-if="topProd.length" class="h-full flex flex-col justify-between">
            <div v-for="p in topProd" :key="p.id" class="flex items-center gap-2">
              <span class="w-[118px] shrink-0 text-[9px] font-mono text-zinc-400 truncate text-right">{{ p.short }}</span>
              <div class="flex-1 h-3.5 bg-zinc-900 rounded-sm overflow-hidden">
                <div class="h-full rounded-sm" :style="{ width: (p.clicks / barMax) * 100 + '%', background: '#ff2a2a' }" />
              </div>
              <span class="w-8 shrink-0 text-[9px] font-mono text-zinc-300 font-bold text-right">{{ p.clicks }}</span>
            </div>
          </div>
          <div v-else class="h-full grid place-items-center text-zinc-600 font-mono text-[11px]">Aucune donnée</div>
        </div>
      </div>

      <div class="lg:col-span-2 bg-[#0d0d14] rounded-2xl p-5 border border-zinc-800">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-sm font-extrabold text-white font-mono uppercase tracking-wider">COMMANDES RÉCENTES</h3>
          <NuxtLink to="/admin/orders" class="text-[10px] font-mono text-[#ff2a2a] hover:underline">Tout voir</NuxtLink>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left">
            <thead>
              <tr class="text-[9px] font-mono uppercase tracking-wider text-zinc-500 border-b border-zinc-800">
                <th class="py-2 pr-3">PRODUIT</th>
                <th class="py-2 pr-3">CLIENT</th>
                <th class="py-2 pr-3">MONTANT</th>
                <th class="py-2 pr-3">STATUT</th>
                <th class="py-2">DATE</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="recentOrders.length === 0">
                <td colspan="5" class="py-6 text-center text-xs font-mono text-zinc-500">
                  Aucune commande enregistrée. Créez-en une dans l'onglet Commandes.
                </td>
              </tr>
              <tr
                v-for="o in recentOrders"
                :key="o.id"
                class="border-b border-zinc-900 hover:bg-zinc-900/40 transition-colors cursor-pointer"
                @click="navigateTo('/admin/orders')"
              >
                <td class="py-2.5 pr-3">
                  <div class="flex items-center gap-2">
                    <img :src="o.productImage || `/api/img/${encodeURIComponent(o.productId)}.jpg`" :alt="o.productTitle" class="w-8 h-8 rounded-lg object-cover bg-zinc-900" />
                    <span class="text-[11px] font-mono text-zinc-200 max-w-[140px] truncate">{{ o.productTitle }}</span>
                  </div>
                </td>
                <td class="py-2.5 pr-3">
                  <div class="text-[11px] font-mono text-zinc-300">{{ o.customerName }}</div>
                  <div class="text-[9px] font-mono text-zinc-500">{{ o.customerLocation }}</div>
                </td>
                <td class="py-2.5 pr-3 text-[11px] font-mono text-[#ff2a2a] font-bold">{{ formatMoney(o.priceXof * o.quantity) }}</td>
                <td class="py-2.5 pr-3">
                  <span class="inline-block text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-full border" :class="statusClass[o.status] || statusClass.processing">
                    {{ statusLabel[o.status] || o.status }}
                  </span>
                </td>
                <td class="py-2.5 text-[10px] font-mono text-zinc-500">{{ fmtShortDate(o.createdAt) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>