<script setup lang="ts">
import { formatPriceXof } from '~/composables/useCatalog'

definePageMeta({ layout: 'admin' })

const store = useAdminStore()
const deleting = ref<string | null>(null)
const error = ref('')

const statuses = ['pending', 'processing', 'shipped', 'completed', 'cancelled'] as const
type OrderStatus = (typeof statuses)[number]

const statusBadge: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  processing: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  shipped: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
  completed: 'bg-green-500/15 text-green-400 border-green-500/30',
  cancelled: 'bg-red-500/15 text-red-400 border-red-500/30',
}

const statusLabel: Record<string, string> = {
  pending: 'En attente',
  processing: 'En traitement',
  shipped: 'Expédiée',
  completed: 'Terminée',
  cancelled: 'Annulée',
}

const flow = [
  { status: 'pending', label: 'Commande reçue', color: '#facc15', dot: '●' },
  { status: 'processing', label: 'En traitement', color: '#22d3ee', dot: '◐' },
  { status: 'shipped', label: 'Expédiée', color: '#3b82f6', dot: '➤' },
  { status: 'completed', label: 'Livrée / Terminée', color: '#34d399', dot: '✓' },
]

const PAGE_SIZE = 8

const search = ref('')
const statusFilter = ref('')
const page = ref(1)

const filtered = computed(() => {
  const q = search.value.toLowerCase()
  return store.orders.filter((o) => {
    if (statusFilter.value && o.status !== statusFilter.value) return false
    if (!q) return true
    return (
      (o.productTitle || '').toLowerCase().includes(q) ||
      (o.customerName || '').toLowerCase().includes(q) ||
      (o.customerPhone || '').toLowerCase().includes(q) ||
      (o.id || '').toLowerCase().includes(q)
    )
  })
})

const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE)))
const paged = computed(() => filtered.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE))

watch([search, statusFilter], () => { page.value = 1 })

const showDetail = ref(false)
const detailOrder = ref<any>(null)

onMounted(() => store.loadOrders())

function setStatus(o: any, s: string) {
  try {
    store.updateOrderStatus(o.id, s as OrderStatus)
    if (detailOrder.value?.id === o.id) detailOrder.value = { ...detailOrder.value, status: s }
  } catch (e: any) {
    error.value = e?.message || 'Erreur'
  }
}

async function remove(id: string) {
  try {
    await store.deleteOrder(id)
    deleting.value = null
    if (detailOrder.value?.id === id) { showDetail.value = false; detailOrder.value = null }
  } catch (e: any) {
    error.value = e?.message || 'Erreur'
  }
}

function openDetail(o: any) {
  detailOrder.value = o
  showDetail.value = true
}

// ---- Nouvelle commande ----
const showCreate = ref(false)
const newOrder = ref({ productTitle: '', customerName: '', customerPhone: '', customerLocation: '', quantity: 1, priceXof: 0 })
const creating = ref(false)

function openCreate() {
  newOrder.value = { productTitle: '', customerName: '', customerPhone: '', customerLocation: '', quantity: 1, priceXof: 0 }
  showCreate.value = true
}

async function submitCreate() {
  if (!newOrder.value.productTitle.trim() || !newOrder.value.customerName.trim() || newOrder.value.quantity < 1) {
    error.value = 'Renseignez au minimum le produit, le client et la quantité.'
    return
  }
  creating.value = true
  error.value = ''
  try {
    await store.createOrder({
      productTitle: newOrder.value.productTitle,
      productImage: '',
      customerName: newOrder.value.customerName,
      customerPhone: newOrder.value.customerPhone,
      customerLocation: newOrder.value.customerLocation || '—',
      quantity: newOrder.value.quantity,
      priceXof: Number(newOrder.value.priceXof) || 0,
      priceEur: Math.round((Number(newOrder.value.priceXof) || 0) / 655),
      status: 'pending',
    })
    showCreate.value = false
  } catch (e: any) {
    error.value = e?.message || 'Erreur lors de la création.'
  } finally {
    creating.value = false
  }
}

const currentIndex = computed(() => {
  const s = detailOrder.value?.status || 'pending'
  return flow.findIndex((f) => f.status === s)
})

function cleanPhone(p: string) {
  return String(p || '').replace(/[^0-9]/g, '')
}
</script>

