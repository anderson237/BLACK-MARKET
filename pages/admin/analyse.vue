<script setup lang="ts">
import { useAdminStore } from '~/stores/admin'
import { formatPriceXof } from '~/composables/useCatalog'

definePageMeta({ layout: 'admin' })
useSeoMeta({ title: 'Analyse KPI — BLACK MARKET' })

const store = useAdminStore()
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const savedMsg = ref('')
const data = ref<any>(null)

const fmt = (n: number) => formatPriceXof(Number(n) || 0)
const fmtEuro = (n: number) => `${(Number(n) || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €`

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await fetch('/api/accounting', { headers: store.headers() })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json?.statusMessage || json?.message || `Erreur ${res.status}`)
    data.value = json?.accounting || null
    syncSettingsForm()
  } catch (e: any) {
    error.value = e?.message || 'Erreur de chargement.'
  } finally {
    loading.value = false
  }
}

onMounted(load)

const kpi = computed(() => data.value?.kpi || {})
const daily = computed(() => data.value?.daily || [])
const monthly = computed(() => data.value?.monthly || [])
const stock = computed(() => data.value?.stock || {})
const marketing = computed(() => data.value?.marketing || {})
const categoryKpis = computed(() => data.value?.categoryKpis || [])
const topProducts = computed(() => data.value?.topProducts || [])
const categories = computed(() => data.value?.categories || [])

const periodCards = [
  { key: 'today', title: 'Aujourd\u2019hui' },
  { key: 'week', title: 'Cette semaine' },
  { key: 'month', title: 'Ce mois' },
  { key: 'year', title: 'Cette année' },
  { key: 'allTime', title: 'Total' },
]

const p = (k: string) => kpi.value[k] || {}
const pctColor = (v: number) => (Number(v) >= 0 ? 'text-emerald-400' : 'text-red-400')

// ---- catégories (barres horizontales CSS) ----
function barW(v: number, max: number) {
  return Math.max(0, Math.min(100, Math.round((Number(v) / Math.max(1, max)) * 100)))
}
const catMaxRevenue = computed(() => Math.max(1, ...categoryKpis.value.map((c: any) => c.revenueXof)))
const catMaxMargin = computed(() => Math.max(1, ...categoryKpis.value.map((c: any) => Math.abs(c.marginPct))))

// ---- hypothèses KPI ----
const settingsForm = reactive({
  adsMonthlyXof: 0,
  feesPct: 3,
  returnsPct: 5,
  shippingCostXof: 1500,
  fixedCostsMonthlyXof: 0,
  avgCustomerLifespanMonths: 12,
})

function syncSettingsForm() {
  const s = data.value?.settings || {}
  settingsForm.adsMonthlyXof = Number(s.adsMonthlyXof) || 0
  settingsForm.feesPct = Number(s.feesPct) >= 0 ? Number(s.feesPct) : 3
  settingsForm.returnsPct = Number(s.returnsPct) >= 0 ? Number(s.returnsPct) : 5
  settingsForm.shippingCostXof = Number(s.shippingCostXof) >= 0 ? Number(s.shippingCostXof) : 1500
  settingsForm.fixedCostsMonthlyXof = Number(s.fixedCostsMonthlyXof) || 0
  settingsForm.avgCustomerLifespanMonths = Math.max(1, Number(s.avgCustomerLifespanMonths) || 12)
}

