<script setup lang="ts">
definePageMeta({ layout: 'admin' })

const store = useAdminStore()
const config = useRuntimeConfig()
const checked = ref(false)
const hasGemini = ref(false)
const hasGoogle = ref(false)

// ---- Google Analytics (GA4) ----
const ga4Id = ref('')
const ga4Saved = ref(false)
const ga4Saving = ref(false)
const ga4Loading = ref(true)

async function loadGa4() {
  ga4Loading.value = true
  try {
    const res = await fetch('/api/settings', { headers: { Accept: 'application/json' } })
    const json = await res.json().catch(() => ({}))
    ga4Id.value = String(json?.settings?.ga4Id || '')
  } catch {
    /* ignore */
  } finally {
    ga4Loading.value = false
  }
}

async function saveGa4() {
  ga4Saving.value = true
  ga4Saved.value = false
  try {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: store.headers(),
      body: JSON.stringify({ ga4Id: ga4Id.value.trim() }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json?.statusMessage || json?.message || `Erreur ${res.status}`)
    ga4Saved.value = true
    setTimeout(() => (ga4Saved.value = false), 2500)
  } catch {
    ga4Saved.value = false
  } finally {
    ga4Saving.value = false
  }
}

const envBadge = (ok: boolean) =>
  ok ? 'text-green-400 border-green-500/30 bg-green-500/10' : 'text-amber-400 border-amber-500/30 bg-amber-500/10'

// ---- Taux de conversion (persistés, modifiables) ----
const rates = reactive({ cnyToXof: 95, eurToXof: 655.957, usdToXof: 700 })
const ratesLoading = ref(true)
const ratesSaving = ref(false)
const ratesSaved = ref(false)

async function loadRates() {
  ratesLoading.value = true
  try {
    const res = await fetch('/api/admin/rates', { headers: store.headers() })
    const json = await res.json().catch(() => ({}))
    if (res.ok && json?.rates) {
      rates.cnyToXof = Number(json.rates.cnyToXof) || 95
      rates.eurToXof = Number(json.rates.eurToXof) || 655.957
      rates.usdToXof = Number(json.rates.usdToXof) || 700
    }
  } catch {
    /* garde les valeurs par défaut */
  } finally {
    ratesLoading.value = false
  }
}

