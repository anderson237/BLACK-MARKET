<script setup lang="ts">
import { useAdminStore } from '~/stores/admin'

definePageMeta({ layout: 'admin' })
useSeoMeta({ title: 'Audience géographique — BLACK MARKET' })

const store = useAdminStore()
const loading = ref(true)
const error = ref('')
const lastUpdated = ref('')
const data = ref<{
  byCountry: any[]
  byCity: any[]
  totals: { visitors: number; customers: number; orders: number; countries: number; cities: number; events: number }
} | null>(null)

const totals = computed(() => data.value?.totals || { visitors: 0, customers: 0, orders: 0, countries: 0, cities: 0, events: 0 })
const byCountry = computed(() => data.value?.byCountry || [])
const byCity = computed(() => data.value?.byCity || [])
const mapPoints = computed(() =>
  byCountry.value.map((c) => ({
    code: c.code,
    name: c.name,
    lat: c.lat,
    lng: c.lng,
    value: c.total,
  })),
)
const maxTotal = computed(() => Math.max(1, ...byCountry.value.map((c) => c.total || 0)))
const maxCity = computed(() => Math.max(1, ...byCity.value.map((c) => c.count || 0)))

function barW(v: number, max: number) {
  return Math.max(0, Math.min(100, Math.round((Number(v) / Math.max(1, max)) * 100)))
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await fetch('/api/geo', { headers: store.headers() })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json?.statusMessage || json?.message || `Erreur ${res.status}`)
    data.value = json || null
    lastUpdated.value = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  } catch (e: any) {
    error.value = e?.message || 'Erreur de chargement.'
  } finally {
    loading.value = false
  }
}

onMounted(load)

const cards = computed(() => [
  { label: 'Visiteurs géolocalisés', value: totals.value.visitors, hint: `${totals.value.events} événements` },
  { label: 'Clients enregistrés', value: totals.value.customers, hint: 'comptes avec pays' },
  { label: 'Commandes localisées', value: totals.value.orders, hint: 'avec lieu' },
  { label: 'Pays', value: totals.value.countries, hint: 'sur la carte' },
  { label: 'Villes', value: totals.value.cities, hint: 'répartition' },
])
</script>

<template>
  <div>
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
      <div>
        <h1 class="text-lg font-extrabold text-white font-mono uppercase tracking-widest">Audience</h1>
        <p class="text-[11px] text-zinc-500 font-mono mt-1">
          Répartition des visiteurs, clients et commandes par pays et par ville
          <span v-if="lastUpdated" class="text-zinc-600">· maj {{ lastUpdated }}</span>
        </p>
      </div>
      <button @click="load" class="text-[10px] font-mono text-zinc-300 hover:text-white border border-zinc-800 hover:border-[#ff2a2a]/50 px-3 py-2 rounded-lg transition-all inline-flex items-center gap-1.5">
        <AppIcon name="refresh" :size="13" /> Actualiser
      </button>
    </div>

    <p v-if="error" class="text-[11px] font-mono text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-4">{{ error }}</p>

    <!-- KPI cards -->
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
      <div v-for="c in cards" :key="c.label" class="bg-[#0d0d14] rounded-2xl border border-zinc-800 p-4">
        <p class="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">{{ c.label }}</p>
        <p class="text-2xl font-extrabold text-white font-mono mt-2">{{ loading ? '…' : c.value.toLocaleString('fr-FR') }}</p>
        <p class="text-[9px] font-mono text-zinc-600 mt-1">{{ c.hint }}</p>
      </div>
    </div>

    <!-- Mini carte continent -->
    <section class="bg-[#0d0d14] rounded-3xl p-4 border border-zinc-800 mb-6">
      <div class="flex items-center justify-between mb-3">
        <p class="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Mini carte — activité par pays</p>
        <span class="text-[9px] font-mono text-zinc-600">taille du point = activité totale</span>
      </div>
      <GeoMap v-if="!loading" :points="mapPoints" :height="400" />
      <div v-else class="h-[400px] flex items-center justify-center text-[11px] font-mono text-zinc-600 border border-dashed border-zinc-800 rounded-2xl">Chargement…</div>
    </section>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Par pays -->
      <section class="bg-[#0d0d14] rounded-3xl p-4 border border-zinc-800">
        <p class="text-[10px] text-zinc-500 font-mono uppercase tracking-widest mb-3">Répartition par pays</p>
        <div v-if="!byCountry.length" class="text-[11px] font-mono text-zinc-600 text-center py-8">
          Aucune donnée géographique pour l'instant. Elles apparaissent dès que des visiteurs se connectent.
        </div>
        <div v-else class="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
          <div v-for="c in byCountry" :key="c.code || c.name" class="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-zinc-800/40">
            <span class="w-6 text-center text-base shrink-0">{{ c.flag }}</span>
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between gap-2">
                <p class="text-[11px] font-mono text-slate-200 truncate">{{ c.name }} <span class="text-zinc-600">· {{ c.code || '?' }}</span></p>
                <p class="text-[11px] font-mono text-white font-bold shrink-0">{{ c.total.toLocaleString('fr-FR') }}</p>
              </div>
              <div class="mt-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                <div class="h-full rounded-full bg-[#ff2a2a]/70" :style="{ width: `${barW(c.total, maxTotal)}%` }" />
              </div>
              <p class="text-[9px] font-mono text-zinc-600 mt-1">
                {{ c.visitors }} visiteurs · {{ c.customers }} clients · {{ c.orders }} commandes · {{ c.visits }} vues
              </p>
            </div>
          </div>
        </div>
      </section>

      <!-- Par ville -->
      <section class="bg-[#0d0d14] rounded-3xl p-4 border border-zinc-800">
        <p class="text-[10px] text-zinc-500 font-mono uppercase tracking-widest mb-3">Répartition par ville</p>
        <div v-if="!byCity.length" class="text-[11px] font-mono text-zinc-600 text-center py-8">
          Aucune ville détectée pour l'instant.
        </div>
        <div v-else class="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
          <div v-for="(c, i) in byCity" :key="c.city" class="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-zinc-800/40">
            <span class="w-6 text-right text-[10px] font-mono text-zinc-600 shrink-0">{{ i + 1 }}</span>
            <p class="w-28 sm:w-40 text-[11px] font-mono text-slate-200 truncate shrink-0">{{ c.city }}</p>
            <div class="flex-1 h-2 rounded-full bg-zinc-800 overflow-hidden">
              <div class="h-full rounded-full bg-emerald-500/70" :style="{ width: `${barW(c.count, maxCity)}%` }" />
            </div>
            <p class="text-[11px] font-mono text-white font-bold shrink-0">{{ c.count.toLocaleString('fr-FR') }}</p>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
