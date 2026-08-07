<script setup lang="ts">
import type { Product } from '~/types'
import { formatPriceXof } from '~/composables/useCatalog'

definePageMeta({ layout: 'admin' })

const store = useAdminStore()

const showEditor = ref(false)
const editingProduct = ref<Product | null>(null)
const searchQuery = ref('')
const selectedCategory = ref('Tous')
const showTrash = ref(false)
const showDeleteModal = ref(false)
const pendingDelete = ref<Product | null>(null)
const deleting = ref(false)

onMounted(() => {
  store.loadProducts()
  store.loadStats()
})

const categories = computed(() => ['Tous', ...Array.from(new Set(store.products.map((p) => p.category)))].filter(Boolean))

const activeList = computed(() => (showTrash.value ? store.trashProducts : store.activeProducts) as any[])

const filtered = computed(() => {
  const q = searchQuery.value.toLowerCase()
  return activeList.value.filter((p) => {
    const okCat = selectedCategory.value === 'Tous' || p.category === selectedCategory.value
    const okQ =
      !q ||
      p.title.toLowerCase().includes(q) ||
      (p.chineseTitle || '').toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q) ||
      (p.category || '').toLowerCase().includes(q)
    return okCat && okQ
  })
})

const stats = computed(() => ({
  total: store.activeProducts.length,
  clicks: store.stats?.interactions?.clicks ?? 0,
  withVideo: store.activeProducts.filter((p) => p.videoUrl).length,
}))

function openCreate() {
  editingProduct.value = null
  showEditor.value = true
}

function openEdit(p: Product) {
  editingProduct.value = p
  showEditor.value = true
}

function onSaved() {
  showEditor.value = false
  detailProduct.value = null
}

function onDeleted(id: string) {
  showEditor.value = false
  detailProduct.value = null
}

function askDelete(p: Product) {
  // Supprimer -> envoyer en corbeille (soft delete).
  store.deleteProduct(p.id).catch((e: any) => { alert(e?.message || 'Erreur') })
}

function askRestore(p: Product) {
  store.restoreProduct(p.id).catch((e: any) => { alert(e?.message || 'Erreur') })
}

function askPermanent(p: Product) {
  pendingDelete.value = p
  showDeleteModal.value = true
}

async function confirmPermanent() {
  const p = pendingDelete.value
  if (!p) return
  deleting.value = true
  try {
    await store.permanentDeleteProduct(p.id)
    showDeleteModal.value = false
    pendingDelete.value = null
  } catch (e: any) {
    alert(e?.message || 'Erreur')
  } finally {
    deleting.value = false
  }
}

