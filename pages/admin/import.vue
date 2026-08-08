<script setup lang="ts">
// Admin import multi-plateforme (ST-017)
// 1. Search by keyword -> results list (cached in history, "Nouveautés API" refreshes)
// 2. Click a result -> draft (full detail + gallery downloaded locally)
// 3. Edit title/desc/price -> publish to catalog (optional Gemini enrichment)
// 4. Prices: source (¥/€/$) / CFA (conversion) / marché local (table, optional)
// 5. Transport estimate (air ~10 000 CFA/kg, sea ~320 000 CFA/m³, emballage inclus)
// 6. Trending signals: Amazon best-seller, Douyin ventes 30 j, Taobao ventes…
definePageMeta({ layout: 'admin' })

const config = useRuntimeConfig()
const justoneEnabled = computed(() => Boolean(config.public.justoneEnabled))

const PLATFORMS = [
  { id: 'xianyu', label: 'Xianyu (occase)', short: 'XY', color: 'text-[#ff2a2a]' },
  { id: '1688', label: '1688 (gros)', short: '1688', color: 'text-sky-400' },
  { id: 'taobao', label: 'Taobao / Tmall', short: 'TB', color: 'text-orange-400' },
  { id: 'tiktok-shop', label: 'TikTok Shop', short: 'TT', color: 'text-fuchsia-400' },
  { id: 'amazon', label: 'Amazon', short: 'AMZ', color: 'text-amber-400' },
  { id: 'douyin-ec', label: 'Douyin', short: 'DY', color: 'text-emerald-400' },
] as const
type PlatformId = (typeof PLATFORMS)[number]['id']

const REGION_PLATFORMS = new Set<PlatformId>(['tiktok-shop', 'amazon'])

const SORTS: Record<string, { value: string; label: string }[]> = {
  xianyu: [
    { value: 'active', label: 'Tri : actifs' },
    { value: 'recent', label: 'Tri : récents' },
    { value: 'credit', label: 'Tri : crédit' },
    { value: 'price_asc', label: 'Prix ↑' },
    { value: 'price_desc', label: 'Prix ↓' },
    { value: 'newest', label: 'Nouveautés' },
  ],
  taobao: [
    { value: '_sale', label: 'Ventes' },
    { value: '_bid', label: 'Prix décroissant' },
    { value: 'bid', label: 'Prix croissant' },
    { value: '_coefp', label: 'Général' },
  ],
  amazon: [
    { value: 'RELEVANCE', label: 'Pertinence' },
    { value: 'BEST_SELLERS', label: 'Meilleures ventes' },
    { value: 'REVIEWS', label: 'Avis' },
    { value: 'NEWEST', label: 'Nouveautés' },
    { value: 'LOWEST_PRICE', label: 'Prix croissant' },
    { value: 'HIGHEST_PRICE', label: 'Prix décroissant' },
  ],
}

const platform = ref<PlatformId>('xianyu')
const region = ref<'US' | 'FR'>('US')
const keyword = ref('')
const searching = ref(false)
const searchError = ref('')
const results = ref<any[]>([])
const page = ref(1)
const sort = ref('')
const cached = ref(false) // true when the results came from the history cache

const curPlatform = computed(() => PLATFORMS.find((p) => p.id === platform.value) || PLATFORMS[0])
const platformSorts = computed(() => SORTS[platform.value] || [])
const showsRegion = computed(() => REGION_PLATFORMS.has(platform.value))

function currencySymbol(cur?: string): string {
  if (cur === 'EUR') return '€'
  if (cur === 'USD') return '$'
  return '¥'
}

function fmtPrice(item: any): string {
  return `${currencySymbol(item.currency)}${item.price ?? item.priceCny ?? 0}`
}

// History (cached searches)
const history = ref<any[]>([])
const historyLoading = ref(false)

// Draft / publish
const draftMode = ref(false)
const drafting = ref(false)
const draft = ref<any>(null)
const publishTitle = ref('')
const publishDesc = ref('')
const publishPriceXof = ref(0)
const publishFeatures = ref<string[]>([])
const publishCategory = ref('')
const aiEnrich = ref(true)
const publishing = ref(false)
const publishError = ref('')
const successMsg = ref('')

// Local market prices table (third price)
const localPrices = ref<any[]>([])
const localPriceLabel = ref('')
const localPriceMatch = ref('')
const localPriceXof = ref(0)
const localPriceSource = ref('')
const localPriceSaving = ref(false)

// Transport config + estimate
const transportConfig = ref<any>(null)
const transportTab = ref(false)

