<script setup lang="ts">
import { formatPriceXof } from '~/composables/useCatalog'

definePageMeta({ layout: 'admin' })

const store = useAdminStore()

onMounted(() => {
  store.loadOrders()
  store.loadCustomers()
})

const search = ref('')
const page = ref(1)
const PAGE_SIZE = 10

interface ConsolidatedCustomer {
  id: string
  name: string
  phone: string
  location: string
  orders: number
  totalXof: number
  totalEur: number
  lastOrderAt: string
}

const consolidated = computed<ConsolidatedCustomer[]>(() => {
  const map = new Map<string, ConsolidatedCustomer>()
  for (const o of store.orders) {
    const key = o.customerPhone || `${o.customerName}|${o.customerLocation}` || o.id
    const existing = map.get(key)
    const totalXof = Number(o.priceXof || 0) * Number(o.quantity || 1)
    const totalEur = Number(o.priceEur || 0) * Number(o.quantity || 1)
    if (existing) {
      existing.orders += 1
      existing.totalXof += totalXof
      existing.totalEur += totalEur
      if (new Date(o.createdAt).getTime() > new Date(existing.lastOrderAt).getTime()) existing.lastOrderAt = o.createdAt
    } else {
      map.set(key, {
        id: key,
        name: o.customerName || 'Client WhatsApp',
        phone: o.customerPhone || '',
        location: o.customerLocation || '—',
        orders: 1,
        totalXof,
        totalEur,
        lastOrderAt: o.createdAt,
      })
    }
  }
  // fallback: account users with no orders
  for (const c of store.customers) {
    const name = c.name || c.email || c.phone || 'Utilisateur'
    const key = `acc_${c.id}`
    if (!map.has(key)) {
      map.set(key, {
        id: key,
        name,
        phone: c.phone || '',
        location: c.country || '—',
        orders: 0,
        totalXof: 0,
        totalEur: 0,
        lastOrderAt: c.lastLoginAt || c.createdAt || '',
      })
    }
  }
  return Array.from(map.values()).sort((a, b) => new Date(b.lastOrderAt).getTime() - new Date(a.lastOrderAt).getTime())
})

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return consolidated.value.filter(
    (c) => !q || c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q) || c.location.toLowerCase().includes(q),
  )
})

const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE)))
const pageItems = computed(() => filtered.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE))

watch(search, () => { page.value = 1 })

function cleanPhone(p: string) {
  return String(p || '').replace(/\s/g, '').replace(/^\+/, '')
}

function fmtDate(iso: string) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' })
  } catch {
    return iso
  }
}

function initial(c: ConsolidatedCustomer) {
  return c.name.slice(0, 1).toUpperCase()
}
</script>

<template>
  <div>
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
      <div>
        <h1 class="text-lg font-extrabold text-white font-mono uppercase tracking-widest">Clients</h1>
        <p class="text-[11px] text-zinc-500 font-mono mt-1">Base clients consolidée depuis les commandes · {{ consolidated.length }} client(s).</p>
      </div>
      <div class="flex items-center gap-2">
        <input
          v-model="search"
          type="search"
          placeholder="Rechercher un client…"
          class="bg-black/40 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:border-[#ff2a2a]/60 focus:outline-none w-full sm:w-56"
        />
        <button @click="store.loadOrders(); store.loadCustomers()" class="shrink-0 text-[11px] font-mono text-zinc-300 hover:text-white border border-zinc-800 hover:border-[#ff2a2a]/50 px-3 py-2 rounded-xl transition-all" title="Actualiser">⟳</button>
      </div>
    </div>

    <div v-if="store.loading" class="space-y-3">
      <div v-for="n in 4" :key="n" class="skeleton h-16 rounded-2xl" />
    </div>

    <div v-else class="bg-[#0d0d14] rounded-3xl p-5 border border-zinc-800 space-y-4">
      <div class="overflow-x-auto">
        <table class="w-full text-left">
          <thead>
            <tr class="text-[9px] font-mono uppercase tracking-wider text-zinc-500 border-b border-zinc-800">
              <th class="py-2 pr-3">Client</th>
              <th class="py-2 pr-3">Localisation</th>
              <th class="py-2 pr-3">Commandes</th>
              <th class="py-2 pr-3">Total dépensé</th>
              <th class="py-2 pr-3">Dernière commande</th>
              <th class="py-2 text-right">Contact</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="pageItems.length === 0">
              <td colspan="6" class="py-8 text-center text-xs font-mono text-zinc-500">Aucun client enregistré.</td>
            </tr>
            <tr v-for="c in pageItems" :key="c.id" class="border-b border-zinc-900 hover:bg-zinc-900/40 transition-colors">
              <td class="py-2.5 pr-3">
                <div class="flex items-center gap-2">
                  <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-[#ff2a2a] to-[#900] flex items-center justify-center text-white text-xs font-mono font-bold shrink-0">{{ initial(c) }}</div>
                  <div class="min-w-0">
                    <div class="text-[11px] font-mono text-zinc-200 truncate">{{ c.name }}</div>
                    <div class="text-[9px] font-mono text-zinc-500">{{ c.phone || '—' }}</div>
                  </div>
                </div>
              </td>
              <td class="py-2.5 pr-3 text-[11px] font-mono text-zinc-400">{{ c.location }}</td>
              <td class="py-2.5 pr-3 text-[11px] font-mono text-zinc-300 font-bold">{{ c.orders }}</td>
              <td class="py-2.5 pr-3 text-[11px] font-mono text-[#ff2a2a] font-bold">{{ formatPriceXof(c.totalXof) }}</td>
              <td class="py-2.5 pr-3 text-[10px] font-mono text-zinc-500">{{ fmtDate(c.lastOrderAt) }}</td>
              <td class="py-2.5 text-right">
                <a
                  v-if="c.phone"
                  :href="`https://wa.me/${cleanPhone(c.phone)}`"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex p-1.5 rounded-lg text-zinc-400 hover:text-green-400 hover:bg-zinc-900 transition-colors"
                  title="Contacter sur WhatsApp"
                ><AppIcon name="whatsapp" :size="15" /></a>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="flex items-center justify-between pt-1">
        <span class="text-[10px] font-mono text-zinc-500">{{ filtered.length }} client{{ filtered.length > 1 ? 's' : '' }}</span>
        <div class="flex items-center gap-1.5">
          <button :disabled="page <= 1" @click="page = Math.max(1, page - 1)" class="px-3 py-1.5 rounded-lg text-xs font-mono bg-black border border-zinc-800 text-zinc-300 hover:border-[#ff2a2a]/40 disabled:opacity-30">←</button>
          <span class="text-[11px] font-mono text-zinc-400 px-2">{{ page }} / {{ totalPages }}</span>
          <button :disabled="page >= totalPages" @click="page = Math.min(totalPages, page + 1)" class="px-3 py-1.5 rounded-lg text-xs font-mono bg-black border border-zinc-800 text-zinc-300 hover:border-[#ff2a2a]/40 disabled:opacity-30">→</button>
        </div>
      </div>
    </div>
  </div>
</template>
