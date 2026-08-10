<script setup lang="ts">
// ST-019 — Gestionnaire de fournisseurs (dashboard admin).
// Liste des fournisseurs (auto = capture import + manuel = ajout dashboard),
// recherche, filtre auto/manuel, modal d'édition, création manuelle et liste
// des produits associés (accordéon).
definePageMeta({ layout: 'admin' })

const store = useAdminStore()

const loading = ref(false)
const error = ref('')
const suppliers = ref<any[]>([])
const search = ref('')
const filterMode = ref<'all' | 'auto' | 'manual'>('all')
const expanded = ref<Record<string, boolean>>({})

// ---- Modals ----
const showModal = ref(false)
const editing = ref<any | null>(null) // null = creation, sinon fournisseur édité
const saving = ref(false)
const form = ref({
  name: '',
  category: '',
  country: '',
  platforms: '',
  wechat: '',
  email: '',
  whatsapp: '',
  phone: '',
  website: '',
  note: '',
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    const q = filterMode.value === 'all' ? '' : `?auto=${filterMode.value === 'auto' ? 'true' : 'false'}`
    const res = await fetch(`/api/admin/suppliers${q}`, { headers: store.headers() })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json?.statusMessage || json?.message || `Erreur ${res.status}`)
    suppliers.value = Array.isArray(json?.suppliers) ? json.suppliers : []
  } catch (e: any) {
    error.value = e?.message || 'Impossible de charger les fournisseurs.'
  } finally {
    loading.value = false
  }
}

function refresh() {
  load()
  store.loadProducts()
}

onMounted(() => {
  refresh()
})

// ---- Filtres / stats ----
const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return suppliers.value.filter((s) => {
    if (filterMode.value === 'auto' && s.manual) return false
    if (filterMode.value === 'manual' && !s.manual) return false
    if (!q) return true
    const hay = [
      s.name,
      s.category,
      s.country,
      (s.platforms || []).join(' '),
      s.wechat,
      s.email,
      s.whatsapp,
      s.phone,
      s.website,
      s.note,
    ].join(' ').toLowerCase()
    return hay.includes(q)
  })
})

const stats = computed(() => {
  const total = suppliers.value.length
  const auto = suppliers.value.filter((s) => !s.manual).length
  const manual = total - auto
  const products = suppliers.value.reduce((sum, s) => sum + Number(s.productCount || 0), 0)
  return { total, auto, manual, products }
})

function toggle(id: string) {
  expanded.value[id] = !expanded.value[id]
  // Maintenir le catalogue admin chargé pour lister les produits par fournisseur.
  if (expanded.value[id] && !store.products.length) store.loadProducts()
}

/** Produits du fournisseur (jointure par productIds sur le store admin). */
function supplierProducts(s: any) {
  const ids = new Set((s.productIds || []).map(String))
  return store.products.filter((p) => ids.has(String(p.id)))
}

const platformLabel = (p: string) => {
  switch (p) {
    case 'xianyu': return 'Xianyu'
    case '1688': return '1688'
    case 'taobao': return 'Taobao'
    case 'tiktok-shop': return 'TikTok Shop'
    case 'amazon': return 'Amazon'
    case 'douyin-ec': return 'Douyin'
    default: return p
  }
}

