<script setup lang="ts">
import { useAdminStore } from '~/stores/admin'
import { formatPriceXof } from '~/composables/useCatalog'
import { EXPENSE_PAYMENT_METHODS, EXPENSE_PAYMENT_LABEL } from '~/data/expenseCategories'

definePageMeta({ layout: 'admin' })

useSeoMeta({ title: 'Trésorerie — BLACK MARKET' })

const store = useAdminStore()
const loading = ref(true)
const error = ref('')
const data = ref<any>(null)

const fmt = (n: number) => formatPriceXof(Number(n) || 0)
const todayStr = () => new Date().toISOString().slice(0, 10)

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await fetch('/api/treasury', { headers: store.headers() })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json?.statusMessage || json?.message || `Erreur ${res.status}`)
    data.value = json?.treasury || null
  } catch (e: any) {
    error.value = e?.message || 'Erreur de chargement.'
  } finally {
    loading.value = false
  }
}

onMounted(load)

// ---- ajouter un mouvement ----
const form = reactive({ type: 'in', label: '', amountXof: null as number | null, date: todayStr(), method: 'cash', note: '' })
const busy = ref(false)
const msg = ref('')

async function addEntry() {
  busy.value = true
  msg.value = ''
  try {
    const res = await fetch('/api/treasury/entries', {
      method: 'POST',
      headers: store.headers(),
      body: JSON.stringify(form),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json?.statusMessage || json?.message || `Erreur ${res.status}`)
    msg.value = form.type === 'in' ? 'Entrée ajoutée ✓' : 'Sortie ajoutée ✓'
    Object.assign(form, { type: 'in', label: '', amountXof: null, date: todayStr(), method: 'cash', note: '' })
    await load()
  } catch (e: any) {
    msg.value = e?.message || 'Erreur.'
  } finally {
    busy.value = false
  }
}

// ---- supprimer un mouvement manuel ----
async function removeEntry(id: string) {
  if (!confirm('Supprimer ce mouvement ?')) return
  try {
    const res = await fetch(`/api/treasury/entries/${id}`, { method: 'DELETE', headers: store.headers() })
    if (!res.ok) throw new Error('Suppression impossible.')
    await load()
  } catch (e: any) {
    error.value = e?.message || 'Erreur.'
  }
}

// ---- solde initial ----
const showInit = ref(false)
const initInput = ref(0)
function openInit() {
  initInput.value = data.value?.soldeInitialXof || 0
  showInit.value = true
}
async function saveInit() {
  try {
    const res = await fetch('/api/treasury/settings', {
      method: 'PUT',
      headers: store.headers(),
      body: JSON.stringify({ initialBalanceXof: Number(initInput.value) || 0 }),
    })
    if (!res.ok) throw new Error('Enregistrement impossible.')
    showInit.value = false
    await load()
  } catch (e: any) {
    error.value = e?.message || 'Erreur.'
  }
}

// ---- filters ----
const typeFilter = ref('all')
const movements = computed(() => data.value?.movements || [])
const filtered = computed(() => {
  const list = movements.value
  if (typeFilter.value === 'in') return list.filter((m: any) => m.type === 'in')
  if (typeFilter.value === 'out') return list.filter((m: any) => m.type === 'out')
  return list
})

// ---- evolution chart (CSS bars, positive up / negative down) ----
const daily = computed(() => data.value?.daily || [])
const maxAbs = computed(() => Math.max(1, ...daily.value.map((d: any) => Math.abs(d.balanceXof))))
const bar = (v: number) => Math.round((Math.abs(v) / maxAbs.value) * 50)

const sourceLabel: Record<string, string> = {
  orders: 'Ventes',
  expense: 'Dépense',
  manual: 'Manuel',
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
      <div>
        <p class="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Trésorerie</p>
        <h2 class="text-lg font-extrabold text-white font-mono uppercase tracking-widest">Caisse de la boutique</h2>
      </div>
      <div class="flex items-center gap-2">
        <NuxtLink to="/admin/comptabilite" class="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold border border-zinc-800 text-zinc-300 hover:text-white hover:border-[#ff2a2a]/50 px-3 py-2 rounded-xl transition-all">
          <AppIcon name="chart" :size="13" /> Comptabilité
        </NuxtLink>
        <button @click="load" class="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold border border-zinc-800 text-zinc-300 hover:text-white hover:border-[#ff2a2a]/50 px-3 py-2 rounded-xl transition-all">
          <AppIcon name="refresh" :size="13" /> Actualiser
        </button>
      </div>
    </div>

    <p v-if="error" class="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-400 font-mono">{{ error }}</p>

    <!-- Solde + flux -->
    <div v-if="data" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <div class="bg-[#0d0d14] rounded-2xl p-5 border border-zinc-800 lg:col-span-1">
        <p class="text-[9px] font-mono text-zinc-500 uppercase tracking-wider">Solde de trésorerie</p>
        <p class="mt-2 text-xl sm:text-2xl font-black font-mono leading-tight" :class="data.soldeCourantXof >= 0 ? 'text-emerald-400' : 'text-red-400'">
          {{ fmt(data.soldeCourantXof) }}
        </p>
        <p class="text-[9px] font-mono text-zinc-600 mt-1">dont solde initial {{ fmt(data.soldeInitialXof) }}</p>
        <button @click="openInit" class="mt-3 inline-flex items-center gap-1.5 text-[10px] font-mono font-bold border border-zinc-800 text-zinc-300 hover:text-white hover:border-[#ff2a2a]/50 px-3 py-2 rounded-lg transition-all">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg>
          Solde initial
        </button>
      </div>

      <div class="bg-[#0d0d14] rounded-2xl p-4 border border-zinc-800">
        <p class="text-[9px] font-mono text-zinc-500 uppercase tracking-wider">Entrées (encaissements)</p>
        <p class="mt-2 text-lg font-black font-mono text-emerald-400">{{ fmt(data.totalInXof) }}</p>
        <div class="mt-2 space-y-1 border-t border-zinc-800/70 pt-2 text-[9px] font-mono">
          <div class="flex justify-between"><span class="text-zinc-500">Ventes (commandes)</span><span class="text-emerald-400/90">{{ fmt(data.salesXof) }}</span></div>
          <div class="flex justify-between"><span class="text-zinc-500">Apports / recettes manuels</span><span class="text-emerald-400/90">{{ fmt(data.manualInXof) }}</span></div>
        </div>
      </div>

      <div class="bg-[#0d0d14] rounded-2xl p-4 border border-zinc-800">
        <p class="text-[9px] font-mono text-zinc-500 uppercase tracking-wider">Sorties (décaissements)</p>
        <p class="mt-2 text-lg font-black font-mono text-red-400">{{ fmt(data.totalOutXof) }}</p>
        <div class="mt-2 space-y-1 border-t border-zinc-800/70 pt-2 text-[9px] font-mono">
          <div class="flex justify-between"><span class="text-zinc-500">Dépenses (achat marchandise…)</span><span class="text-red-400/90">{{ fmt(data.expensesXof) }}</span></div>
          <div class="flex justify-between"><span class="text-zinc-500">Retraits manuels</span><span class="text-red-400/90">{{ fmt(data.manualOutXof) }}</span></div>
        </div>
      </div>

      <div class="bg-[#0d0d14] rounded-2xl p-4 border border-zinc-800">
        <p class="text-[9px] font-mono text-zinc-500 uppercase tracking-wider">Résultat trésorerie</p>
        <p class="mt-2 text-lg font-black font-mono text-white">{{ fmt(data.totalInXof - data.totalOutXof) }}</p>
        <div class="mt-2 space-y-1 border-t border-zinc-800/70 pt-2 text-[9px] font-mono">
          <div class="flex justify-between"><span class="text-zinc-500">Solde initial</span><span class="text-zinc-300">{{ fmt(data.soldeInitialXof) }}</span></div>
          <div class="flex justify-between"><span class="text-zinc-500">Mouvements</span><span class="text-zinc-300">{{ movements.length }}</span></div>
        </div>
      </div>
    </div>
    <div v-else-if="loading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <div v-for="n in 4" :key="n" class="skeleton h-36 rounded-2xl" />
    </div>

    <!-- Évolution du solde -->
    <div v-if="data" class="bg-[#0d0d14] rounded-2xl p-5 border border-zinc-800">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h3 class="text-sm font-extrabold text-white font-mono uppercase tracking-wider">ÉVOLUTION DU SOLDE · 30 JOURS</h3>
          <p class="text-[10px] font-mono text-zinc-500">Solde aujourd'hui : <span :class="daily[daily.length - 1]?.balanceXof >= 0 ? 'text-emerald-400' : 'text-red-400'">{{ fmt(daily[daily.length - 1]?.balanceXof) }}</span></p>
        </div>
        <div class="flex items-center gap-3 text-[9px] font-mono text-zinc-500">
          <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-sm bg-emerald-500" /> positif</span>
          <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-sm bg-red-500" /> négatif</span>
        </div>
      </div>
      <div class="relative h-40">
        <div class="absolute left-0 right-0 top-1/2 border-t border-dashed border-zinc-700/70" />
        <div class="absolute inset-0 flex gap-[3px]">
          <div v-for="d in daily" :key="d.key" class="flex-1 relative min-w-0 h-full" :title="`${d.label} · solde ${fmt(d.balanceXof)} · entrées ${fmt(d.inXof)} · sorties ${fmt(d.outXof)}`">
            <div v-if="d.balanceXof >= 0" class="absolute left-1/2 -translate-x-1/2 w-full rounded-t bg-emerald-500/70" :style="{ bottom: '50%', height: bar(d.balanceXof) + '%' }" />
            <div v-else class="absolute left-1/2 -translate-x-1/2 w-full rounded-b bg-red-500/70" :style="{ top: '50%', height: bar(d.balanceXof) + '%' }" />
          </div>
        </div>
      </div>
      <div class="flex justify-between mt-1 text-[8px] font-mono text-zinc-600">
        <span>{{ daily[0]?.label }}</span><span>{{ daily[Math.floor((daily.length - 1) / 2)]?.label }}</span><span>{{ daily[daily.length - 1]?.label }}</span>
      </div>
    </div>

    <!-- Ajouter un mouvement + journal -->
    <div v-if="data" class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div class="bg-[#0d0d14] rounded-2xl p-5 border border-zinc-800 lg:col-span-1">
        <h3 class="text-sm font-extrabold text-white font-mono uppercase tracking-wider mb-4">Nouveau mouvement</h3>
        <div class="grid grid-cols-2 gap-2 mb-3">
          <button type="button" @click="form.type = 'in'"
            class="py-2.5 rounded-xl border text-xs font-bold font-mono transition-all"
            :class="form.type === 'in' ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-400' : 'bg-black/40 border-zinc-800 text-zinc-400 hover:border-zinc-600'">+ Entrée</button>
          <button type="button" @click="form.type = 'out'"
            class="py-2.5 rounded-xl border text-xs font-bold font-mono transition-all"
            :class="form.type === 'out' ? 'bg-red-500/15 border-red-500/50 text-red-400' : 'bg-black/40 border-zinc-800 text-zinc-400 hover:border-zinc-600'">− Sortie</button>
        </div>
        <div class="space-y-3">
          <div class="space-y-1">
            <label class="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Libellé *</label>
            <input v-model="form.label" :placeholder="form.type === 'in' ? 'Ex : apport de fonds, recette…' : 'Ex : retrait, remboursement…'" class="w-full bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:border-[#ff2a2a]/60 focus:outline-none" />
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div class="space-y-1">
              <label class="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Montant (F CFA) *</label>
              <input v-model.number="form.amountXof" type="number" min="0" step="50" placeholder="50000" class="w-full bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:border-[#ff2a2a]/60 focus:outline-none" />
            </div>
            <div class="space-y-1">
              <label class="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Date</label>
              <input v-model="form.date" type="date" class="w-full bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:border-[#ff2a2a]/60 focus:outline-none" />
            </div>
          </div>
          <div class="space-y-1">
            <label class="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Moyen</label>
            <select v-model="form.method" class="w-full bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:border-[#ff2a2a]/60 focus:outline-none">
              <option v-for="m in EXPENSE_PAYMENT_METHODS" :key="m.value" :value="m.value" class="bg-[#0d0d14]">{{ m.label }}</option>
            </select>
          </div>
          <div class="space-y-1">
            <label class="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Note (optionnel)</label>
            <textarea v-model="form.note" rows="2" placeholder="Détail…" class="w-full bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:border-[#ff2a2a]/60 focus:outline-none resize-none" />
          </div>
          <button @click="addEntry" :disabled="busy || !form.label || !form.amountXof"
            class="w-full inline-flex items-center justify-center gap-1.5 bg-[#ff2a2a] hover:bg-red-600 text-white text-xs font-bold px-4 py-3 rounded-xl transition-all font-mono disabled:opacity-50">
            {{ busy ? '…' : form.type === 'in' ? '+ Ajouter l\'entrée' : '− Ajouter la sortie' }}
          </button>
          <p v-if="msg" class="text-[10px] font-mono text-emerald-400">{{ msg }}</p>
          <p class="text-[9px] font-mono text-zinc-600">💡 Les dépenses et achats de marchandise enregistrés en Comptabilité sont déduits automatiquement de la trésorerie.</p>
        </div>
      </div>

      <div class="lg:col-span-2 bg-[#0d0d14] rounded-2xl p-5 border border-zinc-800">
        <div class="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h3 class="text-sm font-extrabold text-white font-mono uppercase tracking-wider">Journal de caisse</h3>
            <p class="text-[10px] font-mono text-zinc-500">{{ filtered.length }} mouvement(s)</p>
          </div>
          <div class="flex gap-1.5">
            <button v-for="t in [{ v: 'all', l: 'Tous' }, { v: 'in', l: 'Entrées' }, { v: 'out', l: 'Sorties' }]" :key="t.v" @click="typeFilter = t.v"
              class="text-[9px] font-mono font-bold px-2.5 py-1.5 rounded-lg border transition-all"
              :class="typeFilter === t.v ? 'bg-[#ff2a2a]/15 border-[#ff2a2a]/40 text-[#ff2a2a]' : 'border-zinc-800 text-zinc-400 hover:border-zinc-600'">{{ t.l }}</button>
          </div>
        </div>

        <div v-if="filtered.length === 0" class="text-center py-10 text-zinc-600 font-mono text-[11px]">AUCUN MOUVEMENT</div>
        <div v-else class="space-y-1.5 max-h-[460px] overflow-y-auto pr-1">
          <div v-for="m in filtered" :key="m.id" class="flex items-center gap-3 bg-black/30 border border-zinc-900 rounded-xl px-3 py-2 hover:border-zinc-700 transition-all">
            <span class="w-1.5 self-stretch shrink-0 rounded-full" :class="m.type === 'in' ? 'bg-emerald-500' : 'bg-red-500'" />
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <p class="text-xs text-white font-mono font-bold truncate">{{ m.label }}</p>
                <span class="shrink-0 text-[8px] font-mono px-1.5 py-0.5 rounded-full bg-zinc-800/80 text-zinc-400">{{ sourceLabel[m.source] || m.source }}</span>
              </div>
              <p class="text-[9px] font-mono text-zinc-600 mt-0.5">
                {{ new Date(m.date + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) }}
                · {{ EXPENSE_PAYMENT_LABEL(m.method) }}
                <span v-if="m.note"> · {{ m.note }}</span>
              </p>
            </div>
            <div class="text-right shrink-0">
              <p class="text-sm font-mono font-black" :class="m.type === 'in' ? 'text-emerald-400' : 'text-red-400'">
                {{ m.type === 'in' ? '+' : '−' }} {{ fmt(m.amountXof) }}
              </p>
              <p class="text-[8px] font-mono text-zinc-600">solde {{ fmt(m.balanceXof) }}</p>
            </div>
            <button v-if="m.source === 'manual'" @click="removeEntry(m.id.replace(/^man_/, ''))" title="Supprimer"
              class="w-7 h-7 shrink-0 rounded-lg border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-red-400 hover:border-red-500/50 transition-all">
              <AppIcon name="trash2" :size="12" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Solde initial modal -->
    <div v-if="showInit" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" @click="showInit = false" />
      <div class="relative w-full max-w-sm bg-[#12121a] border border-zinc-800 rounded-3xl p-5">
        <h3 class="text-sm font-extrabold text-white font-mono uppercase tracking-wider mb-4">Solde initial de caisse</h3>
        <label class="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Montant (F CFA)</label>
        <input v-model.number="initInput" type="number" min="0" step="100" class="mt-1 w-full bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:border-[#ff2a2a]/60 focus:outline-none" />
        <p class="text-[9px] font-mono text-zinc-600 mt-1">Argent en caisse au démarrage (avant les premières ventes).</p>
        <div class="flex gap-2 mt-4">
          <button @click="saveInit" class="flex-1 bg-[#ff2a2a] hover:bg-red-600 text-white text-xs font-bold px-4 py-3 rounded-xl transition-all font-mono">Enregistrer</button>
          <button @click="showInit = false" class="border border-zinc-800 text-zinc-400 hover:text-white text-xs font-bold px-4 py-3 rounded-xl transition-all font-mono">Annuler</button>
        </div>
      </div>
    </div>

    <!-- Bilan mensuel trésorerie -->
    <div v-if="data" class="bg-[#0d0d14] rounded-2xl p-5 border border-zinc-800 overflow-hidden">
      <h3 class="text-sm font-extrabold text-white font-mono uppercase tracking-wider mb-4">Trésorerie mensuelle (12 mois)</h3>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-[11px] font-mono min-w-[560px]">
          <thead>
            <tr class="text-[9px] text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
              <th class="py-2 pr-3 font-bold">Mois</th>
              <th class="py-2 pr-3 font-bold text-right">Entrées</th>
              <th class="py-2 pr-3 font-bold text-right">Sorties</th>
              <th class="py-2 font-bold text-right">Solde fin de mois</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in [...(data.monthly || [])].reverse()" :key="m.key" class="border-b border-zinc-900/70 hover:bg-black/30 transition-all">
              <td class="py-2 pr-3 text-zinc-300 capitalize">{{ m.label }}</td>
              <td class="py-2 pr-3 text-right text-emerald-400 font-bold">{{ fmt(m.inXof) }}</td>
              <td class="py-2 pr-3 text-right text-red-400">{{ fmt(m.outXof) }}</td>
              <td class="py-2 text-right font-black" :class="m.balanceXof >= 0 ? 'text-emerald-400' : 'text-red-400'">{{ fmt(m.balanceXof) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
