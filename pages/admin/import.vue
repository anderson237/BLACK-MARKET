<script setup lang="ts">
// Admin import Xianyu / 1688 (ST-017)
// 1. Search by keyword -> results list
// 2. Click a result -> draft (full detail + gallery downloaded locally)
// 3. Edit title/desc/price -> publish to catalog (optional Gemini enrichment)
definePageMeta({ layout: 'admin' })

const config = useRuntimeConfig()
const justoneEnabled = computed(() => Boolean(config.public.justoneEnabled))

const platform = ref<'xianyu' | '1688'>('xianyu')
const keyword = ref('')
const searching = ref(false)
const searchError = ref('')
const results = ref<any[]>([])
const page = ref(1)
const sort = ref('active')

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

async function doSearch(reset = true) {
  const k = keyword.value.trim()
  if (!k) return
  searching.value = true
  searchError.value = ''
  successMsg.value = ''
  if (reset) page.value = 1
  try {
    const res = await $fetch('/api/admin/import/search', {
      params: { platform: platform.value, keyword: k, page: page.value, sort: sort.value },
    })
    results.value = (res as any).items || []
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
      body: { platform: item.platform, sourceId: item.sourceId },
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
      body: {
        platform: draft.value.platform,
        sourceId: draft.value.sourceId,
        title: publishTitle.value,
        description: publishDesc.value,
        chineseTitle: draft.value.chineseTitle,
        chineseDescription: draft.value.chineseDescription,
        priceCny: draft.value.priceCny,
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

const meta = computed(() => ({
  label: platform.value === 'xianyu' ? 'Xianyu (Goofish)' : '1688 (gros)',
}))
</script>

<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between gap-3">
      <div>
        <h1 class="text-lg font-extrabold font-mono uppercase tracking-widest text-white">Import Chine</h1>
        <p class="text-[11px] font-mono text-zinc-500 mt-0.5">Xianyu (Goofish) + 1688 — recherche, aperçu, publication (ST-017)</p>
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
      <!-- Search controls -->
      <div class="border border-zinc-800 rounded-xl p-4 bg-[#0d0d14] space-y-3">
        <div class="flex flex-wrap gap-2">
          <button
            @click="platform = 'xianyu'; results = []; page = 1"
            class="px-3 py-2 rounded-lg text-[11px] font-mono font-bold uppercase tracking-wider border transition-all"
            :class="platform === 'xianyu' ? 'bg-[#ff2a2a]/15 text-[#ff2a2a] border-[#ff2a2a]/40' : 'text-zinc-400 border-zinc-800 hover:text-white'"
          >Xianyu (occase)</button>
          <button
            @click="platform = '1688'; results = []; page = 0"
            class="px-3 py-2 rounded-lg text-[11px] font-mono font-bold uppercase tracking-wider border transition-all"
            :class="platform === '1688' ? 'bg-[#ff2a2a]/15 text-[#ff2a2a] border-[#ff2a2a]/40' : 'text-zinc-400 border-zinc-800 hover:text-white'"
          >1688 (gros)</button>
        </div>
        <div class="flex flex-wrap gap-2">
          <input
            v-model="keyword"
            @keyup.enter="doSearch(true)"
            placeholder="Mot-clé (ex: iphone, montre, sac…)"
            class="flex-1 min-w-[200px] bg-black/40 border border-zinc-800 rounded-lg px-3 py-2.5 text-[13px] text-white placeholder-zinc-600 focus:outline-none focus:border-[#ff2a2a]/60"
          />
          <select v-if="platform === 'xianyu'" v-model="sort"
            class="bg-black/40 border border-zinc-800 rounded-lg px-2.5 py-2.5 text-[11px] font-mono text-slate-200 focus:outline-none focus:border-[#ff2a2a]/60 cursor-pointer">
            <option value="active">Tri : actifs</option>
            <option value="recent">Tri : récents</option>
            <option value="credit">Tri : crédit</option>
            <option value="price_asc">Prix ↑</option>
            <option value="price_desc">Prix ↓</option>
            <option value="newest">Nouveautés</option>
          </select>
          <button
            @click="doSearch(true)"
            :disabled="searching"
            class="px-4 py-2.5 rounded-lg bg-[#ff2a2a] text-white text-[11px] font-mono font-bold uppercase tracking-wider hover:bg-[#ff3b3b] disabled:opacity-50 transition-all inline-flex items-center gap-2"
          >
            <span v-if="searching" class="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            Rechercher
          </button>
        </div>
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
              {{ item.platform === 'xianyu' ? 'XY' : '1688' }}
            </span>
            <span v-if="item.priceCny" class="absolute bottom-2 right-2 text-[11px] font-mono font-bold text-[#ff2a2a] bg-black/60 backdrop-blur px-2 py-0.5 rounded-lg">
              ¥{{ item.priceCny }}
            </span>
          </div>
          <div class="p-3 flex flex-col gap-1.5 flex-1">
            <p class="text-[12px] text-zinc-200 line-clamp-2 min-h-[32px]">{{ item.title }}</p>
            <p v-if="item.area" class="text-[10px] font-mono text-zinc-500">📍 {{ item.area }}</p>
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
    <div v-if="draftMode && draft" class="fixed inset-0 z-50 overflow-y-auto">
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
                  <p class="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1">Prix source (¥)</p>
                  <input type="number" :value="draft.priceCny" disabled class="w-full bg-black/20 border border-zinc-800 rounded-lg px-3 py-2 text-[12px] text-zinc-400" />
                </div>
                <div>
                  <p class="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1">Prix vente (XOF)</p>
                  <input v-model.number="publishPriceXof" type="number" class="w-full bg-black/40 border border-zinc-800 rounded-lg px-3 py-2 text-[12px] text-white focus:outline-none focus:border-[#ff2a2a]/60" />
                </div>
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
            <p v-if="draft.features?.length" class="text-[11px] font-mono text-zinc-400 mt-1">
              Caractéristiques : <span v-for="(f, i) in draft.features" :key="i" class="mr-2">{{ f.name }} : {{ f.value }}</span>
            </p>
          </div>

          <!-- Category + features + AI -->
          <div class="space-y-2">
            <div>
              <p class="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-1">Catégorie</p>
              <input v-model="publishCategory" placeholder="ex : Téléphones" class="w-full bg-black/40 border border-zinc-800 rounded-lg px-3 py-2 text-[12px] text-white focus:outline-none focus:border-[#ff2a2a]/60" />
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
        </div>
      </div>
    </div>

    <!-- success toast -->
    <div v-if="successMsg" class="fixed bottom-4 right-4 z-50 border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-[12px] font-mono rounded-xl px-4 py-3 backdrop-blur">
      {{ successMsg }}
    </div>
  </div>
</template>