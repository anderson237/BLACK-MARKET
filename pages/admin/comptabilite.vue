<script setup lang="ts">
import { useAdminStore } from '~/stores/admin'
import { formatPriceXof } from '~/composables/useCatalog'
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABEL, EXPENSE_PAYMENT_METHODS, EXPENSE_PAYMENT_LABEL } from '~/data/expenseCategories'

definePageMeta({ layout: 'admin' })

useSeoMeta({ title: 'Comptabilité — BLACK MARKET' })

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
    const res = await fetch('/api/accounting', { headers: store.headers() })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json?.statusMessage || json?.message || `Erreur ${res.status}`)
    data.value = json?.accounting || null
  } catch (e: any) {
    error.value = e?.message || 'Erreur de chargement.'
  } finally {
    loading.value = false
  }
}

onMounted(load)

// ---- expenses manager ----
const form = reactive({ id: '', label: '', category: 'divers', amountXof: null as number | null, date: todayStr(), paymentMethod: 'cash', note: '' })
const busy = ref(false)
const formMsg = ref('')
const editing = computed(() => !!form.id)

function startEdit(e: any) {
  Object.assign(form, { id: e.id, label: e.label, category: e.category, amountXof: e.amountXof, date: e.date, paymentMethod: e.paymentMethod, note: e.note || '' })
  formMsg.value = ''
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

// ---- pop-up d'édition d'une dépense ----
const editModal = ref(false)
const editForm = reactive({ id: '', label: '', category: 'divers', amountXof: null as number | null, date: todayStr(), paymentMethod: 'cash', note: '' })
const editBusy = ref(false)
const editMsg = ref('')
const editError = ref('')

function openEdit(e: any) {
  Object.assign(editForm, { id: e.id, label: e.label, category: e.category, amountXof: e.amountXof, date: e.date, paymentMethod: e.paymentMethod, note: e.note || '' })
  editMsg.value = ''
  editError.value = ''
  editModal.value = true
}

function closeEdit() {
  editModal.value = false
  editForm.id = ''
}

async function saveEdit() {
  if (!editForm.label.trim() || !editForm.amountXof) return
  editBusy.value = true
  editMsg.value = ''
  editError.value = ''
  try {
    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: store.headers(),
      body: JSON.stringify({ ...editForm, id: editForm.id }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json?.statusMessage || json?.message || `Erreur ${res.status}`)
    editMsg.value = 'Dépense modifiée ✓'
    closeEdit()
    await load()
  } catch (e: any) {
    editError.value = e?.message || 'Erreur.'
  } finally {
    editBusy.value = false
  }
}

function resetForm() {
  Object.assign(form, { id: '', label: '', category: 'divers', amountXof: null, date: todayStr(), paymentMethod: 'cash', note: '' })
  formMsg.value = ''
}

async function saveExpense() {
  busy.value = true
  formMsg.value = ''
  try {
    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: store.headers(),
      body: JSON.stringify({ ...form, id: form.id || undefined }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json?.statusMessage || json?.message || `Erreur ${res.status}`)
    formMsg.value = editing.value ? 'Dépense modifiée ✓' : 'Dépense enregistrée ✓'
    resetForm()
    await load()
  } catch (e: any) {
    formMsg.value = e?.message || 'Erreur.'
  } finally {
    busy.value = false
  }
}

async function removeExpense(id: string) {
  if (!confirm('Supprimer cette dépense ?')) return
  try {
    const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE', headers: store.headers() })
    if (!res.ok) throw new Error('Suppression impossible.')
    await load()
  } catch (e: any) {
    formMsg.value = e?.message || 'Erreur.'
  }
}

// ---- filters (client-side) ----
const catFilter = ref('')
const periodFilter = ref('all')
const monthKey = (d: string) => (d || '').slice(0, 7)
const nowKey = monthKey(todayStr())

const filteredExpenses = computed(() => {
  const list = data.value?.expenses || []
  return list.filter((e: any) => {
    if (catFilter.value && e.category !== catFilter.value) return false
    if (periodFilter.value === 'month' && monthKey(e.date) !== nowKey) return false
    if (periodFilter.value === 'year' && (e.date || '').slice(0, 4) !== nowKey.slice(0, 4)) return false
    return true
  })
})

const filteredTotal = computed(() => filteredExpenses.value.reduce((s: number, e: any) => s + (Number(e.amountXof) || 0), 0))

// ---- charts (CSS bars) ----
function maxOf(list: any[], keys: string[]) {
  return Math.max(1, ...list.flatMap((x) => keys.map((k) => Number(x[k]) || 0)))
}

const daily = computed(() => data.value?.daily || [])
const dailyMax = computed(() => maxOf(daily.value, ['revenueXof', 'expensesXof']))
const dailyBarH = (v: number) => Math.round((Number(v) / dailyMax.value) * 100)
const dailyNet = (d: any) => (Number(d.revenueXof) || 0) - (Number(d.expensesXof) || 0)
const dailyTotalRevenue = computed(() => daily.value.reduce((s: number, d: any) => s + (Number(d.revenueXof) || 0), 0))
const dailyTotalExpenses = computed(() => daily.value.reduce((s: number, d: any) => s + (Number(d.expensesXof) || 0), 0))

const monthly = computed(() => data.value?.monthly || [])
const monthlyMax = computed(() => maxOf(monthly.value, ['revenueXof', 'expensesXof']))
const monthlyBarH = (v: number) => Math.round((Number(v) / monthlyMax.value) * 100)

// ---- export CSV ----
async function exportCsv() {
  try {
    const res = await fetch('/api/accounting/export', { headers: store.headers() })
    if (!res.ok) throw new Error('Export impossible.')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `comptabilite-black-market-${todayStr()}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  } catch (e: any) {
    error.value = e?.message || 'Erreur export.'
  }
}

const kpi = computed(() => data.value?.kpi || {})
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
      <div>
        <p class="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Comptabilité</p>
        <h2 class="text-lg font-extrabold text-white font-mono uppercase tracking-widest">Boutique de téléphone</h2>
      </div>
      <div class="flex items-center gap-2">
        <NuxtLink to="/admin/analyse" class="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold border border-zinc-800 text-zinc-300 hover:text-white hover:border-[#ff2a2a]/50 px-3 py-2 rounded-xl transition-all">
          <AppIcon name="chart" :size="13" /> Analyse KPI
        </NuxtLink>
        <NuxtLink to="/admin/tresorerie" class="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold border border-zinc-800 text-zinc-300 hover:text-white hover:border-[#ff2a2a]/50 px-3 py-2 rounded-xl transition-all">
          <AppIcon name="wallet" :size="13" /> Trésorerie
        </NuxtLink>
        <button @click="load" class="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold border border-zinc-800 text-zinc-300 hover:text-white hover:border-[#ff2a2a]/50 px-3 py-2 rounded-xl transition-all">
          <AppIcon name="refresh" :size="13" /> Actualiser
        </button>
        <button @click="exportCsv" class="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold bg-[#ff2a2a]/15 border border-[#ff2a2a]/40 text-[#ff2a2a] hover:bg-[#ff2a2a]/25 px-3 py-2 rounded-xl transition-all">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
          Export CSV
        </button>
      </div>
    </div>

    <p v-if="error" class="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-400 font-mono">{{ error }}</p>

    <!-- KPI cards -->
    <div v-if="data" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
      <div v-for="card in [
        { key: 'today', title: 'Aujourd\u2019hui' },
        { key: 'week', title: 'Cette semaine' },
        { key: 'month', title: 'Ce mois' },
        { key: 'year', title: 'Cette année' },
        { key: 'allTime', title: 'Total' },
      ]" :key="card.key" class="bg-[#0d0d14] rounded-2xl p-4 border border-zinc-800 hover:border-[#ff2a2a]/40 transition-all">
        <div class="flex items-center justify-between">
          <span class="text-[9px] font-mono text-zinc-500 uppercase tracking-wider">{{ card.title }}</span>
          <span class="text-[8px] font-mono text-zinc-600">{{ kpi[card.key]?.orders || 0 }} cmd.</span>
        </div>
        <p class="mt-2 text-base sm:text-lg font-black font-mono text-emerald-400 leading-tight">{{ fmt(kpi[card.key]?.revenueXof) }}</p>
        <p class="text-[9px] font-mono text-zinc-500 mt-1">CA</p>
        <div class="mt-2 space-y-1 border-t border-zinc-800/70 pt-2">
          <div class="flex justify-between text-[9px] font-mono">
            <span class="text-zinc-500">Dépenses</span>
            <span class="text-red-400">{{ fmt(kpi[card.key]?.expensesXof) }}</span>
          </div>
          <div class="flex justify-between text-[9px] font-mono">
            <span class="text-zinc-500">Bénéfice net</span>
            <span :class="(kpi[card.key]?.netProfitXof || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'">{{ fmt(kpi[card.key]?.netProfitXof) }}</span>
          </div>
          <div class="flex justify-between text-[9px] font-mono">
            <span class="text-zinc-500">Marge nette</span>
            <span :class="(kpi[card.key]?.netMarginPct || 0) >= 0 ? 'text-cyan-400' : 'text-red-400'">{{ kpi[card.key]?.netMarginPct || 0 }}%</span>
          </div>
        </div>
      </div>
    </div>
    <div v-else-if="loading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
      <div v-for="n in 5" :key="n" class="skeleton h-40 rounded-2xl" />
    </div>

    <!-- Bénéfices du mois -->
    <div v-if="data" class="grid grid-cols-2 lg:grid-cols-5 gap-3">
      <div class="bg-[#0d0d14] rounded-2xl p-4 border border-zinc-800">
        <p class="text-[9px] font-mono text-zinc-500 uppercase tracking-wider">Bénéfice brut / mois</p>
        <p class="mt-2 text-lg font-black font-mono text-white">{{ fmt(kpi.month?.grossProfitXof) }}</p>
        <p class="text-[9px] font-mono text-zinc-600 mt-1">CA − coût marchandises</p>
      </div>
      <div class="bg-[#0d0d14] rounded-2xl p-4 border border-zinc-800">
        <p class="text-[9px] font-mono text-zinc-500 uppercase tracking-wider">Bénéfice net / mois</p>
        <p class="mt-2 text-lg font-black font-mono text-emerald-400">{{ fmt(kpi.month?.netProfitXof) }}</p>
        <p class="text-[9px] font-mono text-zinc-600 mt-1">Brut − dépenses</p>
      </div>
      <div class="bg-[#0d0d14] rounded-2xl p-4 border border-zinc-800">
        <p class="text-[9px] font-mono text-zinc-500 uppercase tracking-wider">Contribution / mois</p>
        <p class="mt-2 text-lg font-black font-mono text-violet-400">{{ fmt(kpi.month?.contribution) }}</p>
        <p class="text-[9px] font-mono text-zinc-600 mt-1">Brut − frais plateforme</p>
      </div>
      <div class="bg-[#0d0d14] rounded-2xl p-4 border border-zinc-800">
        <p class="text-[9px] font-mono text-zinc-500 uppercase tracking-wider">Marge brute</p>
        <p class="mt-2 text-lg font-black font-mono text-white">{{ kpi.month?.grossMarginPct || 0 }}%</p>
        <p class="text-[9px] font-mono text-zinc-600 mt-1">sur le mois en cours</p>
      </div>
      <div class="bg-[#0d0d14] rounded-2xl p-4 border border-zinc-800">
        <p class="text-[9px] font-mono text-zinc-500 uppercase tracking-wider">Marge nette</p>
        <p class="mt-2 text-lg font-black font-mono text-cyan-400">{{ kpi.month?.netMarginPct || 0 }}%</p>
        <p class="text-[9px] font-mono text-zinc-600 mt-1">sur le mois en cours</p>
      </div>
    </div>

    <!-- Charts -->
    <div v-if="data" class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="bg-[#0d0d14] rounded-2xl p-5 border border-zinc-800">
        <div class="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h3 class="text-sm font-extrabold text-white font-mono uppercase tracking-wider">CA · 30 DERNIERS JOURS</h3>
            <p class="text-[10px] font-mono text-zinc-500">CA {{ fmt(dailyTotalRevenue) }} · Dépenses {{ fmt(dailyTotalExpenses) }}</p>
          </div>
          <div class="flex items-center gap-3 text-[9px] font-mono text-zinc-500">
            <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-sm bg-emerald-500" /> CA</span>
            <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-sm bg-red-500" /> Dépenses</span>
          </div>
        </div>
        <div class="flex items-end gap-[3px] h-36">
          <div v-for="d in daily" :key="d.key" class="flex-1 flex flex-col justify-end gap-[2px] min-w-0" :title="`${d.label} · CA ${fmt(d.revenueXof)} · Dépenses ${fmt(d.expensesXof)} · Net ${fmt(dailyNet(d))}`">
            <div class="w-full rounded-sm bg-red-500/70" :style="{ height: dailyBarH(d.expensesXof) + '%' }" />
            <div class="w-full rounded-sm bg-emerald-500/80" :style="{ height: Math.max(0, dailyBarH(d.revenueXof)) + '%' }" />
          </div>
        </div>
        <div class="flex justify-between mt-1 text-[8px] font-mono text-zinc-600">
          <span>{{ daily[0]?.label }}</span><span>{{ daily[Math.floor((daily.length - 1) / 2)]?.label }}</span><span>{{ daily[daily.length - 1]?.label }}</span>
        </div>
      </div>

      <div class="bg-[#0d0d14] rounded-2xl p-5 border border-zinc-800">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h3 class="text-sm font-extrabold text-white font-mono uppercase tracking-wider">CA · 12 DERNIERS MOIS</h3>
            <p class="text-[10px] font-mono text-zinc-500">Bénéfice net cumulé : {{ fmt(monthly.reduce((s, m) => s + (Number(m.netProfitXof) || 0), 0)) }}</p>
          </div>
        </div>
        <div class="flex items-end gap-[3px] h-36">
          <div v-for="m in monthly" :key="m.key" class="flex-1 flex flex-col justify-end gap-[2px] min-w-0" :title="`${m.label} · CA ${fmt(m.revenueXof)} · Dépenses ${fmt(m.expensesXof)} · Net ${fmt(m.netProfitXof)}`">
            <div class="w-full rounded-sm bg-red-500/70" :style="{ height: monthlyBarH(m.expensesXof) + '%' }" />
            <div class="w-full rounded-sm bg-emerald-500/80" :style="{ height: Math.max(0, monthlyBarH(m.revenueXof)) + '%' }" />
          </div>
        </div>
        <div class="flex justify-between mt-1 text-[8px] font-mono text-zinc-600">
          <span>{{ monthly[0]?.label }}</span><span>{{ monthly[Math.floor((monthly.length - 1) / 2)]?.label }}</span><span>{{ monthly[monthly.length - 1]?.label }}</span>
        </div>
      </div>
    </div>

    <!-- Gestion des dépenses -->
    <div v-if="data" class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <!-- Form -->
      <div class="bg-[#0d0d14] rounded-2xl p-5 border border-zinc-800 lg:col-span-1">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-sm font-extrabold text-white font-mono uppercase tracking-wider">{{ editing ? 'Modifier la dépense' : 'Nouvelle dépense' }}</h3>
          <button v-if="editing" @click="resetForm" class="text-[9px] font-mono text-zinc-500 hover:text-white">Annuler</button>
        </div>
        <div class="space-y-3">
          <div class="space-y-1">
            <label class="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Libellé *</label>
            <input v-model="form.label" placeholder="Ex : achat 10 téléphones Xiaomi" class="w-full bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:border-[#ff2a2a]/60 focus:outline-none" />
          </div>
          <div class="space-y-1">
            <label class="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Catégorie</label>
            <select v-model="form.category" class="w-full bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:border-[#ff2a2a]/60 focus:outline-none">
              <option v-for="c in EXPENSE_CATEGORIES" :key="c.value" :value="c.value" class="bg-[#0d0d14]">{{ c.label }}</option>
            </select>
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
            <label class="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Paiement</label>
            <select v-model="form.paymentMethod" class="w-full bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:border-[#ff2a2a]/60 focus:outline-none">
              <option v-for="m in EXPENSE_PAYMENT_METHODS" :key="m.value" :value="m.value" class="bg-[#0d0d14]">{{ m.label }}</option>
            </select>
          </div>
          <div class="space-y-1">
            <label class="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Note (optionnel)</label>
            <textarea v-model="form.note" rows="2" placeholder="Détail / fournisseur…" class="w-full bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:border-[#ff2a2a]/60 focus:outline-none resize-none" />
          </div>
          <button @click="saveExpense" :disabled="busy || !form.label || !form.amountXof"
            class="w-full inline-flex items-center justify-center gap-1.5 bg-[#ff2a2a] hover:bg-red-600 text-white text-xs font-bold px-4 py-3 rounded-xl transition-all font-mono disabled:opacity-50">
            {{ busy ? '…' : editing ? 'Enregistrer les modifications' : '+ Ajouter la dépense' }}
          </button>
          <p v-if="formMsg" class="text-[10px] font-mono text-emerald-400">{{ formMsg }}</p>
          <p v-if="form.category" class="text-[9px] font-mono text-zinc-600">💡 {{ EXPENSE_CATEGORIES.find((c) => c.value === form.category)?.hint }}</p>
        </div>
      </div>

      <!-- List + filters -->
      <div class="lg:col-span-2 bg-[#0d0d14] rounded-2xl p-5 border border-zinc-800">
        <div class="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h3 class="text-sm font-extrabold text-white font-mono uppercase tracking-wider">Dépenses</h3>
            <p class="text-[10px] font-mono text-zinc-500">Total affiché : <span class="text-red-400">{{ fmt(filteredTotal) }}</span> · {{ filteredExpenses.length }} ligne(s)</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <select v-model="periodFilter" class="bg-black/40 border border-zinc-800 rounded-lg px-2 py-2 text-[10px] font-mono text-slate-200 focus:outline-none focus:border-[#ff2a2a]/60">
              <option value="all" class="bg-[#0d0d14]">Toutes périodes</option>
              <option value="month" class="bg-[#0d0d14]">Ce mois</option>
              <option value="year" class="bg-[#0d0d14]">Cette année</option>
            </select>
            <select v-model="catFilter" class="bg-black/40 border border-zinc-800 rounded-lg px-2 py-2 text-[10px] font-mono text-slate-200 focus:outline-none focus:border-[#ff2a2a]/60">
              <option value="" class="bg-[#0d0d14]">Toutes catégories</option>
              <option v-for="c in EXPENSE_CATEGORIES" :key="c.value" :value="c.value" class="bg-[#0d0d14]">{{ c.label }}</option>
            </select>
          </div>
        </div>

        <div v-if="filteredExpenses.length === 0" class="text-center py-10 text-zinc-600 font-mono text-[11px]">AUCUNE DÉPENSE ENREGISTRÉE</div>
        <div v-else class="space-y-2 max-h-[420px] overflow-y-auto pr-1">
          <div v-for="e in filteredExpenses" :key="e.id" class="flex items-center gap-3 bg-black/30 border border-zinc-900 rounded-xl p-3 hover:border-zinc-700 transition-all">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <p class="text-xs text-white font-mono font-bold truncate">{{ e.label }}</p>
                <span class="shrink-0 text-[8px] font-mono px-1.5 py-0.5 rounded-full bg-zinc-800/80 text-zinc-400">{{ EXPENSE_CATEGORY_LABEL(e.category) }}</span>
              </div>
              <p class="text-[9px] font-mono text-zinc-600 mt-0.5">
                {{ new Date(e.date + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) }}
                · {{ EXPENSE_PAYMENT_LABEL(e.paymentMethod) }}
                <span v-if="e.note"> · {{ e.note }}</span>
              </p>
            </div>
            <p class="text-sm font-mono font-black text-red-400 shrink-0">− {{ fmt(e.amountXof) }}</p>
            <div class="flex items-center gap-1 shrink-0">
              <button @click="openEdit(e)" title="Modifier" class="w-7 h-7 rounded-lg border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:border-[#ff2a2a]/50 transition-all">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg>
              </button>
              <button @click="removeExpense(e.id)" title="Supprimer" class="w-7 h-7 rounded-lg border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-red-400 hover:border-red-500/50 transition-all">
                <AppIcon name="trash2" :size="12" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Répartition des dépenses par catégorie -->
    <div v-if="data && data.categories.length" class="bg-[#0d0d14] rounded-2xl p-5 border border-zinc-800">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h3 class="text-sm font-extrabold text-white font-mono uppercase tracking-wider">Répartition des dépenses</h3>
          <p class="text-[10px] font-mono text-zinc-500">Total : {{ fmt(data.expensesTotalXof) }}</p>
        </div>
      </div>
      <div class="space-y-2.5">
        <div v-for="c in data.categories" :key="c.category" class="flex items-center gap-3">
          <span class="w-40 shrink-0 text-[10px] font-mono text-zinc-400 truncate" :title="c.label">{{ c.label }}</span>
          <div class="flex-1 h-3 rounded-full bg-black/40 border border-zinc-900 overflow-hidden">
            <div class="h-full rounded-full bg-gradient-to-r from-red-600 to-[#ff2a2a]" :style="{ width: Math.min(100, c.pct) + '%' }" />
          </div>
          <span class="w-24 shrink-0 text-right text-[10px] font-mono text-white">{{ fmt(c.totalXof) }}</span>
          <span class="w-12 shrink-0 text-right text-[9px] font-mono text-zinc-500">{{ c.pct }}%</span>
        </div>
      </div>
    </div>

    <!-- Tableau mensuel -->
    <div v-if="data" class="bg-[#0d0d14] rounded-2xl p-5 border border-zinc-800 overflow-hidden">
      <h3 class="text-sm font-extrabold text-white font-mono uppercase tracking-wider mb-4">Bilan mensuel (12 mois)</h3>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-[11px] font-mono min-w-[640px]">
          <thead>
            <tr class="text-[9px] text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
              <th class="py-2 pr-3 font-bold">Mois</th>
              <th class="py-2 pr-3 font-bold text-right">CA</th>
              <th class="py-2 pr-3 font-bold text-right">Coût</th>
              <th class="py-2 pr-3 font-bold text-right">Dépenses</th>
              <th class="py-2 pr-3 font-bold text-right">Bénéfice net</th>
              <th class="py-2 pr-3 font-bold text-right">Marge nette</th>
              <th class="py-2 font-bold text-right">Commandes</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in [...monthly].reverse()" :key="m.key" class="border-b border-zinc-900/70 hover:bg-black/30 transition-all">
              <td class="py-2 pr-3 text-zinc-300 capitalize">{{ m.label }}</td>
              <td class="py-2 pr-3 text-right text-emerald-400 font-bold">{{ fmt(m.revenueXof) }}</td>
              <td class="py-2 pr-3 text-right text-zinc-400">{{ fmt(m.costXof) }}</td>
              <td class="py-2 pr-3 text-right text-red-400">{{ fmt(m.expensesXof) }}</td>
              <td class="py-2 pr-3 text-right font-black" :class="m.netProfitXof >= 0 ? 'text-emerald-400' : 'text-red-400'">{{ fmt(m.netProfitXof) }}</td>
              <td class="py-2 pr-3 text-right" :class="m.netProfitXof >= 0 ? 'text-cyan-400' : 'text-red-400'">{{ m.revenueXof > 0 ? Math.round((m.netProfitXof / m.revenueXof) * 1000) / 10 + '%' : '—' }}</td>
              <td class="py-2 text-right text-zinc-500">{{ m.orders }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Top produits -->
    <div v-if="data && data.topProducts.length" class="bg-[#0d0d14] rounded-2xl p-5 border border-zinc-800 overflow-hidden">
      <h3 class="text-sm font-extrabold text-white font-mono uppercase tracking-wider mb-4">Top produits par chiffre d'affaires</h3>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-[11px] font-mono min-w-[640px]">
          <thead>
            <tr class="text-[9px] text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
              <th class="py-2 pr-3 font-bold">Produit</th>
              <th class="py-2 pr-3 font-bold text-right">Ventes</th>
              <th class="py-2 pr-3 font-bold text-right">CA</th>
              <th class="py-2 pr-3 font-bold text-right">Coût</th>
              <th class="py-2 pr-3 font-bold text-right">Bénéfice brut</th>
              <th class="py-2 font-bold text-right">Marge</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in data.topProducts" :key="p.id" class="border-b border-zinc-900/70 hover:bg-black/30 transition-all">
              <td class="py-2 pr-3">
                <div class="flex items-center gap-2 min-w-0">
                  <img v-if="p.imageUrl" :src="p.imageUrl" alt="" class="w-8 h-8 rounded-lg object-cover border border-zinc-800 shrink-0" @error="($event.target as HTMLImageElement).style.display='none'" />
                  <span class="truncate text-zinc-300">{{ p.title }}</span>
                </div>
              </td>
              <td class="py-2 pr-3 text-right text-zinc-500">{{ p.orders }}</td>
              <td class="py-2 pr-3 text-right text-emerald-400 font-bold">{{ fmt(p.revenueXof) }}</td>
              <td class="py-2 pr-3 text-right text-zinc-400">{{ fmt(p.costXof) }}</td>
              <td class="py-2 pr-3 text-right font-black" :class="p.grossProfitXof >= 0 ? 'text-emerald-400' : 'text-red-400'">{{ fmt(p.grossProfitXof) }}</td>
              <td class="py-2 text-right text-cyan-400">{{ p.marginPct }}%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Pop-up d'édition d'une dépense -->
    <div v-if="editModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" @click="closeEdit" />
      <div class="relative w-full max-w-md bg-[#12121a] border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl">
        <div class="flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-[#0d0d14]">
          <h3 class="text-sm font-extrabold text-white font-mono uppercase tracking-widest">✏️ Modifier la dépense</h3>
          <button @click="closeEdit" aria-label="Fermer"
            class="w-8 h-8 rounded-lg border border-zinc-800 flex items-center justify-center text-zinc-300 hover:text-white hover:border-[#ff2a2a]/50 transition-all">✕</button>
        </div>
        <div class="p-5 space-y-3">
          <p v-if="editError" class="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-400 font-mono">{{ editError }}</p>
          <div class="space-y-1">
            <label class="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Libellé *</label>
            <input v-model="editForm.label" placeholder="Ex : achat 10 téléphones Xiaomi" class="w-full bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:border-[#ff2a2a]/60 focus:outline-none" />
          </div>
          <div class="space-y-1">
            <label class="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Catégorie</label>
            <select v-model="editForm.category" class="w-full bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:border-[#ff2a2a]/60 focus:outline-none">
              <option v-for="c in EXPENSE_CATEGORIES" :key="c.value" :value="c.value" class="bg-[#0d0d14]">{{ c.label }}</option>
            </select>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div class="space-y-1">
              <label class="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Montant (F CFA) *</label>
              <input v-model.number="editForm.amountXof" type="number" min="0" step="50" placeholder="50000" class="w-full bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:border-[#ff2a2a]/60 focus:outline-none" />
            </div>
            <div class="space-y-1">
              <label class="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Date</label>
              <input v-model="editForm.date" type="date" class="w-full bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:border-[#ff2a2a]/60 focus:outline-none" />
            </div>
          </div>
          <div class="space-y-1">
            <label class="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Paiement</label>
            <select v-model="editForm.paymentMethod" class="w-full bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:border-[#ff2a2a]/60 focus:outline-none">
              <option v-for="m in EXPENSE_PAYMENT_METHODS" :key="m.value" :value="m.value" class="bg-[#0d0d14]">{{ m.label }}</option>
            </select>
          </div>
          <div class="space-y-1">
            <label class="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Note (optionnel)</label>
            <textarea v-model="editForm.note" rows="2" placeholder="Détail / fournisseur…" class="w-full bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:border-[#ff2a2a]/60 focus:outline-none resize-none" />
          </div>
          <div class="flex items-center gap-2 pt-1">
            <button @click="closeEdit" class="flex-1 border border-zinc-800 text-zinc-400 hover:text-white text-xs font-bold px-3 py-2.5 rounded-xl transition-all font-mono">Annuler</button>
            <button @click="saveEdit" :disabled="editBusy || !editForm.label.trim() || !editForm.amountXof"
              class="flex-1 bg-[#ff2a2a] hover:bg-red-600 text-white text-xs font-bold px-3 py-2.5 rounded-xl transition-all font-mono disabled:opacity-50">
              {{ editBusy ? '…' : '💾 Enregistrer' }}
            </button>
          </div>
          <p v-if="editMsg" class="text-[10px] font-mono text-emerald-400">{{ editMsg }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
