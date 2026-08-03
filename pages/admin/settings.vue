<script setup lang="ts">
definePageMeta({ layout: 'admin' })

const store = useAdminStore()
const config = useRuntimeConfig()
const checked = ref(false)
const hasGemini = ref(false)
const hasGoogle = ref(false)

const envBadge = (ok: boolean) =>
  ok ? 'text-green-400 border-green-500/30 bg-green-500/10' : 'text-amber-400 border-amber-500/30 bg-amber-500/10'

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
})

// ---- Formulaire éditable (persisté en localStorage) ----
const KEY = 'bm_admin_config_v1'
const draft = reactive({
  phoneNumber: '',
  currency: 'XOF' as 'XOF' | 'EUR',
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
    currency: (config.public.currency === 'EUR' ? 'EUR' : 'XOF') as 'XOF' | 'EUR',
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
}

function update(patch: Partial<typeof draft>) {
  Object.assign(draft, patch)
  saved.value = false
}

function submit() {
  try {
    if (import.meta.client) localStorage.setItem(KEY, JSON.stringify(draft))
    if (import.meta.client) localStorage.setItem('bm_admin_wa', draft.phoneNumber)
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
    currency: (config.public.currency === 'EUR' ? 'EUR' : 'XOF') as 'XOF' | 'EUR',
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
          <select :value="draft.currency" @change="update({ currency: ($event.target as HTMLSelectElement).value as 'XOF' | 'EUR' })"
            class="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-[#ff2a2a]/50 cursor-pointer">
            <option value="XOF" class="bg-[#0d0d14]">XOF (Franc CFA)</option>
            <option value="EUR" class="bg-[#0d0d14]">EUR (Euro)</option>
          </select>
        </div>

        <div>
          <label class="flex items-center gap-1.5 text-[9px] font-mono text-zinc-500 uppercase tracking-wider mb-1.5">🔗 URL du site (fiches produits partagées)</label>
          <input :value="draft.siteUrl" @input="update({ siteUrl: ($event.target as HTMLInputElement).value })" placeholder="https://blackmarket-import-export.netlify.app/"
            class="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-[#ff2a2a]/50 placeholder-zinc-600" />
        </div>
      </form>

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