const timeAgo = (iso: string) => {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'à l\'instant'
  if (mins < 60) return `il y a ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `il y a ${hours} h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `il y a ${days} j`
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

// ---- Modal create / edit ----
function openCreate() {
  editing.value = null
  form.value = { name: '', category: '', country: '', platforms: '', wechat: '', email: '', whatsapp: '', phone: '', website: '', note: '' }
  showModal.value = true
}

function openEdit(s: any) {
  editing.value = s
  form.value = {
    name: s.name || '',
    category: s.category || '',
    country: s.country || '',
    platforms: Array.isArray(s.platforms) ? s.platforms.join(', ') : '',
    wechat: s.wechat || '',
    email: s.email || '',
    whatsapp: s.whatsapp || '',
    phone: s.phone || '',
    website: s.website || '',
    note: s.note || '',
  }
  showModal.value = true
}

async function saveSupplier() {
  const name = form.value.name.trim()
  if (!name) {
    error.value = 'Le nom du fournisseur est requis.'
    return
  }
  saving.value = true
  error.value = ''
  try {
    const payload: any = { ...form.value, name }
    payload.platforms = String(form.value.platforms || '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
    const route = editing.value
      ? `/api/admin/suppliers/${encodeURIComponent(editing.value.id)}`
      : '/api/admin/suppliers'
    const res = await fetch(route, {
      method: editing.value ? 'PUT' : 'POST',
      headers: store.headers(),
      body: JSON.stringify(payload),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json?.statusMessage || json?.message || `Erreur ${res.status}`)
    showModal.value = false
    await load()
  } catch (e: any) {
    error.value = e?.message || 'Impossible de sauvegarder le fournisseur.'
  } finally {
    saving.value = false
  }
}

async function removeSupplier(s: any) {
  if (!confirm(`Supprimer définitivement le fournisseur « ${s.name} » ?\n\nLes produits associés ne sont pas supprimés.`)) return
  try {
    const res = await fetch(`/api/admin/suppliers/${encodeURIComponent(s.id)}`, { method: 'DELETE', headers: store.headers() })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json?.statusMessage || json?.message || `Erreur ${res.status}`)
    await load()
  } catch (e: any) {
    error.value = e?.message || 'Impossible de supprimer ce fournisseur.'
  }
}

/** Raccourcis contact copiables (mailto / wa.me / site). */
function mailto(s: any) {
  return s?.email ? `mailto:${s.email}` : '#'
}
function waMe(s: any) {
  const num = String(s?.whatsapp || s?.phone || '').replace(/[^0-9]/g, '')
  return num ? `https://wa.me/${num}` : ''
}
function webUrl(s: any) {
  const u = String(s?.website || '').trim()
  return u ? (u.startsWith('http') ? u : `https://${u}`) : ''
}
</script>

<template>
  <div>
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
      <div>
        <h1 class="text-lg font-extrabold text-white font-mono uppercase tracking-widest">Fournisseurs</h1>
        <p class="text-[11px] text-zinc-500 font-mono mt-1">Vendeurs capturés automatiquement à l'import + ajouts manuels du dashboard.</p>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <button @click="openCreate"
          class="shrink-0 inline-flex items-center justify-center gap-2 bg-[#ff2a2a] hover:bg-red-600 text-white text-xs font-mono font-bold px-4 py-2 rounded-xl transition-all">
          ＋ AJOUTER UN FOURNISSEUR
        </button>
        <button @click="refresh" :disabled="loading"
          class="shrink-0 inline-flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-white text-xs font-mono font-bold px-4 py-2 rounded-xl transition-all">
          <span v-if="loading" class="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          <template v-else>⟳ ACTUALISER</template>
        </button>
      </div>
    </div>

    <p v-if="error" class="mb-4 bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-400 font-mono">{{ error }}</p>

    <!-- KPI -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      <div class="bg-[#0d0d14] rounded-2xl p-4 border border-zinc-800">
        <p class="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Fournisseurs</p>
        <p class="text-2xl font-black font-mono text-white">{{ stats.total }}</p>
      </div>
      <div class="bg-[#0d0d14] rounded-2xl p-4 border border-zinc-800">
        <p class="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Auto (import)</p>
        <p class="text-2xl font-black font-mono text-[#ff2a2a]">{{ stats.auto }}</p>
      </div>
      <div class="bg-[#0d0d14] rounded-2xl p-4 border border-zinc-800">
        <p class="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Manuels</p>
        <p class="text-2xl font-black font-mono text-emerald-400">{{ stats.manual }}</p>
      </div>
      <div class="bg-[#0d0d14] rounded-2xl p-4 border border-zinc-800">
        <p class="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Produits liés</p>
        <p class="text-2xl font-black font-mono text-white">{{ stats.products }}</p>
      </div>
    </div>

    <!-- Search + filter -->
    <div class="flex flex-col sm:flex-row gap-2 mb-4">
      <input v-model="search" placeholder="Rechercher par nom, pays, plateforme, contact, note…"
        class="flex-1 bg-black border border-zinc-800 rounded-xl px-3 py-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-[#ff2a2a]/50 placeholder-zinc-600" />
      <div class="flex items-center gap-1.5 bg-[#0d0d14] border border-zinc-800 rounded-xl p-1 shrink-0">
        <button v-for="m in ([
          { k: 'all', label: 'Tous' },
          { k: 'auto', label: 'Auto' },
          { k: 'manual', label: 'Manuel' },
        ] as const)" :key="m.k" @click="filterMode = m.k; load()"
          class="px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold transition-all"
          :class="filterMode === m.k ? 'bg-[#ff2a2a] text-white' : 'text-zinc-400 hover:text-white'">
          {{ m.label }}
        </button>
      </div>
    </div>

    <!-- List -->
    <div v-if="loading" class="space-y-3">
      <div v-for="n in 4" :key="n" class="skeleton h-24 rounded-xl" />
    </div>

    <div v-else-if="filtered.length === 0" class="text-center py-14 text-zinc-600 font-mono text-[11px]">
      {{ suppliers.length === 0 ? 'AUCUN FOURNISSEUR — IMPORTEZ OU AJOUTEZ-EN UN MANUELLEMENT.' : 'AUCUN RÉSULTAT POUR CETTE RECHERCHE.' }}
    </div>

    <div v-else class="space-y-3">
      <div v-for="s in filtered" :key="s.id" class="bg-[#12121a] border border-zinc-800 rounded-2xl overflow-hidden">
        <!-- Header row -->
        <div class="flex items-center gap-3 p-4 flex-wrap">
          <div class="w-10 h-10 rounded-full bg-[#ff2a2a]/15 border border-[#ff2a2a]/40 flex items-center justify-center text-[#ff2a2a] font-black shrink-0">
            {{ String(s.name || '?').slice(0, 2).toUpperCase() }}
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <p class="text-xs font-bold text-slate-100 truncate">{{ s.name }}</p>
              <span v-if="s.manual" class="px-1.5 py-0.5 rounded-md text-[8px] font-mono font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">MANUEL</span>
              <span v-else class="px-1.5 py-0.5 rounded-md text-[8px] font-mono font-bold bg-[#ff2a2a]/15 border border-[#ff2a2a]/30 text-[#ff2a2a]">AUTO</span>
            </div>
            <p class="text-[10px] font-mono text-zinc-500 truncate">
              <template v-if="s.category">{{ s.category }} · </template>
              <template v-if="s.country">{{ s.country }} · </template>
              <template v-if="s.platforms?.length">{{ s.platforms.map(platformLabel).join(', ') }} · </template>
              {{ s.productCount }} produit(s) · maj {{ timeAgo(s.updatedAt) }}
            </p>
          </div>
          <div class="text-right shrink-0">
            <p class="text-sm font-black font-mono text-[#ff2a2a]">{{ s.productCount }}</p>
            <p class="text-[9px] font-mono text-zinc-600">produits</p>
          </div>
        </div>

        <!-- Contacts chips -->
        <div class="px-4 pb-2 flex items-center gap-1.5 flex-wrap -mt-1.5">
          <a v-if="s.wechat" href="#" @click.prevent class="px-2 py-1 rounded-lg text-[9px] font-mono border border-emerald-500/30 bg-emerald-500/5 text-emerald-400">WeChat : {{ s.wechat }}</a>
          <a v-if="s.email" :href="mailto(s)" class="px-2 py-1 rounded-lg text-[9px] font-mono border border-zinc-700 text-zinc-300 hover:text-white hover:border-[#ff2a2a]/50">✉ {{ s.email }}</a>
          <a v-if="waMe(s)" :href="waMe(s)" target="_blank" rel="noopener" class="px-2 py-1 rounded-lg text-[9px] font-mono border border-green-500/30 text-green-400">WhatsApp : {{ s.whatsapp || s.phone }}</a>
          <a v-if="s.phone && !s.whatsapp" href="#" @click.prevent class="px-2 py-1 rounded-lg text-[9px] font-mono border border-zinc-700 text-zinc-300">{{ s.phone }}</a>
          <a v-if="webUrl(s)" :href="webUrl(s)" target="_blank" rel="noopener" class="px-2 py-1 rounded-lg text-[9px] font-mono border border-zinc-700 text-zinc-300 hover:text-white hover:border-[#ff2a2a]/50">🌐 {{ s.website }}</a>
        </div>

        <!-- Actions -->
        <div class="flex items-center gap-2 px-4 pb-4 pt-2 flex-wrap border-t border-zinc-900 mt-1">
          <button @click="toggle(s.id)"
            class="inline-flex items-center gap-1.5 text-[10px] font-mono text-zinc-300 hover:text-white border border-zinc-800 px-3 py-2 rounded-xl transition-all">
            <AppIcon name="chevronDown" :size="12" :class="expanded[s.id] ? 'rotate-180' : ''" /> {{ expanded[s.id] ? 'MASQUER LES PRODUITS' : 'PRODUITS (' + (s.productCount || 0) + ')' }}
          </button>
          <button @click="openEdit(s)"
            class="inline-flex items-center gap-1.5 text-[10px] font-mono text-zinc-300 hover:text-white border border-zinc-800 px-3 py-2 rounded-xl transition-all">
            <AppIcon name="edit" :size="12" /> ÉDITER
          </button>
          <button @click="removeSupplier(s)"
            class="inline-flex items-center gap-1.5 text-[10px] font-mono text-red-400 hover:text-white border border-red-500/40 hover:border-red-500 px-3 py-2 rounded-xl transition-all">
            <AppIcon name="trash2" :size="12" /> SUPPRIMER
          </button>
        </div>

        <!-- Products list (accordion) -->
        <div v-if="expanded[s.id]" class="px-4 pb-4 border-t border-zinc-900 pt-3 space-y-1.5">
          <div v-if="!supplierProducts(s).length" class="text-[10px] font-mono text-zinc-600 py-2">
            Aucun produit associé pour le moment.
          </div>
          <div v-for="p in supplierProducts(s)" :key="p.id" class="bg-black/30 border border-zinc-900 rounded-lg overflow-hidden">
            <div class="flex items-center gap-3 p-2">
              <NuxtLink :to="`/p/${p.id}.html`" target="_blank">
                <img v-if="p.imageUrl" :src="p.imageUrl" alt="" class="w-10 h-10 rounded-md object-cover border border-zinc-800 shrink-0" />
                <div v-else class="w-10 h-10 rounded-md bg-[#16161d] border border-zinc-800 flex items-center justify-center text-[#ff2a2a] shrink-0"><AppIcon name="box" :size="14" /></div>
              </NuxtLink>
              <div class="flex-1 min-w-0">
                <NuxtLink :to="`/p/${p.id}.html`" target="_blank" class="text-[11px] font-bold text-slate-200 truncate hover:text-[#ff2a2a] block">{{ p.title }}</NuxtLink>
                <p class="text-[9px] font-mono text-zinc-500 truncate">{{ p.category || '—' }} · {{ p.priceXof ? Number(p.priceXof).toLocaleString('fr-FR') + ' F CFA' : '' }}</p>
              </div>
              <NuxtLink :to="`/p/${p.id}.html`" target="_blank" class="text-[9px] font-mono text-[#ff2a2a] hover:underline shrink-0">VOIR →</NuxtLink>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Create / Edit modal -->
    <div v-if="showModal" class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-6">
      <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" @click="showModal = false" />
      <div class="relative w-full max-w-lg bg-[#12121a] border border-zinc-700 rounded-2xl shadow-2xl my-4 sm:my-8">
        <div class="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <p class="text-xs font-extrabold text-white font-mono uppercase tracking-widest">{{ editing ? 'Éditer le fournisseur' : 'Nouveau fournisseur' }}</p>
          <button @click="showModal = false" aria-label="Fermer" class="w-8 h-8 rounded-lg border border-zinc-800 flex items-center justify-center text-zinc-300 hover:text-white"><AppIcon name="close" :size="13" /></button>
        </div>
        <div class="p-4 space-y-3">
          <div>
            <label class="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Nom *</label>
            <input v-model="form.name" placeholder="Ex. Xiao Nan Tech"
              class="mt-1 w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-[#ff2a2a]/50 placeholder-zinc-600" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Catégorie</label>
              <input v-model="form.category" placeholder="Ex. Électronique"
                class="mt-1 w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-[#ff2a2a]/50 placeholder-zinc-600" />
            </div>
            <div>
              <label class="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Pays</label>
              <input v-model="form.country" placeholder="Ex. Chine"
                class="mt-1 w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-[#ff2a2a]/50 placeholder-zinc-600" />
            </div>
          </div>
          <div>
            <label class="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Plateformes (séparées par virgule)</label>
            <input v-model="form.platforms" placeholder="xianyu, 1688, taobao"
              class="mt-1 w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-[#ff2a2a]/50 placeholder-zinc-600" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">WeChat</label>
              <input v-model="form.wechat" placeholder="WeChat ID"
                class="mt-1 w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-[#ff2a2a]/50 placeholder-zinc-600" />
            </div>
            <div>
              <label class="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Email</label>
              <input v-model="form.email" type="email" placeholder="contact@ex.com"
                class="mt-1 w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-[#ff2a2a]/50 placeholder-zinc-600" />
            </div>
            <div>
              <label class="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">WhatsApp</label>
              <input v-model="form.whatsapp" placeholder="+86 …"
                class="mt-1 w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-[#ff2a2a]/50 placeholder-zinc-600" />
            </div>
            <div>
              <label class="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Téléphone</label>
              <input v-model="form.phone" placeholder="+86 …"
                class="mt-1 w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-[#ff2a2a]/50 placeholder-zinc-600" />
            </div>
          </div>
          <div>
            <label class="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Site web</label>
            <input v-model="form.website" placeholder="https://…"
              class="mt-1 w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-[#ff2a2a]/50 placeholder-zinc-600" />
          </div>
          <div>
            <label class="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Note</label>
            <textarea v-model="form.note" rows="2" placeholder="Conditions, délais, remarques…"
              class="mt-1 w-full bg-black border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-[#ff2a2a]/50 placeholder-zinc-600 resize-y" />
          </div>
          <div class="flex items-center justify-end gap-2 pt-1">
            <button @click="showModal = false" class="text-[10px] font-mono text-zinc-400 hover:text-white border border-zinc-800 px-3 py-2 rounded-xl transition-all">ANNULER</button>
            <button @click="saveSupplier" :disabled="saving"
              class="inline-flex items-center gap-2 bg-[#ff2a2a] hover:bg-red-600 disabled:opacity-40 text-white text-xs font-mono font-bold px-4 py-2 rounded-xl transition-all">
              <span v-if="saving" class="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              <template v-else>{{ editing ? 'ENREGISTRER' : 'CRÉER' }}</template>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>