async function saveSettings() {
  saving.value = true
  savedMsg.value = ''
  try {
    const res = await fetch('/api/accounting/settings', {
      method: 'PUT',
      headers: store.headers(),
      body: JSON.stringify({ ...settingsForm }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json?.statusMessage || json?.message || `Erreur ${res.status}`)
    savedMsg.value = 'Hypothèses enregistrées ✓'
    data.value = { ...data.value, settings: json.settings }
    await load()
  } catch (e: any) {
    savedMsg.value = e?.message || 'Erreur.'
  } finally {
    saving.value = false
    setTimeout(() => (savedMsg.value = ''), 3000)
  }
}

function catMarginPctStyle(marginPct: number) {
  return marginPct >= 0 ? 'bg-emerald-500/70' : 'bg-red-500/70'
}

function catMarginTextStyle(marginPct: number) {
  return marginPct >= 0 ? 'text-emerald-400' : 'text-red-400'
}

function lowMarginColor(m: number) {
  if (m < 10) return 'text-red-400'
  if (m < 20) return 'text-amber-400'
  return 'text-emerald-400'
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
      <div>
        <p class="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Analyse</p>
        <h2 class="text-lg font-extrabold text-white font-mono uppercase tracking-widest">Pilotage KPI</h2>
      </div>
      <div class="flex items-center gap-2">
        <button @click="load" class="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold border border-zinc-800 text-zinc-300 hover:text-white hover:border-[#ff2a2a]/50 px-3 py-2 rounded-xl transition-all">
          <AppIcon name="refresh" :size="13" /> Actualiser
        </button>
      </div>
    </div>

    <p v-if="error" class="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-400 font-mono">{{ error }}</p>

    <!-- KPI par période -->
    <div v-if="data" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
      <div v-for="card in periodCards" :key="card.key" class="bg-[#0d0d14] rounded-2xl p-4 border border-zinc-800 hover:border-[#ff2a2a]/40 transition-all">
        <div class="flex items-center justify-between">
          <span class="text-[9px] font-mono text-zinc-500 uppercase tracking-wider">{{ card.title }}</span>
          <span class="text-[8px] font-mono text-zinc-600">{{ p(card.key).orders || 0 }} cmd. · {{ p(card.key).customers || 0 }} cl.</span>
        </div>
        <p class="mt-2 text-base sm:text-lg font-black font-mono text-emerald-400 leading-tight">{{ fmt(p(card.key).revenueXof) }}</p>
        <p class="text-[9px] font-mono text-zinc-500 mt-1">CA · panier moyen {{ fmt(p(card.key).aov) }}</p>
        <div class="mt-2 space-y-1 border-t border-zinc-800/70 pt-2">
          <div class="flex justify-between text-[9px] font-mono">
            <span class="text-zinc-500">Bénéfice net</span>
            <span :class="pctColor(p(card.key).netProfitXof)">{{ fmt(p(card.key).netProfitXof) }}</span>
          </div>
          <div class="flex justify-between text-[9px] font-mono">
            <span class="text-zinc-500">Marge nette</span>
            <span :class="pctColor(p(card.key).netMarginPct)">{{ p(card.key).netMarginPct || 0 }}%</span>
          </div>
          <div class="flex justify-between text-[9px] font-mono">
            <span class="text-zinc-500">Contribution</span>
            <span :class="pctColor(p(card.key).contribution)">{{ fmt(p(card.key).contribution) }}</span>
          </div>
        </div>
      </div>
    </div>
    <div v-else-if="loading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
      <div v-for="n in 5" :key="n" class="skeleton h-44 rounded-2xl" />
    </div>

    <!-- Graphiques CA / bénéfices -->
    <div v-if="data" class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="bg-[#0d0d14] rounded-2xl p-5 border border-zinc-800">
        <h3 class="text-sm font-extrabold text-white font-mono uppercase tracking-wider mb-4">CA · 30 DERNIERS JOURS</h3>
        <AdminChart
          :data="daily"
          type="area"
          x-key="label"
          :series="[
            { key: 'revenueXof', label: 'CA', color: '#34d399' },
            { key: 'expensesXof', label: 'Dépenses', color: '#f87171' },
          ]"
          :value-format="fmt"
        />
      </div>
      <div class="bg-[#0d0d14] rounded-2xl p-5 border border-zinc-800">
        <h3 class="text-sm font-extrabold text-white font-mono uppercase tracking-wider mb-4">CA MENSUEL · 12 MOIS</h3>
        <AdminChart
          :data="monthly"
          type="bars"
          x-key="label"
          :series="[
            { key: 'revenueXof', label: 'CA', color: '#34d399' },
            { key: 'netProfitXof', label: 'Net', color: '#22d3ee' },
          ]"
          :value-format="fmt"
        />
      </div>
    </div>

    <!-- Rentabilité du mois -->
    <div v-if="data" class="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <div class="bg-[#0d0d14] rounded-2xl p-4 border border-zinc-800">
        <p class="text-[9px] font-mono text-zinc-500 uppercase tracking-wider">Bénéfice brut / mois</p>
        <p class="mt-2 text-lg font-black font-mono text-white">{{ fmt(p('month').grossProfitXof) }}</p>
        <p class="text-[9px] font-mono text-zinc-600 mt-1">CA − coût marchandises</p>
      </div>
      <div class="bg-[#0d0d14] rounded-2xl p-4 border border-zinc-800">
        <p class="text-[9px] font-mono text-zinc-500 uppercase tracking-wider">Bénéfice net / mois</p>
        <p class="mt-2 text-lg font-black font-mono text-emerald-400">{{ fmt(p('month').netProfitXof) }}</p>
        <p class="text-[9px] font-mono text-zinc-600 mt-1">Brut − dépenses</p>
      </div>
      <div class="bg-[#0d0d14] rounded-2xl p-4 border border-zinc-800">
        <p class="text-[9px] font-mono text-zinc-500 uppercase tracking-wider">Contribution / mois</p>
        <p class="mt-2 text-lg font-black font-mono text-violet-400">{{ fmt(p('month').contribution) }}</p>
        <p class="text-[9px] font-mono text-zinc-600 mt-1">Brut − frais plateforme</p>
      </div>
      <div class="bg-[#0d0d14] rounded-2xl p-4 border border-zinc-800">
        <p class="text-[9px] font-mono text-zinc-500 uppercase tracking-wider">Marge nette</p>
        <p class="mt-2 text-lg font-black font-mono text-cyan-400">{{ p('month').netMarginPct || 0 }}%</p>
        <p class="text-[9px] font-mono text-zinc-600 mt-1">sur le mois en cours</p>
      </div>
    </div>

    <!-- Marketing -->
    <div v-if="data" class="bg-[#0d0d14] rounded-2xl p-5 border border-zinc-800">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-sm font-extrabold text-white font-mono uppercase tracking-wider">Marketing & clients</h3>
        <span class="text-[8px] font-mono text-zinc-600">Total historique</span>
      </div>
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div class="rounded-xl border border-zinc-800/80 p-3">
          <p class="text-[8px] font-mono text-zinc-500 uppercase">Panier moyen</p>
          <p class="mt-1 text-sm font-black font-mono text-white">{{ fmt(marketing.aov) }}</p>
        </div>
        <div class="rounded-xl border border-zinc-800/80 p-3">
          <p class="text-[8px] font-mono text-zinc-500 uppercase">Cmd / client</p>
          <p class="mt-1 text-sm font-black font-mono text-white">{{ marketing.ordersPerCustomer || 0 }}</p>
        </div>
        <div class="rounded-xl border border-zinc-800/80 p-3">
          <p class="text-[8px] font-mono text-zinc-500 uppercase">Taux réachat</p>
          <p class="mt-1 text-sm font-black font-mono text-white">{{ marketing.repeatRate || 0 }}%</p>
        </div>
        <div class="rounded-xl border border-zinc-800/80 p-3">
          <p class="text-[8px] font-mono text-zinc-500 uppercase">Coût acquisition</p>
          <p class="mt-1 text-sm font-black font-mono text-red-400">{{ fmt(marketing.cac) }}</p>
        </div>
        <div class="rounded-xl border border-zinc-800/80 p-3">
          <p class="text-[8px] font-mono text-zinc-500 uppercase">Valeur vie client</p>
          <p class="mt-1 text-sm font-black font-mono text-emerald-400">{{ fmt(marketing.clv) }}</p>
        </div>
        <div class="rounded-xl border border-zinc-800/80 p-3">
          <p class="text-[8px] font-mono text-zinc-500 uppercase">LTV / CAC</p>
          <p class="mt-1 text-sm font-black font-mono" :class="marketing.cacClv >= 1 ? 'text-emerald-400' : 'text-red-400'">{{ marketing.cacClv || 0 }}</p>
          <p class="text-[8px] font-mono text-zinc-600 mt-0.5">cible ≥ 1</p>
        </div>
      </div>
      <p class="mt-3 text-[9px] font-mono text-zinc-600">
        CAC et LTV dépendent du budget pub saisi dans les hypothèses ci-dessous. Marge de contribution (total) : <span :class="pctColor(marketing.contributionMarginPct)">{{ marketing.contributionMarginPct || 0 }}%</span>
      </p>
    </div>

    <!-- Stock -->
    <div v-if="data" class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div class="bg-[#0d0d14] rounded-2xl p-5 border border-zinc-800 lg:col-span-2">
        <h3 class="text-sm font-extrabold text-white font-mono uppercase tracking-wider mb-4">Stock & rotation</h3>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div class="rounded-xl border border-zinc-800/80 p-3">
            <p class="text-[8px] font-mono text-zinc-500 uppercase">Valeur stock</p>
            <p class="mt-1 text-sm font-black font-mono text-white">{{ fmt(stock.valueXof) }}</p>
          </div>
          <div class="rounded-xl border border-zinc-800/80 p-3">
            <p class="text-[8px] font-mono text-zinc-500 uppercase">Unités</p>
            <p class="mt-1 text-sm font-black font-mono text-white">{{ stock.units || 0 }}</p>
          </div>
          <div class="rounded-xl border border-zinc-800/80 p-3">
            <p class="text-[8px] font-mono text-zinc-500 uppercase">Rotation / an</p>
            <p class="mt-1 text-sm font-black font-mono text-cyan-400">{{ stock.rotation || 0 }}</p>
          </div>
          <div class="rounded-xl border border-zinc-800/80 p-3">
            <p class="text-[8px] font-mono text-zinc-500 uppercase">Jours en stock</p>
            <p class="mt-1 text-sm font-black font-mono" :class="stock.dio > 90 ? 'text-amber-400' : 'text-white'">{{ stock.dio || 0 }} j</p>
          </div>
          <div class="rounded-xl border border-zinc-800/80 p-3">
            <p class="text-[8px] font-mono text-zinc-500 uppercase">Dormant (6 mois)</p>
            <p class="mt-1 text-sm font-black font-mono text-red-400">{{ fmt(stock.dormantValueXof) }}</p>
          </div>
          <div class="rounded-xl border border-zinc-800/80 p-3">
            <p class="text-[8px] font-mono text-zinc-500 uppercase">Marge potentielle</p>
            <p class="mt-1 text-sm font-black font-mono text-emerald-400">{{ fmt(stock.potentialMargin) }}</p>
          </div>
        </div>
        <div v-if="stock.lowMargin?.length" class="mt-4">
          <p class="text-[10px] font-mono text-amber-400 uppercase tracking-wider mb-2">Produits à marge faible (&lt; 30%)</p>
          <div class="space-y-1.5">
            <div v-for="x in stock.lowMargin" :key="x.id" class="flex items-center justify-between gap-3 text-[10px] font-mono">
              <span class="text-zinc-300 truncate">{{ x.title }}</span>
              <div class="flex items-center gap-3 shrink-0">
                <span class="text-zinc-600">{{ fmt(x.priceXof) }}</span>
                <span :class="lowMarginColor(x.marginPct)" class="w-10 text-right">{{ x.marginPct }}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="bg-[#0d0d14] rounded-2xl p-5 border border-zinc-800">
        <h3 class="text-sm font-extrabold text-white font-mono uppercase tracking-wider mb-4">Top produits · CA</h3>
        <div class="space-y-2.5">
          <div v-for="(t, i) in topProducts" :key="t.id" class="flex items-center gap-3">
            <img v-if="t.imageUrl" :src="t.imageUrl" :alt="t.title" class="w-8 h-8 rounded-lg object-cover border border-zinc-800" />
            <div v-else class="w-8 h-8 rounded-lg bg-zinc-800/70 flex items-center justify-center text-zinc-600 text-[9px] font-mono">{{ i + 1 }}</div>
            <div class="min-w-0 flex-1">
              <p class="text-[10px] font-mono text-zinc-300 truncate">{{ t.title }}</p>
              <p class="text-[8px] font-mono text-zinc-600">{{ t.orders }} cmd. · {{ t.marginPct }}% marge</p>
            </div>
            <span class="text-[10px] font-mono font-bold text-emerald-400 shrink-0">{{ fmt(t.revenueXof) }}</span>
          </div>
          <p v-if="!topProducts.length" class="text-[10px] font-mono text-zinc-600">Aucune vente enregistrée.</p>
        </div>
      </div>
    </div>

    <!-- Rentabilité par catégorie -->
    <div v-if="data" class="bg-[#0d0d14] rounded-2xl p-5 border border-zinc-800">
      <h3 class="text-sm font-extrabold text-white font-mono uppercase tracking-wider mb-4">Rentabilité par catégorie</h3>
      <div class="space-y-3">
        <div v-for="c in categoryKpis" :key="c.category">
          <div class="flex items-center justify-between text-[10px] font-mono mb-1">
            <span class="text-zinc-300">{{ c.category }}</span>
            <span class="text-zinc-500">{{ c.orders }} cmd.</span>
          </div>
          <div class="flex items-center gap-3">
            <div class="flex-1 h-2 bg-zinc-800/80 rounded-full overflow-hidden">
              <div class="h-full rounded-full bg-emerald-500/70" :style="{ width: barW(c.revenueXof, catMaxRevenue) + '%' }" />
            </div>
            <span class="text-[10px] font-mono font-bold text-white w-24 text-right shrink-0">{{ fmt(c.revenueXof) }}</span>
          </div>
          <div class="mt-1 flex items-center gap-3">
            <div class="flex-1 h-1.5 bg-zinc-800/80 rounded-full overflow-hidden">
              <div class="h-full rounded-full" :class="catMarginPctStyle(c.marginPct)" :style="{ width: barW(Math.abs(c.marginPct), catMaxMargin) + '%' }" />
            </div>
            <span class="text-[9px] font-mono font-bold w-24 text-right shrink-0" :class="catMarginTextStyle(c.marginPct)">{{ c.marginPct }}% marge brute</span>
          </div>
        </div>
        <p v-if="!categoryKpis.length" class="text-[10px] font-mono text-zinc-600">Aucune donnée.</p>
      </div>
    </div>

    <!-- Hypothèses KPI -->
    <div v-if="data" class="bg-[#0d0d14] rounded-2xl p-5 border border-zinc-800">
      <div class="flex items-center justify-between mb-1">
        <h3 class="text-sm font-extrabold text-white font-mono uppercase tracking-wider">Hypothèses KPI</h3>
        <button @click="saveSettings" :disabled="saving" class="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold bg-[#ff2a2a]/15 border border-[#ff2a2a]/40 text-[#ff2a2a] hover:bg-[#ff2a2a]/25 px-3 py-2 rounded-xl transition-all disabled:opacity-50">
          {{ saving ? 'Enregistrement…' : 'Enregistrer' }}
        </button>
      </div>
      <p class="text-[9px] font-mono text-zinc-600 mb-4">Utilisées pour CAC, LTV, contribution (retours, frais plateforme, livraison).</p>
      <p v-if="savedMsg" class="mb-3 text-[10px] font-mono" :class="savedMsg.includes('✓') ? 'text-emerald-400' : 'text-red-400'">{{ savedMsg }}</p>
      <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
        <label class="block">
          <span class="text-[9px] font-mono text-zinc-500 uppercase">Budget pub mensuel (FCFA)</span>
          <input v-model.number="settingsForm.adsMonthlyXof" type="number" min="0" step="5000" class="mt-1 w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-[#ff2a2a]/60" />
        </label>
        <label class="block">
          <span class="text-[9px] font-mono text-zinc-500 uppercase">Frais plateforme (%)</span>
          <input v-model.number="settingsForm.feesPct" type="number" min="0" max="100" step="0.5" class="mt-1 w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-[#ff2a2a]/60" />
        </label>
        <label class="block">
          <span class="text-[9px] font-mono text-zinc-500 uppercase">Retours (% CA, 20% coût)</span>
          <input v-model.number="settingsForm.returnsPct" type="number" min="0" max="100" step="0.5" class="mt-1 w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-[#ff2a2a]/60" />
        </label>
        <label class="block">
          <span class="text-[9px] font-mono text-zinc-500 uppercase">Livraison par commande (FCFA)</span>
          <input v-model.number="settingsForm.shippingCostXof" type="number" min="0" step="100" class="mt-1 w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-[#ff2a2a]/60" />
        </label>
        <label class="block">
          <span class="text-[9px] font-mono text-zinc-500 uppercase">Charges fixes mensuelles (FCFA)</span>
          <input v-model.number="settingsForm.fixedCostsMonthlyXof" type="number" min="0" step="5000" class="mt-1 w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-[#ff2a2a]/60" />
        </label>
        <label class="block">
          <span class="text-[9px] font-mono text-zinc-500 uppercase">Durée vie client (mois)</span>
          <input v-model.number="settingsForm.avgCustomerLifespanMonths" type="number" min="1" max="120" class="mt-1 w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-[#ff2a2a]/60" />
        </label>
      </div>
    </div>
  </div>
</template>