function authHeaders(): Record<string, string> {
  const auth = useAuthStore()
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (auth.token) headers.Authorization = `Bearer ${auth.token}`
  return headers
}

async function loadHistory() {
  historyLoading.value = true
  try {
    const res = await $fetch('/api/admin/import/history', { headers: authHeaders() })
    history.value = (res as any).history || []
  } catch {
    /* non-blocking */
  } finally {
    historyLoading.value = false
  }
}

async function clearHistory() {
  try {
    await $fetch('/api/admin/import/history', { method: 'DELETE', headers: authHeaders() })
    history.value = []
    successMsg.value = 'Historique vidé'
  } catch (e: any) {
    searchError.value = e?.data?.statusMessage || e?.message || 'Erreur'
  }
}

function loadFromHistory(entry: any) {
  platform.value = entry.platform
  keyword.value = entry.keyword
  sort.value = entry.sort || ''
  page.value = entry.page
  region.value = entry.region || 'US'
  results.value = entry.items || []
  cached.value = true
  searchError.value = ''
  successMsg.value = `Recherche chargée depuis l'historique (cache)`
}

async function doSearch(reset = true, fresh = false) {
  const k = keyword.value.trim()
  if (!k) return
  searching.value = true
  searchError.value = ''
  successMsg.value = ''
  if (reset) page.value = 1
  try {
    const res = await $fetch('/api/admin/import/search', {
      method: 'GET',
      headers: authHeaders(),
      params: { platform: platform.value, keyword: k, page: page.value, sort: sort.value, region: region.value, fresh: fresh ? 1 : 0 },
    })
    results.value = (res as any).items || []
    cached.value = Boolean((res as any).cached)
    if (fresh) successMsg.value = 'Nouveautés récupérées depuis l\'API'
    else if (cached.value) successMsg.value = 'Résultats depuis l\'historique (cache)'
    loadHistory()
  } catch (e: any) {
    searchError.value = e?.data?.statusMessage || e?.message || 'Erreur de recherche'
    results.value = []
  } finally {
    searching.value = false
  }
}

function nextPage() {
  page.value += 1
  doSearch(false)
}

function prevPage() {
  if (page.value <= 1) return
  page.value -= 1
  doSearch(false)
}

async function openDraft(item: any) {
  drafting.value = true
  draftMode.value = true
  draft.value = null
  publishError.value = ''
  successMsg.value = ''
  try {
    const res = await $fetch('/api/admin/import/draft', {
      method: 'POST',
      headers: authHeaders(),
      body: { platform: item.platform, sourceId: item.sourceId, titleFr: item.titleFr || '', keyword: keyword.value, region: region.value },
    })
    const d = (res as any).draft
    draft.value = d
    publishTitle.value = d.title || ''
    publishDesc.value = d.description || ''
    publishPriceXof.value = d.priceXof || 0
    publishFeatures.value = Array.isArray(d.features) ? d.features.map((f: any) => f.value || f) : []
    publishCategory.value = ''
  } catch (e: any) {
    publishError.value = e?.data?.statusMessage || e?.message || 'Erreur d\u2019import du produit'
  } finally {
    drafting.value = false
  }
}

function closeDraft() {
  draftMode.value = false
  draft.value = null
}

function addFeature() {
  publishFeatures.value.push('')
}
function removeFeature(i: number) {
  publishFeatures.value.splice(i, 1)
}

async function doPublish() {
  if (!draft.value) return
  publishing.value = true
  publishError.value = ''
  successMsg.value = ''
  try {
    const res = await $fetch('/api/admin/import/publish', {
      method: 'POST',
      headers: authHeaders(),
      body: {
        platform: draft.value.platform,
        sourceId: draft.value.sourceId,
        title: publishTitle.value,
        description: publishDesc.value,
        chineseTitle: draft.value.chineseTitle,
        chineseDescription: draft.value.chineseDescription,
        price: draft.value.price,
        currency: draft.value.currency || 'CNY',
        imageUrl: draft.value.imageUrl,
        gallery: draft.value.gallery || [],
        features: publishFeatures.value.filter(Boolean),
        category: publishCategory.value,
        aiEnrich: aiEnrich.value,
      },
    })
    successMsg.value = `Produit publié ✓ (${(res as any).id})`
    const store = useAdminStore()
    store.loadProducts()
    closeDraft()
  } catch (e: any) {
    publishError.value = e?.data?.statusMessage || e?.message || 'Erreur de publication'
  } finally {
    publishing.value = false
  }
}

// ---- local market prices ----
async function loadLocalPrices() {
  try {
    const res = await $fetch('/api/admin/import/local-prices', { headers: authHeaders() })
    localPrices.value = (res as any).prices || []
  } catch {
    /* non-blocking */
  }
}