async function saveRates() {
  ratesSaving.value = true
  ratesSaved.value = false
  try {
    const res = await fetch('/api/admin/rates', {
      method: 'PUT',
      headers: store.headers(),
      body: JSON.stringify({ cnyToXof: rates.cnyToXof, eurToXof: rates.eurToXof, usdToXof: rates.usdToXof }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json?.statusMessage || json?.message || `Erreur ${res.status}`)
    if (json?.rates) {
      rates.cnyToXof = Number(json.rates.cnyToXof) || 95
      rates.eurToXof = Number(json.rates.eurToXof) || 655.957
      rates.usdToXof = Number(json.rates.usdToXof) || 700
    }
    ratesSaved.value = true
    setTimeout(() => (ratesSaved.value = false), 2500)
  } catch {
    ratesSaved.value = false
  } finally {
    ratesSaving.value = false
  }
}

// ---- Source d'import par plateforme (BL-007 v2 : headless / JustOneAPI) ----
type SourceEngine = 'headless' | 'justone'
const SOURCE_PLATFORM_LABELS: { key: string; label: string; hint: string }[] = [
  { key: 'xianyu', label: 'Xianyu (Goofish)', hint: 'Headless prioritaire (gratuit, MTOP intercepté) — JustOneAPI en secours.' },
  { key: '1688', label: '1688', hint: 'JustOneAPI (headless non testé sur 1688).' },
  { key: 'taobao', label: 'Taobao / Tmall', hint: 'JustOneAPI (headless non testé sur Taobao).' },
  { key: 'tiktok-shop', label: 'TikTok Shop', hint: 'JustOneAPI (headless non testé sur TikTok).' },
  { key: 'amazon', label: 'Amazon', hint: 'JustOneAPI (headless non testé sur Amazon).' },
  { key: 'douyin-ec', label: 'Douyin', hint: 'JustOneAPI (headless non testé sur Douyin).' },
]
const sources = reactive<Record<string, SourceEngine>>({
  xianyu: 'headless', '1688': 'justone', taobao: 'justone', 'tiktok-shop': 'justone', amazon: 'justone', 'douyin-ec': 'justone',
})
const sourcesLoading = ref(true)
const sourcesSaving = ref(false)
const sourcesSaved = ref(false)

async function loadSources() {
  sourcesLoading.value = true
  try {
    const res = await fetch('/api/admin/import/sources', { headers: store.headers() })
    const json = await res.json().catch(() => ({}))
    if (res.ok && json?.sources) {
      for (const p of SOURCE_PLATFORM_LABELS) {
        const v = json.sources[p.key]
        if (v === 'headless' || v === 'justone') sources[p.key] = v
      }
    }
  } catch {
    /* garde les valeurs par défaut */
  } finally {
    sourcesLoading.value = false
  }
}

async function saveSources() {
  sourcesSaving.value = true
  sourcesSaved.value = false
  try {
    const res = await fetch('/api/admin/import/sources', {
      method: 'PUT',
      headers: store.headers(),
      body: JSON.stringify({ sources: { ...sources } }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json?.statusMessage || json?.message || `Erreur ${res.status}`)
    if (json?.sources) {
      for (const p of SOURCE_PLATFORM_LABELS) {
        const v = json.sources[p.key]
        if (v === 'headless' || v === 'justone') sources[p.key] = v
      }
    }
    sourcesSaved.value = true
    setTimeout(() => (sourcesSaved.value = false), 2500)
  } catch {
    sourcesSaved.value = false
  } finally {
    sourcesSaving.value = false
  }
}


const services = computed(() => [
  { name: 'Gemini (Génération IA)', ok: hasGemini.value, desc: 'GEMINI_API_KEY — indispensable pour l\'onglet Génération IA et le copywriting.' },
  { name: 'Google OAuth (Connexion Google)', ok: hasGoogle.value, desc: 'GOOGLE_CLIENT_ID — connexion sociale (optionnelle).' },
  { name: 'Backend & Blobs', ok: true, desc: 'Netlify Blobs pour produits, commandes, comptes et social.' },
  { name: 'Preset Netlify', ok: true, desc: 'Nitro preset netlify — déploiement sur Netlify.' },
])

async function checkConfig() {
  checked.value = false
  const probe = await fetch('/api/translate-product', {
    method: 'POST',
    headers: store.headers(),
    body: JSON.stringify({ chineseDescription: 'test' }),
  }).catch(() => null)
  hasGemini.value = probe ? probe.status !== 503 : false
  hasGoogle.value = Boolean(config.public.googleClientId)
  checked.value = true
}

onMounted(() => {
  hasGoogle.value = Boolean(config.public.googleClientId)
  store.loadAdmins()
  loadGa4()
  loadRates()
  loadSources()
})

// ---- Formulaire éditable (persisté en localStorage) ----
const KEY = 'bm_admin_config_v1'
const draft = reactive({
  phoneNumber: '',
  currency: 'XOF' as 'XOF' | 'EUR' | 'USD',
  siteUrl: '',
  githubRepo: '',
  githubBranch: 'main',
  githubToken: '',
})
const saved = ref(false)

function loadDraft() {
  const basePhone = String(config.public.phoneNumber || '22900000000')
  const baseUrl = String(config.public.siteUrl || '')
  Object.assign(draft, {
    phoneNumber: basePhone,
    currency: (config.public.currency === 'EUR' || config.public.currency === 'USD' ? config.public.currency : 'XOF') as 'XOF' | 'EUR' | 'USD',
    siteUrl: baseUrl,
    githubRepo: '',
    githubBranch: 'main',
    githubToken: '',
  })
  if (!import.meta.client) return
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const p = JSON.parse(raw)
      if (p && typeof p === 'object') Object.assign(draft, p)
    }
  } catch { /* ignore */ }
  // Devise par défaut = celle persistée côté serveur (surcharge localStorage).
  fetch('/api/settings', { headers: { Accept: 'application/json' } })
    .then((r) => r.json().catch(() => ({})))
    .then((json: any) => {
      const cur = String(json?.settings?.currency || '').toUpperCase()
      if (cur === 'EUR' || cur === 'USD') {
        draft.currency = cur
        update({ currency: cur })
      }
    })
    .catch(() => { /* garde la valeur locale */ })
}

function update(patch: Partial<typeof draft>) {
  Object.assign(draft, patch)
  saved.value = false
}

function submit() {
  try {
    if (import.meta.client) localStorage.setItem(KEY, JSON.stringify(draft))
    if (import.meta.client) localStorage.setItem('bm_admin_wa', draft.phoneNumber)
    // Persister la devise côté serveur -> appliquée à tout le store.
    fetch('/api/settings', {
      method: 'PUT',
      headers: store.headers(),
      body: JSON.stringify({ currency: draft.currency }),
    }).catch(() => { /* le reste est sauvegardé localement */ })
    saved.value = true
    setTimeout(() => { saved.value = false }, 2500)
  } catch { /* ignore */ }
}

if (import.meta.client) loadDraft()
else {
  const basePhone = String(config.public.phoneNumber || '22900000000')
  const baseUrl = String(config.public.siteUrl || '')
  Object.assign(draft, {
    phoneNumber: basePhone,
    currency: (config.public.currency === 'EUR' || config.public.currency === 'USD' ? config.public.currency : 'XOF') as 'XOF' | 'EUR' | 'USD',
    siteUrl: baseUrl,
  })
}
</script>

<template>
  <div>
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
      <div>
        <h1 class="text-lg font-extrabold text-white font-mono uppercase tracking-widest">Réglages</h1>
        <p class="text-[11px] text-zinc-500 font-mono mt-1">Configuration du site, services et administrateurs.</p>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Params boutique -->
      <form @submit.prevent="submit" class="bg-[#0d0d14] rounded-3xl p-5 border border-zinc-800 space-y-5">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-base font-extrabold text-white font-mono uppercase tracking-wider">🛒 PARAMÈTRES BOUTIQUE</h3>
            <p class="text-[10px] font-mono text-zinc-500">Numéro WhatsApp, devise et lien boutique</p>
          </div>
          <button type="submit" class="bg-[#ff2a2a] hover:bg-red-600 text-white text-xs font-mono font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all">
            {{ saved ? 'ENREGISTRÉ ✓' : 'ENREGISTRER' }}
          </button>
        </div>

        <div>
          <label class="flex items-center gap-1.5 text-[9px] font-mono text-zinc-500 uppercase tracking-wider mb-1.5">📞 Numéro WhatsApp (ventes)</label>
          <input :value="draft.phoneNumber" @input="update({ phoneNumber: ($event.target as HTMLInputElement).value })" placeholder="22900000000"
            class="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-[#ff2a2a]/50 placeholder-zinc-600" />
        </div>

        <div>
          <label class="flex items-center gap-1.5 text-[9px] font-mono text-zinc-500 uppercase tracking-wider mb-1.5">🌍 Devise par défaut</label>
          <select :value="draft.currency" @change="update({ currency: ($event.target as HTMLSelectElement).value as 'XOF' | 'EUR' | 'USD' })"
            class="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-[#ff2a2a]/50 cursor-pointer">
            <option value="XOF" class="bg-[#0d0d14]">XOF (Franc CFA) — défaut</option>
            <option value="EUR" class="bg-[#0d0d14]">EUR (Euro)</option>
            <option value="USD" class="bg-[#0d0d14]">USD (Dollar)</option>
          </select>
        </div>

        <div>
          <label class="flex items-center gap-1.5 text-[9px] font-mono text-zinc-500 uppercase tracking-wider mb-1.5">🔗 URL du site (fiches produits partagées)</label>
          <input :value="draft.siteUrl" @input="update({ siteUrl: ($event.target as HTMLInputElement).value })" placeholder="https://deeproots-importexport.netlify.app/"
            class="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-[#ff2a2a]/50 placeholder-zinc-600" />
        </div>
      </form>

      <!-- Taux de conversion -->
      <div class="bg-[#0d0d14] rounded-3xl p-5 border border-zinc-800 space-y-5">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-base font-extrabold text-white font-mono uppercase tracking-wider">💱 TAUX DE CONVERSION</h3>
            <p class="text-[10px] font-mono text-zinc-500">1 yuan / 1 euro / 1 dollar → FCFA</p>
          </div>
          <button @click="saveRates" :disabled="ratesSaving || ratesLoading"
            class="bg-[#ff2a2a] hover:bg-red-600 disabled:opacity-40 text-white text-xs font-mono font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all shrink-0">
            {{ ratesSaved ? 'ENREGISTRÉ ✓' : 'ENREGISTRER' }}
          </button>
        </div>

        <div v-if="ratesLoading" class="text-[10px] font-mono text-zinc-500">Chargement…</div>
        <template v-else>
          <div>
            <label class="flex items-center gap-1.5 text-[9px] font-mono text-zinc-500 uppercase tracking-wider mb-1.5">🇨🇳 1 ¥ yuan → FCFA</label>
            <input v-model.number="rates.cnyToXof" type="number" min="1" step="0.001" placeholder="95"
              class="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-[#ff2a2a]/50 placeholder-zinc-600" />
            <p class="text-[9px] font-mono text-zinc-600 mt-1">Conversion des prix des plateformes chinoises (Xianyu, 1688, Taobao, Douyin, TikTok Shop) et des coûts d'achat en comptabilité.</p>
          </div>

          <div>
            <label class="flex items-center gap-1.5 text-[9px] font-mono text-zinc-500 uppercase tracking-wider mb-1.5">🇪🇺 1 € euro → FCFA</label>
            <input v-model.number="rates.eurToXof" type="number" min="1" step="0.001" placeholder="655.957"
              class="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-[#ff2a2a]/50 placeholder-zinc-600" />
            <p class="text-[9px] font-mono text-zinc-600 mt-1">Peg officiel du franc CFA (655,957 FCFA pour 1 €).</p>
          </div>

          <div>
            <label class="flex items-center gap-1.5 text-[9px] font-mono text-zinc-500 uppercase tracking-wider mb-1.5">🇺🇸 1 $ dollar US → FCFA</label>
            <input v-model.number="rates.usdToXof" type="number" min="1" step="0.001" placeholder="700"
              class="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-[#ff2a2a]/50 placeholder-zinc-600" />
            <p class="text-[9px] font-mono text-zinc-600 mt-1">Approximation modifiable — le dollar n'est pas arrimé au franc CFA.</p>
          </div>

          <div class="flex items-center gap-2.5 pt-1">
            <span class="shrink-0 w-2 h-2 rounded-full bg-emerald-400" />
            <p class="text-[10px] font-mono text-zinc-500">Appliquer aux prix : les taux sont persistés côté serveur et utilisés par l'import (Xianyu/1688/Taobao/TikTok/Amazon/Douyin) et la comptabilité.</p>
          </div>
        </template>
      </div>

      <!-- Source d'import par plateforme -->
      <div class="bg-[#0d0d14] rounded-3xl p-5 border border-zinc-800 space-y-5">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-base font-extrabold text-white font-mono uppercase tracking-wider">🛰️ SOURCE D'IMPORT</h3>
            <p class="text-[10px] font-mono text-zinc-500">Moteur de récupération du détail produit par plateforme</p>
          </div>
          <button @click="saveSources" :disabled="sourcesSaving || sourcesLoading"
            class="bg-[#ff2a2a] hover:bg-red-600 disabled:opacity-40 text-white text-xs font-mono font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all shrink-0">
            {{ sourcesSaved ? 'ENREGISTRÉ ✓' : 'ENREGISTRER' }}
          </button>
        </div>

        <div v-if="sourcesLoading" class="text-[10px] font-mono text-zinc-500">Chargement…</div>
        <template v-else>
          <div v-for="p in SOURCE_PLATFORM_LABELS" :key="p.key" class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800/60 last:border-0 pb-3 last:pb-0">
            <div class="min-w-0">
              <p class="text-[11px] font-mono font-bold text-slate-200">{{ p.label }}</p>
              <p class="text-[9px] font-mono text-zinc-600 mt-0.5">{{ p.hint }}</p>
            </div>
            <select :value="sources[p.key]" @change="sources[p.key] = ($event.target as HTMLSelectElement).value as SourceEngine"
              class="shrink-0 bg-black border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-[#ff2a2a]/50 cursor-pointer">
              <option value="headless" class="bg-[#0d0d14]">Headless (gratuit)</option>
              <option value="justone" class="bg-[#0d0d14]">JustOneAPI</option>
            </select>
          </div>

          <div class="flex items-center gap-2.5 pt-1">
            <span class="shrink-0 w-2 h-2 rounded-full" :class="sources.xianyu === 'headless' ? 'bg-emerald-400' : 'bg-amber-400'" />
            <p class="text-[10px] font-mono text-zinc-500">
              <template v-if="sources.xianyu === 'headless'">Xianyu passe par le navigateur headless gratuit (fonctionne même solde JustOneAPI à zéro) — JustOneAPI reste le secours automatique.</template>
              <template v-else>Xianyu passe par JustOneAPI (le headless reste disponible en basculant ce réglage).</template>
            </p>
          </div>
        </template>
      </div>

      <!-- Google Analytics (GA4) -->
      <div class="bg-[#0d0d14] rounded-3xl p-5 border border-zinc-800 space-y-5">
        <div>
          <h3 class="text-base font-extrabold text-white font-mono uppercase tracking-wider">📈 GOOGLE ANALYTICS (GA4)</h3>
          <p class="text-[10px] font-mono text-zinc-500">Suivi de l'audience, des vues produits et des précommandes dans GA4.</p>
        </div>

        <div>
          <label class="flex items-center gap-1.5 text-[9px] font-mono text-zinc-500 uppercase tracking-wider mb-1.5">🆔 Measurement ID (G-XXXXXXX)</label>
          <div class="flex gap-2">
            <input v-model="ga4Id" :disabled="ga4Loading" placeholder="G-XXXXXXXXXX"
              class="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-[#ff2a2a]/50 placeholder-zinc-600 disabled:opacity-40" />
            <button @click="saveGa4" :disabled="ga4Saving || ga4Loading"
              class="bg-[#ff2a2a] hover:bg-red-600 disabled:opacity-40 text-white text-xs font-mono font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all shrink-0">
              {{ ga4Saved ? '✓' : 'OK' }}
            </button>
          </div>
        </div>

        <div class="flex items-center gap-2.5">
          <span class="shrink-0 w-2 h-2 rounded-full" :class="ga4Id ? 'bg-green-400' : 'bg-zinc-600'" />
          <p class="text-[10px] font-mono text-zinc-500">
            <template v-if="ga4Id">Analytics actif — les événements (vues produits, clics précommande, likes, partages, commentaires) et les pages vues sont envoyés à GA4.</template>
            <template v-else>Désactivé. Collez votre Measurement ID Google Analytics (ex. G-1234567890) pour activer le suivi.</template>
          </p>
        </div>
      </div>

      <!-- Publication / GitHub -->
      <div class="bg-[#0d0d14] rounded-3xl p-5 border border-zinc-800 space-y-5">
        <div>
          <h3 class="text-base font-extrabold text-white font-mono uppercase tracking-wider">💾 PUBLICATION DU CATALOGUE</h3>
          <p class="text-[10px] font-mono text-zinc-500">Le catalogue, les commandes et les clics sont persistés côté serveur et servis en direct à la boutique.</p>
        </div>

        <div class="bg-black border border-zinc-800 rounded-xl p-4 space-y-3">
          <div class="flex items-start gap-2.5">
            <span class="text-[#ff2a2a] shrink-0 mt-0.5">🛒</span>
            <p class="text-[10px] font-mono text-zinc-400">Le site public charge <span class="text-[#ff2a2a] font-bold">/catalog.json</span> en direct depuis la base de données. Aucun webhook ni script externe n'est requis.</p>
          </div>
          <div class="flex items-start gap-2.5">
            <span class="text-[#ff2a2a] shrink-0 mt-0.5">🔗</span>
            <p class="text-[10px] font-mono text-zinc-400">Chaque clic « PRÉCOMMANDER » enregistre un clic produit <strong class="text-zinc-200">et</strong> une commande en attente que vous complétez depuis l'onglet Commandes.</p>
          </div>
          <div class="flex items-start gap-2.5">
            <span class="text-[#ff2a2a] shrink-0 mt-0.5">🛡️</span>
            <p class="text-[10px] font-mono text-zinc-400">Les images ajoutées sont stockées dans le Blob <span class="text-zinc-200">bm-images</span> et servies sous <span class="text-zinc-200">/api/img/…</span>.</p>
          </div>
        </div>

        <div>
          <label class="flex items-center gap-1.5 text-[9px] font-mono text-zinc-500 uppercase tracking-wider mb-1.5">🌐 Dépôt GitHub (catalogue)</label>
          <div class="grid grid-cols-2 gap-2">
            <input :value="draft.githubRepo" @input="update({ githubRepo: ($event.target as HTMLInputElement).value })" placeholder="pseudo/repo"
              class="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-[#ff2a2a]/50 placeholder-zinc-600" />
            <input :value="draft.githubBranch" @input="update({ githubBranch: ($event.target as HTMLInputElement).value })" placeholder="main"
              class="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-[#ff2a2a]/50 placeholder-zinc-600" />
          </div>
        </div>

        <div>
          <label class="flex items-center gap-1.5 text-[9px] font-mono text-zinc-500 uppercase tracking-wider mb-1.5">🛡️ Token GitHub (optionnel)</label>
          <input type="password" :value="draft.githubToken" @input="update({ githubToken: ($event.target as HTMLInputElement).value })" placeholder="ghp_..."
            class="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-[#ff2a2a]/50 placeholder-zinc-600" />
        </div>
      </div>
    </div>

    <!-- Services -->
    <section class="bg-[#12121a] border border-zinc-800 rounded-2xl p-4 mt-6">
      <div class="flex items-center justify-between mb-3">
        <p class="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Services</p>
        <button @click="checkConfig" class="text-[10px] font-mono text-zinc-300 hover:text-white border border-zinc-800 px-2.5 py-1.5 rounded-lg transition-all">⟳ Vérifier</button>
      </div>
      <div class="space-y-3">
        <div v-for="s in services" :key="s.name" class="flex items-start justify-between gap-3 py-2 border-b border-zinc-800/60 last:border-0">
          <div>
            <p class="text-xs font-bold text-slate-200">{{ s.name }}</p>
            <p class="text-[10px] text-zinc-600 font-mono mt-0.5">{{ s.desc }}</p>
          </div>
          <span class="shrink-0 text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase" :class="envBadge(s.ok)">
            {{ checked || s.ok ? (s.ok ? 'OK' : 'Manquant') : '…' }}
          </span>
        </div>
      </div>
    </section>
  </div>
</template>