<template>
  <div>
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
      <div>
        <h1 class="text-lg font-extrabold text-white font-mono uppercase tracking-widest">Commandes</h1>
        <p class="text-[11px] text-zinc-500 font-mono mt-1">{{ store.orders.length }} commande(s) · leads WhatsApp & précommandes.</p>
      </div>
      <div class="flex items-center gap-2">
        <button @click="store.loadOrders()" class="shrink-0 text-[11px] font-mono text-zinc-300 hover:text-white border border-zinc-800 hover:border-[#ff2a2a]/50 px-3 py-2 rounded-xl transition-all">⟳ Actualiser</button>
        <button @click="openCreate" class="shrink-0 bg-[#ff2a2a] hover:bg-red-600 text-white text-xs font-mono font-bold px-3.5 py-2 rounded-xl transition-all">＋ NOUVELLE</button>
      </div>
    </div>

    <p v-if="error" class="mb-4 bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-400 font-mono">{{ error }}</p>

    <!-- Filters -->
    <div class="flex flex-col sm:flex-row gap-2 mb-4">
      <input v-model="search" type="search" placeholder="Rechercher client, produit, ID..."
        class="bg-black/40 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:border-[#ff2a2a]/60 focus:outline-none flex-1" />
      <select v-model="statusFilter"
        class="bg-black/40 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:border-[#ff2a2a]/60 focus:outline-none">
        <option value="">Tous les statuts</option>
        <option v-for="s in statuses" :key="s" :value="s">{{ statusLabel[s] }}</option>
      </select>
    </div>

    <!-- Loading -->
    <div v-if="store.loading" class="space-y-3">
      <div v-for="n in 4" :key="n" class="skeleton h-20 rounded-2xl" />
    </div>

    <!-- Table -->
    <div v-else class="bg-[#12121a] border border-zinc-800 rounded-2xl overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left">
          <thead>
            <tr class="border-b border-zinc-800 text-[9px] font-mono uppercase tracking-widest text-zinc-500">
              <th class="px-4 py-3">Produit</th>
              <th class="px-4 py-3">Client</th>
              <th class="px-4 py-3">Qté</th>
              <th class="px-4 py-3">Montant</th>
              <th class="px-4 py-3">Statut</th>
              <th class="px-4 py-3">Date</th>
              <th class="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="o in paged" :key="o.id" class="border-b border-zinc-900 last:border-0 hover:bg-zinc-900/30 transition-colors cursor-pointer" @click="openDetail(o)">
              <td class="px-4 py-3">
                <div class="flex items-center gap-2.5">
                  <img :src="o.productImage || `/api/img/${encodeURIComponent(o.productId)}.jpg`" :alt="o.productTitle" class="w-9 h-9 rounded-lg object-cover border border-zinc-800" @error="($event.target as any).style.display='none'" />
                  <span class="text-xs font-mono text-slate-100 max-w-[180px] truncate">{{ o.productTitle }}</span>
                </div>
              </td>
              <td class="px-4 py-3">
                <span class="text-[11px] font-mono text-slate-200">{{ o.customerName }}</span>
                <span class="block text-[9px] font-mono text-zinc-500">{{ o.customerPhone || 'tel ?' }}</span>
              </td>
              <td class="px-4 py-3 text-[11px] font-mono text-zinc-300">×{{ o.quantity }}</td>
              <td class="px-4 py-3 text-xs font-mono font-bold text-[#ff2a2a]">{{ formatPriceXof(o.priceXof * o.quantity) }}</td>
              <td class="px-4 py-3">
                <span class="text-[9px] font-mono font-bold px-2 py-0.5 rounded border uppercase" :class="statusBadge[o.status] || statusBadge.pending">{{ statusLabel[o.status] || o.status }}</span>
              </td>
              <td class="px-4 py-3 text-[10px] font-mono text-zinc-500 whitespace-nowrap">{{ new Date(o.createdAt).toLocaleDateString('fr-FR') }}</td>
              <td class="px-4 py-3 text-right" @click.stop>
                <button @click="openDetail(o)" class="text-[10px] font-mono text-[#ff2a2a] hover:text-red-400 px-2 py-1 rounded-lg border border-[#ff2a2a]/30">Voir</button>
                <button @click="deleting = o.id" class="text-[10px] font-mono text-red-400 hover:text-red-300 px-2 py-1 rounded-lg border border-red-500/30 ml-1">Suppr.</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Empty -->
      <div v-if="paged.length === 0" class="py-12 text-center text-zinc-500 font-mono text-xs">Aucune commande.</div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="flex items-center justify-center gap-2 p-3 border-t border-zinc-800">
        <button :disabled="page <= 1" @click="page--" class="px-2.5 py-1 rounded-lg text-[11px] font-mono text-zinc-300 border border-zinc-700 hover:border-[#ff2a2a]/40 disabled:opacity-30">‹</button>
        <span class="text-[11px] font-mono text-zinc-400">{{ page }} / {{ totalPages }}</span>
        <button :disabled="page >= totalPages" @click="page++" class="px-2.5 py-1 rounded-lg text-[11px] font-mono text-zinc-300 border border-zinc-700 hover:border-[#ff2a2a]/40 disabled:opacity-30">›</button>
      </div>
    </div>

    <!-- Detail modal -->
    <div v-if="showDetail && detailOrder" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" @click.self="showDetail = false">
      <div class="bg-[#0d0d14] border border-zinc-800 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div class="flex items-center justify-between p-5 border-b border-zinc-800 sticky top-0 bg-[#0d0d14] z-10">
          <div>
            <h3 class="text-base font-extrabold text-white font-mono uppercase tracking-wider">Détail commande</h3>
            <p class="text-[10px] font-mono text-zinc-500">{{ detailOrder.id }}</p>
          </div>
          <div class="flex items-center gap-3">
            <span class="inline-block text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-full" :class="statusBadge[detailOrder.status]">{{ statusLabel[detailOrder.status] || detailOrder.status }}</span>
            <button @click="showDetail = false" class="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"><AppIcon name="close" :size="15" /></button>
          </div>
        </div>

        <div class="p-5 space-y-6">
          <!-- Product summary -->
          <div class="flex items-center gap-3 bg-black/40 border border-zinc-900 rounded-2xl p-3">
            <img :src="detailOrder.productImage || `/api/img/${encodeURIComponent(detailOrder.productId)}.jpg`" alt="" class="w-14 h-14 rounded-xl object-cover bg-zinc-900" @error="($event.target as HTMLImageElement).style.display='none'" />
            <div class="flex-1 min-w-0">
              <div class="text-sm font-mono text-slate-100 truncate">{{ detailOrder.productTitle }}</div>
              <div class="text-[10px] font-mono text-zinc-500 mt-0.5">Quantité ×{{ detailOrder.quantity }} • Réf. {{ detailOrder.productId }}</div>
            </div>
            <div class="text-right">
              <div class="text-sm font-mono text-[#ff2a2a] font-bold">{{ formatPriceXof(detailOrder.priceXof * detailOrder.quantity) }}</div>
              <div class="text-[9px] font-mono text-zinc-500">PRIX UNITAIRE {{ formatPriceXof(detailOrder.priceXof) }}</div>
            </div>
          </div>

          <!-- Customer info -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="bg-black/40 border border-zinc-900 rounded-2xl p-3">
              <div class="text-[9px] font-mono text-zinc-500 uppercase tracking-wider mb-1.5">Client</div>
              <div class="text-sm font-mono text-slate-100">{{ detailOrder.customerName }}</div>
              <div class="text-[10px] font-mono text-zinc-400 mt-1">{{ detailOrder.customerPhone || '—' }}</div>
            </div>
            <div class="bg-black/40 border border-zinc-900 rounded-2xl p-3">
              <div class="text-[9px] font-mono text-zinc-500 uppercase tracking-wider mb-1.5">Localisation</div>
              <div class="text-sm font-mono text-slate-100">{{ detailOrder.customerLocation }}</div>
              <div class="text-[10px] font-mono text-zinc-400 mt-1">{{ new Date(detailOrder.createdAt).toLocaleString('fr-FR') }}</div>
            </div>
          </div>

          <!-- Tracking timeline -->
          <div>
            <div class="text-[9px] font-mono text-zinc-500 uppercase tracking-wider mb-3">Suivi de commande</div>
            <div class="flex items-start justify-between">
              <div v-for="(step, i) in flow" :key="step.status" class="flex flex-col items-center flex-1 relative">
                <div v-if="i > 0" class="absolute top-[13px] left-[-50%] w-full h-0.5" :class="i <= currentIndex ? 'bg-[#ff2a2a]' : 'bg-zinc-800'" />
                <div class="relative z-10 w-7 h-7 rounded-full flex items-center justify-center border transition-all text-[10px]"
                  :class="i === currentIndex ? 'bg-[#ff2a2a] text-white border-[#ff2a2a] shadow-lg shadow-[#ff2a2a]/30' : (i <= currentIndex ? 'bg-[#ff2a2a]/20 text-[#ff2a2a] border-[#ff2a2a]/50' : 'bg-zinc-900 text-zinc-600 border-zinc-800')"
                  :style="i === currentIndex ? { color: step.color } : {}">
                  {{ step.dot }}
                </div>
                <span class="text-[8px] font-mono mt-1.5 text-center" :class="i <= currentIndex ? 'text-zinc-200' : 'text-zinc-600'">{{ step.label }}</span>
              </div>
            </div>
          </div>

          <!-- Status changer -->
          <div class="border-t border-zinc-800 pt-4">
            <div class="text-[9px] font-mono text-zinc-500 uppercase tracking-wider mb-2">Changer le statut</div>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="s in statuses" :key="s"
                @click="setStatus(detailOrder, s)"
                class="px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase transition-all"
                :class="detailOrder.status === s ? (s === 'cancelled' ? 'bg-red-600 text-white' : 'bg-[#ff2a2a] text-white') : 'bg-black text-zinc-400 border border-zinc-800 hover:border-[#ff2a2a]/40'">
                {{ statusLabel[s] }}
              </button>
            </div>
          </div>

          <!-- WhatsApp + delete -->
          <div class="border-t border-zinc-800 pt-4 flex items-center justify-between flex-wrap gap-2">
            <a v-if="detailOrder.customerPhone"
              :href="`https://wa.me/${cleanPhone(detailOrder.customerPhone)}?text=${encodeURIComponent('Bonjour ' + (detailOrder.customerName||'') + ', votre commande « ' + detailOrder.productTitle + ' » est ' + statusLabel[detailOrder.status] + '.')}`"
              target="_blank" rel="noopener"
              class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[10px] font-mono font-bold uppercase text-emerald-400 border border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/15 transition-all">
              <AppIcon name="whatsapp" :size="13" /> WhatsApp
            </a>
            <button
              @click="remove(detailOrder.id)"
              class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[10px] font-mono font-bold uppercase text-red-400 border border-red-500/30 bg-red-500/5 hover:bg-red-500/15 transition-all">
              <AppIcon name="trash" :size="13" /> Supprimer la commande
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Nouvelle commande modal -->
    <div v-if="showCreate" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" @click.self="showCreate = false">
      <div class="bg-[#0d0d14] border border-zinc-800 rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        <div class="flex items-center justify-between p-5 border-b border-zinc-800 sticky top-0 bg-[#0d0d14]">
          <h3 class="text-base font-extrabold text-white font-mono uppercase tracking-wider">Nouvelle commande</h3>
          <button @click="showCreate = false" class="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900"><AppIcon name="close" :size="15" /></button>
        </div>
        <div class="p-5 space-y-3">
          <div>
            <label class="text-[9px] font-mono text-zinc-500 uppercase tracking-wider">Produit</label>
            <input v-model="newOrder.productTitle" placeholder="Nom du produit" class="mt-1 w-full bg-black border border-zinc-800 rounded-xl px-3 py-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-[#ff2a2a]/50" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-[9px] font-mono text-zinc-500 uppercase tracking-wider">Client</label>
              <input v-model="newOrder.customerName" placeholder="Nom" class="mt-1 w-full bg-black border border-zinc-800 rounded-xl px-3 py-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-[#ff2a2a]/50" />
            </div>
            <div>
              <label class="text-[9px] font-mono text-zinc-500 uppercase tracking-wider">Téléphone</label>
              <input v-model="newOrder.customerPhone" placeholder="+229..." class="mt-1 w-full bg-black border border-zinc-800 rounded-xl px-3 py-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-[#ff2a2a]/50" />
            </div>
          </div>
          <div>
            <label class="text-[9px] font-mono text-zinc-500 uppercase tracking-wider">Localisation</label>
            <input v-model="newOrder.customerLocation" placeholder="Ville / pays" class="mt-1 w-full bg-black border border-zinc-800 rounded-xl px-3 py-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-[#ff2a2a]/50" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-[9px] font-mono text-zinc-500 uppercase tracking-wider">Quantité</label>
              <input v-model.number="newOrder.quantity" type="number" min="1" class="mt-1 w-full bg-black border border-zinc-800 rounded-xl px-3 py-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-[#ff2a2a]/50" />
            </div>
            <div>
              <label class="text-[9px] font-mono text-zinc-500 uppercase tracking-wider">Prix unitaire (F CFA)</label>
              <input v-model.number="newOrder.priceXof" type="number" min="0" class="mt-1 w-full bg-black border border-zinc-800 rounded-xl px-3 py-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-[#ff2a2a]/50" />
            </div>
          </div>
          <div class="flex gap-2 pt-2">
            <button @click="showCreate = false" class="flex-1 text-[11px] font-mono text-zinc-300 border border-zinc-700 px-3 py-2.5 rounded-xl">Annuler</button>
            <button @click="submitCreate" :disabled="creating" class="flex-1 bg-[#ff2a2a] hover:bg-red-600 disabled:opacity-30 text-white text-[11px] font-mono font-bold px-3 py-2.5 rounded-xl">Créer</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>