async function saveLocalPrice() {
  if (!localPriceLabel.value.trim() || !localPriceMatch.value.trim() || !(localPriceXof.value > 0)) return
  localPriceSaving.value = true
  try {
    const res = await $fetch('/api/admin/import/local-prices', {
      method: 'POST',
      headers: authHeaders(),
      body: {
        label: localPriceLabel.value,
        match: localPriceMatch.value,
        priceXof: localPriceXof.value,
        source: localPriceSource.value,
      },
    })
    localPrices.value = (res as any).prices || []
    localPriceLabel.value = ''
    localPriceMatch.value = ''
    localPriceXof.value = 0
    localPriceSource.value = ''
    successMsg.value = 'Prix local ajouté'
  } catch (e: any) {
    searchError.value = e?.data?.statusMessage || e?.message || 'Erreur'
  } finally {
    localPriceSaving.value = false
  }
}

async function removeLocalPrice(id: string) {
  try {
    const res = await $fetch(`/api/admin/import/local-prices/${id}`, { method: 'DELETE', headers: authHeaders() })
    localPrices.value = (res as any).prices || []
    successMsg.value = 'Prix local supprimé'
  } catch {
    /* non-blocking */
  }
}

// ---- transport config ----
async function loadTransportConfig() {
  try {
    const res = await $fetch('/api/admin/import/transport', { headers: authHeaders() })
    transportConfig.value = (res as any).config || null
  } catch {
    /* non-blocking */
  }
}

async function saveTransportConfig() {
  if (!transportConfig.value) return
  try {
    const res = await $fetch('/api/admin/import/transport', {
      method: 'PUT',
      headers: authHeaders(),
      body: transportConfig.value,
    })
    transportConfig.value = (res as any).config || transportConfig.value
    successMsg.value = 'Configuration transport enregistrée'
  } catch (e: any) {
    searchError.value = e?.data?.statusMessage || e?.message || 'Erreur'
  }
}

const meta = computed(() => ({
  label: curPlatform.value.label,
}))

function fmtXof(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n || 0))
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso || ''
  }
}

// Transport estimate for a category (based on the draft + configured rates).
function transportFor(cat: string) {
  if (!transportConfig.value) return null
  const key = Object.keys(transportConfig.value.categories || {}).find(
    (k) => k.toLowerCase() === String(cat || '').trim().toLowerCase(),
  ) || 'Autre'
  const c = transportConfig.value.categories[key]
  if (!c) return null
  return {
    airXof: Math.round(c.weightKg * (transportConfig.value.airXofPerKg || 10000)),
    seaXof: Math.round(c.volumeCbm * (transportConfig.value.seaXofPerCbm || 320000)),
    weightKg: c.weightKg,
    volumeCbm: c.volumeCbm,
  }
}

onMounted(() => {
  loadHistory()
  loadLocalPrices()
  loadTransportConfig()
})
</script>