function stripHtml(h: string) {
  return String(h || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

// ---- Fiche produit detail modal ----
const detailProduct = ref<Product | null>(null)
const detailSlide = ref(0)
const slideMedia = computed(() => {
  const p = detailProduct.value
  if (!p) return []
  const list: { type: 'image' | 'video'; src: string }[] = []
  if (p.videoUrl) list.push({ type: 'video', src: p.videoUrl })
  const imgs = p.imageUrl ? [p.imageUrl, ...(p.gallery || [])] : [...(p.gallery || [])]
  imgs.forEach((src) => list.push({ type: 'image', src }))
  return list
})

function openDetail(p: Product) {
  detailSlide.value = 0
  detailProduct.value = p
}

function clearDetail() {
  detailProduct.value = null
}

const media = computed(() => slideMedia.value[detailSlide.value] || { type: 'image', src: '' })

// ---- default WhatsApp number for the précommander link ----
const storeNum = ref('22900000000')
if (import.meta.client) {
  const saved = localStorage.getItem('bm_admin_wa')
  if (saved) storeNum.value = saved
}

function cleanPhone(p: string) {
  return String(p || '').replace(/\+/g, '').replace(/\s/g, '')
}

function genWa(p: Product) {
  const price = formatPriceXof(p.priceXof)
  const text = [
    'Bonjour DEEP ROOTS, 👋',
    '',
    'Je souhaite passer une PRÉCOMMANDE pour le produit suivant :',
    '',
    `  📦 PRODUIT : ${String(p.title || '').toUpperCase()}`,
    `  💰 PRIX : ${price}`,
    '',
    'Merci de me confirmer la disponibilité, le délai de livraison et les modalités de paiement.',
  ].join('\n')
  return `https://wa.me/${cleanPhone(storeNum.value)}?text=${encodeURIComponent(text)}`
}

function copyLink(p: Product) {
  navigator.clipboard.writeText(genWa(p)).catch(() => {})
}
</script>

<template>
  <div>
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
      <div>
        <h1 class="text-lg font-extrabold text-white font-mono uppercase tracking-widest">Catalogue</h1>
        <p class="text-[11px] text-zinc-500 font-mono mt-1">Gérez vos drops, médias et pitchs IA.</p>
      </div>
      <div class="flex items-center gap-2">
        <input
          v-model="searchQuery"
          type="search"
          placeholder="Rechercher (titre, code usine, chinois)..."
          class="bg-black/40 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:border-[#ff2a2a]/60 focus:outline-none min-w-0 flex-1 sm:w-60 sm:flex-none"
        />
        <button @click="showTrash = !showTrash"
          class="shrink-0 inline-flex items-center gap-1.5 border px-3.5 py-2.5 rounded-xl text-xs font-bold font-mono transition-all"
          :class="showTrash ? 'bg-red-500/15 text-red-400 border-red-500/40' : 'border-zinc-800 text-zinc-400 hover:border-red-500/50 hover:text-red-400'"
          :title="showTrash ? 'Voir le catalogue' : 'Ouvrir la corbeille'">
          <AppIcon name="trash" :size="15" />
          <span class="hidden sm:inline">{{ showTrash ? 'Catalogue' : 'Corbeille' }}</span>
          <span v-if="store.trashProducts.length" class="text-[9px] font-mono bg-red-500/20 text-red-400 rounded-full px-1.5 py-0.5">{{ store.trashProducts.length }}</span>
        </button>
        <button @click="openCreate"
          class="shrink-0 inline-flex items-center gap-1.5 bg-[#ff2a2a] hover:bg-red-600 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl font-mono transition-all">
          <AppIcon name="plus" :size="15" /> Nouveau
        </button>
      </div>
    </div>

    <!-- Quick stats -->
    <div class="grid grid-cols-3 gap-3 mb-6">
      <div class="bg-[#12121a] border border-zinc-800 rounded-2xl p-3">
        <p class="text-[9px] text-zinc-500 font-mono uppercase tracking-widest">Produits</p>
        <p class="text-xl font-extrabold text-white font-mono">{{ stats.total }}</p>
      </div>
      <div class="bg-[#12121a] border border-zinc-800 rounded-2xl p-3">
        <p class="text-[9px] text-zinc-500 font-mono uppercase tracking-widest">Clics WhatsApp</p>
        <p class="text-xl font-extrabold text-white font-mono">{{ stats.clicks }}</p>
      </div>
      <div class="bg-[#12121a] border border-zinc-800 rounded-2xl p-3">
        <p class="text-[9px] text-zinc-500 font-mono uppercase tracking-widest">Avec vidéo</p>
        <p class="text-xl font-extrabold text-white font-mono">{{ stats.withVideo }}</p>
      </div>
    </div>

    <!-- Category pills -->
    <div class="flex items-center gap-1.5 overflow-x-auto pb-2 mb-5 scrollbar-none">
      <button v-for="cat in categories" :key="cat" @click="selectedCategory = cat"
        class="px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all uppercase font-mono"
        :class="selectedCategory === cat
          ? 'bg-[#ff2a2a] text-white shadow-lg shadow-[#ff2a2a]/30 border border-[#ff2a2a]'
          : 'bg-black text-zinc-500 border border-zinc-800 hover:border-[#ff2a2a]/50 hover:text-slate-300'">
        {{ cat }}
      </button>
    </div>

    <!-- Auth warning -->
    <div v-if="store.authError" class="mb-4 bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-400 font-mono">{{ store.authError }}</div>

    <!-- Loading -->
    <div v-if="store.loading" class="space-y-3">
      <div v-for="n in 5" :key="n" class="skeleton h-16 rounded-2xl" />
    </div>

    <!-- Grid -->
    <div v-else>
      <!-- Empty -->
      <div v-if="filtered.length === 0" class="bg-[#12121a] p-12 rounded-3xl border border-zinc-800 text-center space-y-3">
        <p class="text-zinc-500 text-xs font-mono">_ AUCUN ÉLÉMENT TROUVÉ DANS LE SYSTÈME _</p>
        <button @click="selectedCategory = 'Tous'; searchQuery = ''" class="text-[10px] text-[#ff2a2a] font-bold font-mono tracking-wider uppercase hover:underline">[ Réinitialiser les flux ]</button>
      </div>

      <!-- Product cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div v-for="p in filtered" :key="p.id"
          class="bg-[#12121a] rounded-3xl overflow-hidden border border-zinc-800/80 shadow-md hover:shadow-xl hover:shadow-[#ff2a2a]/5 hover:border-[#ff2a2a]/40 transition-all duration-300 flex flex-col group relative cursor-pointer"
          @click="openDetail(p)">
          <!-- Image + watermark + badges + actions -->
          <div class="relative aspect-video overflow-hidden bg-zinc-950">
            <img :src="p.imageUrl || `/api/img/${encodeURIComponent(p.id)}.jpg`" :alt="p.title"
              class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80 group-hover:opacity-100" />

            <!-- Filigrane DEEP ROOTS -->
            <div class="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden opacity-25">
              <span class="text-white font-extrabold text-3xl font-mono border-4 border-white/50 px-4 py-2 rotate-12 tracking-widest uppercase">DEEP ROOTS</span>
            </div>

            <!-- Top-left tags -->
            <div class="absolute top-3 left-3 flex flex-col gap-1">
              <span class="bg-[#ff2a2a] text-white text-[9px] uppercase font-bold tracking-widest px-2.5 py-1 rounded-lg shadow-md border border-[#ff2a2a]/55">{{ p.category }}</span>
              <span v-if="showTrash" class="bg-red-500 text-white text-[9px] uppercase font-bold tracking-widest px-2.5 py-1 rounded-lg shadow-md border border-red-500/55">En corbeille</span>
              <span v-if="p.sourceRmb" class="bg-black/95 text-yellow-500 border border-zinc-800 text-[8px] font-mono px-2 py-0.5 rounded shadow-sm w-fit">Sourcing: ¥{{ p.sourceRmb }} RMB</span>
            </div>

            <!-- Video action -->
            <button @click.stop="openDetail(p)"
              class="absolute bottom-3 right-3 bg-black/75 hover:bg-[#ff2a2a] text-white p-2.5 rounded-full shadow-lg transition-all flex items-center justify-center border border-zinc-700 hover:border-[#ff2a2a]" title="Voir la vidéo">
              <AppIcon name="play" :size="16" />
            </button>

            <!-- Admin edit + delete overlay -->
            <div class="absolute top-3 right-3 flex flex-col gap-1.5">
              <template v-if="showTrash">
                <button @click.stop="askRestore(p)"
                  class="bg-black/80 hover:bg-emerald-950 border border-zinc-800 hover:border-emerald-500/50 text-zinc-300 hover:text-emerald-400 p-2 rounded-lg transition-all" title="Restaurer ce produit">
                  <AppIcon name="restore" :size="15" />
                </button>
                <button @click.stop="askPermanent(p)"
                  class="bg-black/80 hover:bg-red-950 border border-zinc-800 hover:border-red-900 text-red-400/80 hover:text-red-400 p-2 rounded-lg transition-all" title="Supprimer définitivement">
                  <AppIcon name="trash" :size="15" />
                </button>
              </template>
              <template v-else>
                <button @click.stop="openEdit(p)"
                  class="bg-black/80 hover:bg-zinc-900 border border-zinc-800 hover:border-[#ff2a2a]/50 text-zinc-300 hover:text-[#ff2a2a] p-2 rounded-lg transition-all" title="Modifier ce produit">
                  <AppIcon name="edit" :size="15" />
                </button>
                <button @click.stop="askDelete(p)"
                  class="bg-black/80 hover:bg-red-950 border border-zinc-800 hover:border-red-900 text-zinc-400 hover:text-red-400 p-2 rounded-lg transition-all" title="Envoyer à la corbeille">
                  <AppIcon name="trash" :size="15" />
                </button>
              </template>
            </div>
          </div>

          <!-- Body -->
          <div class="p-5 flex flex-col flex-1 space-y-3">
            <div class="space-y-1">
              <h3 class="font-extrabold text-slate-100 text-sm leading-snug group-hover:text-[#ff2a2a] transition-colors">{{ p.title }}</h3>
              <p v-if="p.chineseTitle" class="text-[9px] text-zinc-500 font-mono flex items-center gap-1"><AppIcon name="tag" :size="11" /> Grossiste: {{ p.chineseTitle }}</p>
            </div>

            <p class="text-xs text-zinc-400 leading-relaxed line-clamp-3">{{ stripHtml(p.description) }}</p>

            <div v-if="p.features?.length" class="space-y-1 bg-black/40 p-3 rounded-xl border border-zinc-900">
              <p class="text-[9px] text-[#ff2a2a] uppercase font-bold tracking-wider font-mono">Fiche technique IA :</p>
              <ul class="space-y-1">
                <li v-for="(f, i) in p.features.slice(0, 3)" :key="i" class="text-[10px] text-slate-300 flex items-start gap-1">
                  <AppIcon name="chevronRight" :size="10" class="text-[#ff2a2a] mt-0.5" /><span class="line-clamp-1">{{ f }}</span>
                </li>
              </ul>
            </div>

            <div class="flex flex-wrap gap-1.5">
              <span class="inline-flex items-center gap-1 text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-1 rounded-md"
                :class="p.stockStatus === 'in_stock' ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/30' : 'text-amber-400 bg-amber-500/10 border border-amber-500/30'">
                {{ p.stockStatus === 'in_stock' ? '✓ En stock' : '📦 Précommande' }}
              </span>
              <span v-if="Number(p.moq) > 0" class="inline-flex items-center gap-1 text-[9px] font-mono font-bold uppercase tracking-wider text-zinc-300 bg-black/50 border border-zinc-800 rounded-md px-2 py-1">
                MOQ {{ p.moq }}
              </span>
              <span v-if="Number(p.stockQuantity) > 0" class="inline-flex items-center gap-1 text-[9px] font-mono font-bold uppercase tracking-wider text-sky-400 bg-sky-500/10 border border-sky-500/30 rounded-md px-2 py-1">
                {{ p.stockQuantity }} dispo
              </span>
              <span v-if="p.featuredMedia === 'video' && p.videoUrl" class="inline-flex items-center gap-1 text-[9px] font-mono font-bold uppercase tracking-wider text-fuchsia-400 bg-fuchsia-500/10 border border-fuchsia-500/30 rounded-md px-2 py-1">
                🎬 Vitrine vidéo
              </span>
              <span v-else class="inline-flex items-center gap-1 text-[9px] font-mono font-bold uppercase tracking-wider text-zinc-400 bg-black/50 border border-zinc-800 rounded-md px-2 py-1">
                🖼️ Vitrine image
              </span>
            </div>

            <div class="pt-3 flex items-center justify-between border-t border-zinc-900 mt-auto">
              <div class="flex flex-col">
                <span class="text-[8px] text-zinc-500 uppercase font-mono tracking-widest">Prix unitaire factory</span>
                <span class="text-base font-extrabold text-slate-100">{{ formatPriceXof(p.priceXof) }}</span>
              </div>
              <a :href="genWa(p)" target="_blank" rel="noopener"
                class="bg-[#ff2a2a] hover:bg-red-600 text-white font-bold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 transition-all shadow-md border border-[#ff2a2a]/40">
                <AppIcon name="whatsapp" :size="14" /> PrÉcommander
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Editor -->
    <ClientOnly>
      <ProductEditorModal v-if="showEditor" :product="editingProduct" @saved="onSaved" @deleted="onDeleted" @close="showEditor = false" />
    </ClientOnly>

    <!-- Fiche produit detail modal -->
    <div v-if="detailProduct" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" @click.self="clearDetail">
      <div class="bg-[#0d0d14] border border-zinc-800 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <!-- Header -->
        <div class="flex items-center justify-between p-5 border-b border-zinc-800 sticky top-0 bg-[#0d0d14] z-10">
          <div>
            <h3 class="text-base font-extrabold text-white font-mono uppercase tracking-wider">Fiche produit client</h3>
            <p class="text-[10px] font-mono text-zinc-500">{{ detailProduct.id }} · {{ detailProduct.category }}</p>
          </div>
          <button @click="clearDetail" class="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"><AppIcon name="close" :size="16" /></button>
        </div>

        <div class="p-5 space-y-5">
          <!-- Media carousel -->
          <div v-if="slideMedia.length" class="rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950">
            <video v-if="media.type === 'video'" :src="media.src" controls class="w-full max-h-[340px] object-contain bg-black" />
            <img v-else :src="media.src" alt="" class="w-full max-h-[340px] object-cover" />
            <div class="flex items-center justify-center gap-2 p-2 bg-black/60">
              <button v-for="(m, i) in slideMedia" :key="i" @click="detailSlide = i"
                class="w-2 h-2 rounded-full transition-all"
                :class="i === detailSlide ? 'bg-[#ff2a2a] w-4' : 'bg-zinc-600'">
              </button>
            </div>
          </div>

          <div class="space-y-1">
            <h3 class="text-lg font-extrabold text-slate-100">{{ detailProduct.title }}</h3>
            <p v-if="detailProduct.chineseTitle" class="text-[10px] font-mono text-zinc-500">Grossiste (中文): {{ detailProduct.chineseTitle }}</p>
          </div>

          <div class="flex items-center gap-3 flex-wrap">
            <span class="bg-[#ff2a2a]/15 text-[#ff2a2a] border border-[#ff2a2a]/30 text-sm font-extrabold font-mono px-3 py-2 rounded-xl">{{ formatPriceXof(detailProduct.priceXof) }}</span>
            <span v-if="detailProduct.sourceRmb" class="text-[10px] font-mono text-yellow-500 bg-black/40 border border-zinc-800 px-2.5 py-1 rounded-lg">Sourcing: ¥{{ detailProduct.sourceRmb }} RMB</span>
            <span class="text-[10px] font-mono text-zinc-500">Fiche technique (中文) —</span>
          </div>

          <div class="flex flex-wrap gap-2">
            <span class="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg"
              :class="detailProduct.stockStatus === 'in_stock' ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/30' : 'text-amber-400 bg-amber-500/10 border border-amber-500/30'">
              {{ detailProduct.stockStatus === 'in_stock' ? '✓ En stock' : '📦 Précommande' }}
            </span>
            <span v-if="Number(detailProduct.moq) > 0" class="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-300 bg-black/50 border border-zinc-800 rounded-lg px-2.5 py-1">
              MOQ : {{ detailProduct.moq }} min
            </span>
            <span v-if="Number(detailProduct.stockQuantity) > 0" class="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-wider text-sky-400 bg-sky-500/10 border border-sky-500/30 rounded-lg px-2.5 py-1">
              {{ detailProduct.stockQuantity }} unité(s) dispo
            </span>
          </div>

          <!-- Description -->
          <div v-if="detailProduct.description" class="space-y-1.5">
            <p class="text-[9px] text-[#ff2a2a] uppercase font-bold tracking-wider font-mono">Argumentaire client</p>
            <div class="text-xs text-zinc-300 leading-relaxed" v-html="detailProduct.description"></div>
          </div>

          <!-- Fiche technique -->
          <div v-if="detailProduct.features?.length" class="space-y-1.5 bg-black/40 p-4 rounded-2xl border border-zinc-900">
            <p class="text-[9px] text-[#ff2a2a] uppercase font-bold tracking-wider font-mono">Fiche technique</p>
            <ul class="space-y-1.5">
              <li v-for="(f, i) in detailProduct.features" :key="i" class="text-xs text-slate-300 flex items-start gap-2">
                <AppIcon name="chevronRight" :size="12" class="text-[#ff2a2a] mt-0.5" /><span>{{ f }}</span>
              </li>
            </ul>
          </div>

          <!-- Actions -->
          <div class="flex gap-3 border-t border-zinc-800 pt-4">
            <a :href="genWa(detailProduct)" target="_blank" rel="noopener"
              class="flex-1 bg-[#ff2a2a] hover:bg-red-600 text-white font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all border border-[#ff2a2a]/50"><AppIcon name="whatsapp" :size="14" /> Précommander WhatsApp</a>
            <button @click="copyLink(detailProduct)"
              class="px-4 py-2.5 border border-zinc-800 text-zinc-400 hover:bg-zinc-900 text-xs font-semibold rounded-xl transition-colors">Copier lien</button>
            <button @click="clearDetail" class="px-4 py-2.5 border border-zinc-800 text-zinc-400 hover:bg-zinc-900 text-xs font-semibold rounded-xl transition-colors">Fermer</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Confirm permanent delete -->
    <div v-if="showDeleteModal" class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" @click.self="showDeleteModal = false">
      <div class="bg-[#0d0d14] border border-red-500/30 rounded-3xl w-full max-w-md shadow-2xl">
        <div class="flex items-start gap-3 p-5 border-b border-zinc-800">
          <div class="w-10 h-10 shrink-0 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400">
            <AppIcon name="trash" :size="20" />
          </div>
          <div>
            <h3 class="text-sm font-extrabold text-white font-mono uppercase tracking-wider">Suppression définitive</h3>
            <p class="text-[11px] text-zinc-400 mt-1.5 leading-relaxed">
              Vous allez définitivement supprimer ce listing — <span class="text-slate-100 font-bold">{{ pendingDelete?.title }}</span>. Cette action est irréversible, confirmez-vous ?
            </p>
          </div>
        </div>
        <div class="flex gap-2.5 p-5">
          <button @click="showDeleteModal = false"
            class="flex-1 border border-zinc-800 text-zinc-300 hover:bg-zinc-900 text-xs font-bold py-2.5 rounded-xl transition-colors font-mono">Annuler</button>
          <button @click="confirmPermanent" :disabled="deleting"
            class="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold py-2.5 rounded-xl transition-all font-mono flex items-center justify-center gap-2 disabled:opacity-50">
            <AppIcon name="trash" :size="14" /> {{ deleting ? 'Suppression...' : 'Supprimer définitivement' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>