<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between gap-3">
      <div>
        <h1 class="text-lg font-extrabold font-mono uppercase tracking-widest text-white">Import Multi-Plateforme</h1>
        <p class="text-[11px] font-mono text-zinc-500 mt-0.5">Xianyu · 1688 · Taobao · TikTok Shop · Amazon · Douyin — recherche, aperçu, publication (ST-017)</p>
      </div>
      <div class="flex items-center gap-2">
        <span v-if="justoneEnabled" class="text-[10px] font-mono text-emerald-400 border border-emerald-500/30 px-2.5 py-1.5 rounded-lg">API connectée</span>
        <span v-else class="text-[10px] font-mono text-zinc-500 border border-zinc-800 px-2.5 py-1.5 rounded-lg">API non configurée</span>
      </div>
    </div>

    <!-- Not configured banner -->
    <div v-if="!justoneEnabled" class="border border-zinc-800 rounded-xl p-4 bg-[#0d0d14]">
      <p class="text-[12px] font-mono text-zinc-400">
        JUSTONE_API_KEY absent : l'import est désactivé. Ajoutez la clé Just One API dans l'environnement Netlify
        (dashboard.justoneapi.com) puis redéployez.
      </p>
    </div>

    <template v-else>
      <!-- History (cached searches) -->
      <div v-if="history.length" class="border border-zinc-800 rounded-xl p-4 bg-[#0d0d14] space-y-2">
        <div class="flex items-center justify-between gap-3">
          <p class="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Historique des recherches (cache)</p>
          <button @click="clearHistory" class="text-[10px] font-mono text-red-400 hover:text-red-300">Vider l'historique</button>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="h in history"
            :key="h.key"
            @click="loadFromHistory(h)"
            class="px-2.5 py-1.5 rounded-lg border border-zinc-800 text-[10px] font-mono text-zinc-300 hover:text-white hover:border-[#ff2a2a]/40 transition-all text-left"
          >
            <span class="text-[#ff2a2a]">{{ PLATFORMS.find((p) => p.id === h.platform)?.short || h.platform }}</span> {{ h.keyword }}
            <span class="text-zinc-600">p{{ h.page }}</span>
            <span v-if="h.region" class="text-zinc-600">[{{ h.region }}]</span>
            <span class="text-zinc-600 ml-1">({{ (h.items || []).length }})</span>
          </button>
        </div>
      </div>

      <!-- Search controls -->
      <div class="border border-zinc-800 rounded-xl p-4 bg-[#0d0d14] space-y-3">
        <div class="flex flex-wrap gap-2">
          <button
            v-for="p in PLATFORMS"
            :key="p.id"
            @click="platform = p.id; results = []; page = 1; sort = ''"
            class="px-3 py-2 rounded-lg text-[11px] font-mono font-bold uppercase tracking-wider border transition-all"
            :class="platform === p.id ? 'bg-[#ff2a2a]/15 text-[#ff2a2a] border-[#ff2a2a]/40' : 'text-zinc-400 border-zinc-800 hover:text-white'"
          >{{ p.label }}</button>
        </div>
        <div class="flex flex-wrap gap-2">
          <div v-if="showsRegion" class="flex items-center gap-1.5 bg-black/30 border border-zinc-800 rounded-lg px-2.5">
            <span class="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Région</span>
            <button
              @click="region = 'US'"
              class="px-2 py-2 text-[11px] font-mono font-bold"
              :class="region === 'US' ? 'text-[#ff2a2a]' : 'text-zinc-500 hover:text-white'"
            >US</button>
            <button
              @click="region = 'FR'"
              class="px-2 py-2 text-[11px] font-mono font-bold"
              :class="region === 'FR' ? 'text-[#ff2a2a]' : 'text-zinc-500 hover:text-white'"
            >FR</button>
          </div>
          <input
            v-model="keyword"
            @keyup.enter="doSearch(true)"
            placeholder="Mot-clé (ex: iphone, montre, sac…)"
            class="flex-1 min-w-[200px] bg-black/40 border border-zinc-800 rounded-lg px-3 py-2.5 text-[13px] text-white placeholder-zinc-600 focus:outline-none focus:border-[#ff2a2a]/60"
          />
          <select v-if="platformSorts.length" v-model="sort"
            class="bg-black/40 border border-zinc-800 rounded-lg px-2.5 py-2.5 text-[11px] font-mono text-slate-200 focus:outline-none focus:border-[#ff2a2a]/60 cursor-pointer">
            <option value="" v-if="!platformSorts.some((s) => s.value === '')">Tri…</option>
            <option v-for="s in platformSorts" :key="s.value" :value="s.value">{{ s.label }}</option>
          </select>
          <button
            @click="doSearch(true)"
            :disabled="searching"
            class="px-4 py-2.5 rounded-lg bg-[#ff2a2a] text-white text-[11px] font-mono font-bold uppercase tracking-wider hover:bg-[#ff3b3b] disabled:opacity-50 transition-all inline-flex items-center gap-2"
          >
            <span v-if="searching" class="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            Rechercher
          </button>
          <button
            v-if="cached || results.length"
            @click="doSearch(false, true)"
            :disabled="searching"
            class="px-4 py-2.5 rounded-lg border border-emerald-500/30 text-emerald-400 text-[11px] font-mono font-bold uppercase tracking-wider hover:bg-emerald-500/10 disabled:opacity-50 transition-all inline-flex items-center gap-2"
          >
            <span v-if="searching" class="w-3.5 h-3.5 border-2 border-emerald-500/40 border-t-emerald-400 rounded-full animate-spin" />
            Nouveautés depuis l'API
          </button>
        </div>
        <p v-if="cached" class="text-[10px] font-mono text-emerald-500">💾 Résultats chargés depuis l'historique — aucun appel API facturé. Cliquez « Nouveautés depuis l'API » pour rafraîchir.</p>
        <p v-if="searchError" class="text-[11px] font-mono text-red-400">{{ searchError }}</p>
      </div>

      <!-- Results -->
      <div v-if="results.length" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div
          v-for="(item, i) in results"
          :key="item.sourceId + i"
          class="border border-zinc-800 rounded-xl overflow-hidden bg-[#0d0d14] flex flex-col group"
        >
          <div class="aspect-square relative bg-black/40">
            <img v-if="item.imageUrl" :src="item.imageUrl" :alt="item.title" class="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy" />
            <div v-else class="absolute inset-0 grid place-items-center text-zinc-700 text-[10px] font-mono">no img</div>
            <span class="absolute top-2 left-2 text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-black/60 text-white backdrop-blur">
              {{ PLATFORMS.find((p) => p.id === item.platform)?.short || item.platform }}
            </span>
            <span v-if="item.isBestSeller" class="absolute top-2 right-2 text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/80 text-black font-bold">BEST</span>
            <span v-if="item.price" class="absolute bottom-2 right-2 text-[11px] font-mono font-bold text-[#ff2a2a] bg-black/60 backdrop-blur px-2 py-0.5 rounded-lg">
              {{ fmtPrice(item) }}
            </span>
          </div>
          <div class="p-3 flex flex-col gap-1.5 flex-1">
            <p class="text-[12px] text-zinc-200 line-clamp-2 min-h-[32px]">{{ item.titleFr || item.title }}</p>
            <div class="space-y-0.5">
              <p class="text-[11px] font-mono text-zinc-400">{{ fmtPrice(item) }} <span class="text-emerald-400">≈ {{ fmtXof(item.priceXof) }} FCFA</span></p>
              <p v-if="item.localPriceXof" class="text-[11px] font-mono text-amber-400">🏷️ Marché local : {{ fmtXof(item.localPriceXof) }} FCFA</p>
              <div v-if="item.sales || item.rating || item.isAmazonChoice" class="flex flex-wrap gap-1.5 pt-0.5">
                <span v-if="item.sales" class="text-[10px] font-mono text-sky-400">🛒 {{ item.sales }} ventes</span>
                <span v-if="item.rating" class="text-[10px] font-mono text-zinc-400">⭐ {{ Number(item.rating).toFixed(1) }}</span>
                <span v-if="item.ratingCount" class="text-[10px] font-mono text-zinc-500">({{ item.ratingCount }})</span>
                <span v-if="item.isAmazonChoice" class="text-[10px] font-mono text-emerald-400">🏆 Choix Amazon</span>
              </div>
            </div>
            <p v-if="item.area || item.shopName" class="text-[10px] font-mono text-zinc-500">📍 {{ item.shopName || item.area }}</p>
            <button
              @click="draftMode = item; openDraft(item)"
              :disabled="drafting && draftMode === item"
              class="mt-auto w-full px-3 py-2 rounded-lg border text-[10px] font-mono font-bold uppercase tracking-wider transition-all inline-flex items-center justify-center gap-2"
              :class="drafting && draftMode === item ? 'text-zinc-500 border-zinc-800' : 'text-[#ff2a2a] border-[#ff2a2a]/30 hover:bg-[#ff2a2a]/10'"
            >
              <span v-if="drafting && draftMode === item" class="w-3 h-3 border-2 border-zinc-600 border-t-white rounded-full animate-spin" />
              Aperçu
            </button>
          </div>
        </div>
      </div>

      <!-- Empty -->
      <div v-else-if="!searching && results.length === 0" class="border border-dashed border-zinc-800 rounded-xl p-8 text-center">
        <p class="text-[12px] font-mono text-zinc-500">Lancez une recherche pour voir les produits.</p>
      </div>

      <!-- Pagination -->
      <div v-if="results.length" class="flex items-center justify-center gap-2 pt-1">
        <button @click="prevPage" :disabled="page <= 1" class="px-3 py-2 rounded-lg border border-zinc-800 text-[11px] font-mono text-zinc-300 hover:text-white disabled:opacity-40">← Préc.</button>
        <span class="text-[11px] font-mono text-zinc-500">p. {{ page }}</span>
        <button @click="nextPage" class="px-3 py-2 rounded-lg border border-zinc-800 text-[11px] font-mono text-zinc-300 hover:text-white">Suiv. →</button>
      </div>
    </template>

    <!-- Draft modal -->
    <div v-if="draftMode" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="min-h-full flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" @click="closeDraft" />
        <div class="relative w-full max-w-3xl bg-[#10101a] border border-zinc-800 rounded-2xl shadow-2xl p-5 sm:p-6 space-y-4">
          <div class="flex items-center justify-between gap-3">
            <h2 class="text-sm font-extrabold font-mono uppercase tracking-widest text-white">Aperçu produit</h2>
            <button @click="closeDraft" class="w-8 h-8 rounded-lg border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white">
              <AppIcon name="close" :size="14" />
            </button>
          </div>

          <div v-if="publishError" class="text-[11px] font-mono text-red-400 border border-red-500/30 rounded-lg p-3">{{ publishError }}</div>

          <div v-if="drafting && !draft" class="flex flex-col items-center justify-center py-16 gap-3">
            <span class="w-8 h-8 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
            <p class="text-[11px] font-mono text-zinc-500">Chargement du produit…</p>
          </div>

          <template v-else-if="draft">
          <div class="flex gap-4 flex-col sm:flex-row">
            <div class="sm:w-44 shrink-0 space-y-2">
              <div class="aspect-square rounded-xl overflow-hidden border border-zinc-800 bg-black/40">
                <img v-if="draft.imageUrl" :src="draft.imageUrl" alt="" class="w-full h-full object-cover" />
              </div>
              <div v-if="draft.gallery?.length" class="grid grid-cols-5 gap-1">
                <img v-for="(g, i) in draft.gallery.slice(0, 5)" :key="i" :src="g" alt="" class="aspect-square object-cover rounded border border-zinc-800" loading="lazy" />
              </div>
            </div>
            <div class="flex-1 min-w-0 space-y-3">
              <div>
                <p class="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1">Titre FR</p>
                <input v-model="publishTitle" class="w-full bg-black/40 border border-zinc-800 rounded-lg px-3 py-2 text-[13px] text-white focus:outline-none focus:border-[#ff2a2a]/60" />
              </div>
              <div>
                <p class="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1">Description</p>
                <textarea v-model="publishDesc" rows="3" class="w-full bg-black/40 border border-zinc-800 rounded-lg px-3 py-2 text-[12px] text-white focus:outline-none focus:border-[#ff2a2a]/60 resize-y"></textarea>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <p class="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1">Prix source ({{ currencySymbol(draft.currency) }})</p>
                  <input type="number" :value="draft.price" disabled class="w-full bg-black/20 border border-zinc-800 rounded-lg px-3 py-2 text-[12px] text-zinc-400" />
                  <p class="text-[9px] font-mono text-zinc-600 mt-1">
                    {{ draft.currency === 'EUR' ? '1 € = 655,957 FCFA' : draft.currency === 'USD' ? '1 $ ≈ 700 FCFA' : '1 ¥ = 95 FCFA' }}
                  </p>
                </div>
                <div>
                  <p class="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1">Prix vente (XOF)</p>
                  <input v-model.number="publishPriceXof" type="number" class="w-full bg-black/40 border border-zinc-800 rounded-lg px-3 py-2 text-[12px] text-white focus:outline-none focus:border-[#ff2a2a]/60" />
                </div>
              </div>
              <div v-if="draft.localPriceXof" class="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
                <p class="text-[11px] font-mono text-amber-400">🏷️ Marché local : {{ fmtXof(draft.localPriceXof) }} FCFA <span v-if="draft.localPriceLabel" class="text-amber-500/70">({{ draft.localPriceLabel }})</span></p>
              </div>
              <div v-if="transportFor(publishCategory)" class="rounded-lg border border-sky-500/30 bg-sky-500/5 px-3 py-2 space-y-1">
                <p class="text-[10px] font-mono text-sky-400 uppercase tracking-widest">🚚 Transport estimé (emballage inclus)</p>
                <p class="text-[11px] font-mono text-zinc-300">
                  ✈️ Aérien : <span class="text-sky-300">{{ fmtXof(transportFor(publishCategory).airXof) }} FCFA</span>
                  <span class="text-zinc-600">({{ transportFor(publishCategory).weightKg }} kg)</span>
                </p>
                <p class="text-[11px] font-mono text-zinc-300">
                  🚢 Maritime : <span class="text-sky-300">{{ fmtXof(transportFor(publishCategory).seaXof) }} FCFA</span>
                  <span class="text-zinc-600">({{ transportFor(publishCategory).volumeCbm }} m³)</span>
                </p>
              </div>
            </div>
          </div>

          <!-- Condition & seller -->
          <div v-if="draft.condition || draft.seller" class="border border-zinc-800 rounded-xl p-3 space-y-1.5 bg-[#08080c]">
            <p v-if="draft.condition" class="text-[11px] font-mono text-zinc-300">
              État : <span class="text-amber-400">{{ draft.condition }}</span>
            </p>
            <p v-if="draft.seller?.city" class="text-[11px] font-mono text-zinc-500">📍 {{ draft.seller.city }}</p>
            <div v-if="draft.seller" class="flex flex-wrap gap-2 text-[10px] font-mono">
              <span v-if="draft.seller.goodRemarkCnt" class="text-emerald-400">👍 {{ draft.seller.goodRemarkCnt }} avis positifs</span>
              <span v-if="draft.seller.badRemarkCnt" class="text-red-400">👎 {{ draft.seller.badRemarkCnt }} négatifs</span>
              <span v-if="draft.seller.soldCount" class="text-sky-400">🛒 {{ draft.seller.soldCount }} ventes</span>
              <span v-if="draft.seller.replyRatio24h" class="text-zinc-400">Rép. 24h : {{ draft.seller.replyRatio24h }}</span>
              <span v-if="draft.seller.newGoodRatioRate" class="text-zinc-400">Neuf : {{ draft.seller.newGoodRatioRate }}</span>
              <span v-if="draft.seller.zhimaVerified" class="text-emerald-300">✅ Vérifié Zhima</span>
            </div>
            <p v-if="draft.metrics?.wantCnt" class="text-[11px] font-mono text-zinc-400">💛 {{ draft.metrics.wantCnt }} personnes le veulent</p>
            <div v-if="draft.sales || draft.rating" class="flex flex-wrap gap-2 text-[10px] font-mono">
              <span v-if="draft.sales" class="text-sky-400">🛒 {{ draft.sales }} ventes</span>
              <span v-if="draft.rating" class="text-zinc-400">⭐ {{ Number(draft.rating).toFixed(1) }} <span v-if="draft.ratingCount">({{ draft.ratingCount }} avis)</span></span>
            </div>
            <p v-if="draft.url" class="text-[10px] font-mono text-zinc-500 break-all">🔗 <a :href="draft.url" target="_blank" rel="noopener" class="text-sky-400 hover:underline">{{ draft.url }}</a></p>
            <p v-if="draft.features?.length" class="text-[11px] font-mono text-zinc-400 mt-1">
              Caractéristiques : <span v-for="(f, i) in draft.features" :key="i" class="mr-2">{{ f.name }} : {{ f.value }}</span>
            </p>
          </div>

          <!-- Category + features + AI -->
          <div class="space-y-2">
            <div>
              <p class="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1">Catégorie (pour l'estimation transport)</p>
              <select
                v-model="publishCategory"
                class="w-full bg-black/40 border border-zinc-800 rounded-lg px-3 py-2 text-[12px] text-white focus:outline-none focus:border-[#ff2a2a]/60 cursor-pointer"
              >
                <option value="">— Choisir —</option>
                <option v-for="(c, key) in transportConfig?.categories || {}" :key="key" :value="key">{{ key }}</option>
              </select>
            </div>
            <div>
              <div class="flex items-center justify-between">
                <p class="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1">Features (1 ligne = 1 feature)</p>
                <button @click="addFeature" class="text-[10px] font-mono text-[#ff2a2a]">+ Ajouter</button>
              </div>
              <div class="space-y-1.5">
                <input
                  v-for="(f, i) in publishFeatures"
                  :key="i"
                  v-model="publishFeatures[i]"
                  class="w-full bg-black/40 border border-zinc-800 rounded-lg px-3 py-1.5 text-[12px] text-white focus:outline-none focus:border-[#ff2a2a]/60"
                />
              </div>
            </div>
            <label class="flex items-center gap-2 text-[11px] font-mono text-zinc-300 cursor-pointer">
              <input v-model="aiEnrich" type="checkbox" class="accent-[#ff2a2a]" />
              Enrichissement IA (traduction FR + copywriting + suggestion de prix)
            </label>
          </div>

          <div class="flex flex-wrap gap-2 pt-1">
            <button
              @click="doPublish"
              :disabled="publishing || !publishTitle.trim()"
              class="px-4 py-2.5 rounded-lg bg-[#ff2a2a] text-white text-[11px] font-mono font-bold uppercase tracking-wider hover:bg-[#ff3b3b] disabled:opacity-50 transition-all inline-flex items-center gap-2"
            >
              <span v-if="publishing" class="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Publier dans le catalogue
            </button>
            <button @click="closeDraft" class="px-4 py-2.5 rounded-lg border border-zinc-800 text-[11px] font-mono text-zinc-400 hover:text-white transition-all">Annuler</button>
          </div>
          </template>
        </div>
      </div>
    </div>

    <!-- success toast -->
    <div v-if="successMsg" class="fixed bottom-4 right-4 z-50 border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-[12px] font-mono rounded-xl px-4 py-3 backdrop-blur">
      {{ successMsg }}
    </div>

    <!-- Local market prices manager (3rd price) -->
    <div class="border border-zinc-800 rounded-xl p-4 bg-[#0d0d14] space-y-3">
      <div class="flex items-center justify-between gap-3">
        <p class="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Prix marché local (3e prix — affiché seulement si une correspondance existe)</p>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <input v-model="localPriceLabel" placeholder="Libellé (ex: iPhone 16)" class="bg-black/40 border border-zinc-800 rounded-lg px-3 py-2 text-[12px] text-white placeholder-zinc-600 focus:outline-none focus:border-[#ff2a2a]/60" />
        <input v-model="localPriceMatch" placeholder="Mot-clé (ex: iphone16)" class="bg-black/40 border border-zinc-800 rounded-lg px-3 py-2 text-[12px] text-white placeholder-zinc-600 focus:outline-none focus:border-[#ff2a2a]/60" />
        <input v-model.number="localPriceXof" type="number" placeholder="Prix CFA" class="bg-black/40 border border-zinc-800 rounded-lg px-3 py-2 text-[12px] text-white placeholder-zinc-600 focus:outline-none focus:border-[#ff2a2a]/60" />
        <input v-model="localPriceSource" placeholder="Source (optionnel)" class="bg-black/40 border border-zinc-800 rounded-lg px-3 py-2 text-[12px] text-white placeholder-zinc-600 focus:outline-none focus:border-[#ff2a2a]/60" />
        <button @click="saveLocalPrice" :disabled="localPriceSaving" class="px-3 py-2 rounded-lg bg-[#ff2a2a] text-white text-[10px] font-mono font-bold uppercase tracking-wider hover:bg-[#ff3b3b] disabled:opacity-50">+ Ajouter</button>
      </div>
      <div v-if="localPrices.length" class="flex flex-wrap gap-2">
        <span v-for="p in localPrices" :key="p.id" class="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-zinc-800 text-[10px] font-mono text-zinc-300">
          <span class="text-amber-400">{{ p.label }}</span>
          <span class="text-zinc-500">« {{ p.match }} »</span>
          <span class="text-emerald-400">{{ fmtXof(p.priceXof) }} F</span>
          <button @click="removeLocalPrice(p.id)" class="text-red-400 hover:text-red-300">✕</button>
        </span>
      </div>
    </div>

    <!-- Transport config manager -->
    <div class="border border-zinc-800 rounded-xl p-4 bg-[#0d0d14] space-y-3">
      <div class="flex items-center justify-between gap-3">
        <p class="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Estimation transport transitaire (emballage inclus)</p>
        <button @click="saveTransportConfig" class="text-[10px] font-mono text-emerald-400 hover:text-emerald-300">Enregistrer</button>
      </div>
      <p class="text-[10px] font-mono text-zinc-500">Sources marché 2026 : aérien 3–9,5 $/kg (~2 000–5 700 FCFA/kg) ; maritime LCL 50–250 $/m³ (~30 000–150 000 FCFA/m³). Joe Cargo tout-inclus (DDP) : aérien ≈ 10 000 FCFA/kg, maritime ≈ 320 000 FCFA/m³.</p>
      <div v-if="transportConfig" class="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <label class="flex flex-col gap-1 text-[10px] font-mono text-zinc-400">
          Fret aérien (FCFA/kg)
          <input v-model.number="transportConfig.airXofPerKg" type="number" class="bg-black/40 border border-zinc-800 rounded-lg px-3 py-2 text-[12px] text-white" />
        </label>
        <label class="flex flex-col gap-1 text-[10px] font-mono text-zinc-400">
          Fret maritime (FCFA/m³)
          <input v-model.number="transportConfig.seaXofPerCbm" type="number" class="bg-black/40 border border-zinc-800 rounded-lg px-3 py-2 text-[12px] text-white" />
        </label>
      </div>
      <div v-if="transportConfig" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        <div v-for="(c, key) in transportConfig.categories" :key="key" class="border border-zinc-800 rounded-lg p-2 space-y-1.5">
          <p class="text-[10px] font-mono text-zinc-300">{{ key }}</p>
          <div class="flex gap-2">
            <label class="flex-1 flex flex-col gap-0.5 text-[9px] font-mono text-zinc-500">
              kg
              <input v-model.number="c.weightKg" type="number" step="0.01" class="bg-black/40 border border-zinc-800 rounded px-2 py-1 text-[11px] text-white" />
            </label>
            <label class="flex-1 flex flex-col gap-0.5 text-[9px] font-mono text-zinc-500">
              m³
              <input v-model.number="c.volumeCbm" type="number" step="0.001" class="bg-black/40 border border-zinc-800 rounded px-2 py-1 text-[11px] text-white" />
            </label>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>