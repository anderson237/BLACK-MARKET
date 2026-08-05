<script setup lang="ts">
definePageMeta({ layout: 'admin' })

const store = useAdminStore()
const error = ref('')
const renaming = ref<string | null>(null)
const renameValue = ref('')
const busy = ref(false)

const newCat = ref('')
const suggestions = ['Techwear', 'Streetwear', 'Cyber Gadgets', 'Gaming Room', 'Accessoires', 'Exclusif', 'Nouveautés', 'Chaussures', 'Bags']

onMounted(() => {
  store.loadProducts()
  loadLocal()
})

const categoryStats = computed(() => {
  const map = new Map<string, { count: number }>()
  for (const p of store.products) {
    const cat = (p.category || 'Autres').trim() || 'Autres'
    const cur = map.get(cat) || { count: 0 }
    cur.count += 1
    map.set(cat, cur)
  }
  return [...map.entries()].sort((a, b) => b[1].count - a[1].count)
})

const usedCats = computed(() => new Set(categoryStats.value.map(([c]) => c)))

async function startRename(cat: string) {
  renaming.value = cat
  renameValue.value = cat
}

async function applyRename() {
  const from = renaming.value
  const to = renameValue.value.trim()
  if (!from || !to || from === to) {
    renaming.value = null
    return
  }
  error.value = ''
  busy.value = true
  try {
    const affected = store.products.filter((p) => (p.category || 'Autres') === from)
    if (!affected.length) return
    for (const p of affected) {
      await store.updateProduct({ ...p, category: to })
    }
    renaming.value = null
  } catch (e: any) {
    error.value = e?.message || 'Erreur lors du renommage.'
  } finally {
    busy.value = false
  }
}

async function reassignTo(from: string, to: string) {
  error.value = ''
  busy.value = true
  try {
    const affected = store.products.filter((p) => (p.category || 'Autres') === from)
    for (const p of affected) {
      await store.updateProduct({ ...p, category: to })
    }
  } catch (e: any) {
    error.value = e?.message || 'Erreur lors du reclassement.'
  } finally {
    busy.value = false
  }
}

function askDelete(cat: string, count: number) {
  if (confirm(`Supprimer la catégorie « ${cat} » ?\n${count} produit(s) seront reclassé(s) en « Exclusif ».`)) {
    reassignTo(cat, 'Exclusif')
  }
}

async function addCategory() {
  const v = newCat.value.trim()
  if (!v) return
  error.value = ''
  try {
    newCat.value = ''
    if (!known.value.includes(v)) known.value.push(v)
    if (import.meta.client) localStorage.setItem('bm_known_categories', JSON.stringify(known.value))
    knowCat(v)
  } catch (e: any) {
    error.value = e?.message || "Erreur lors de l'ajout."
  }
}

const known = ref<string[]>([])
function loadLocal() {
  if (!import.meta.client) return
  try { known.value = JSON.parse(localStorage.getItem('bm_known_categories') || '[]') } catch { known.value = [] }
}
function knowCat(cat: string) {
  if (!usedCats.value.has(cat) && !known.value.includes(cat)) known.value.push(cat)
  if (import.meta.client) localStorage.setItem('bm_known_categories', JSON.stringify(known.value))
}
</script>

<template>
  <div>
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
      <div>
        <h1 class="text-lg font-extrabold text-white font-mono uppercase tracking-widest">Catégories</h1>
        <p class="text-[11px] text-zinc-500 font-mono mt-1">Organisez vos drops par catégorie. Renommer ou supprimer met à jour tous les produits concernés.</p>
      </div>
      <button @click="store.loadProducts()" class="shrink-0 text-[11px] font-mono text-zinc-300 hover:text-white border border-zinc-800 hover:border-[#ff2a2a]/50 px-3 py-2 rounded-xl transition-all">⟳ Actualiser</button>
    </div>

    <p v-if="error" class="mb-4 bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-400 font-mono">{{ error }}</p>

    <!-- Add / suggestions -->
    <div class="bg-[#12121a] border border-zinc-800 rounded-2xl p-4 mb-5 space-y-3">
      <div class="flex items-center gap-2">
        <input v-model="newCat" @keyup.enter="addCategory" placeholder="Nouvelle catégorie..."
          class="flex-1 bg-black/40 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:border-[#ff2a2a]/60 focus:outline-none" />
        <button @click="addCategory" :disabled="busy" class="shrink-0 bg-[#ff2a2a] hover:bg-red-600 disabled:opacity-40 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all">＋ Ajouter</button>
      </div>
      <div class="flex items-center gap-1.5 flex-wrap">
        <span class="text-[9px] text-zinc-500 font-mono uppercase tracking-widest">Suggestions :</span>
        <button v-for="s in suggestions" :key="s" @click="newCat = s"
          class="px-3 py-1 rounded-full text-[10px] font-mono border transition-all"
          :class="usedCats.has(s) ? 'bg-[#ff2a2a]/10 border-[#ff2a2a]/40 text-[#ff2a2a]' : 'bg-black text-zinc-400 border-zinc-800 hover:border-[#ff2a2a]/50 hover:text-slate-300'">
          {{ s }}
        </button>
      </div>
    </div>

    <div v-if="store.loading" class="space-y-3">
      <div v-for="n in 3" :key="n" class="skeleton h-16 rounded-2xl" />
    </div>

    <div v-else class="space-y-2">
      <div v-for="[cat, st] in categoryStats" :key="cat" class="flex items-center gap-3 bg-[#12121a] border border-zinc-800 rounded-2xl p-3">
        <span class="w-9 h-9 rounded-lg bg-[#ff2a2a]/10 border border-[#ff2a2a]/25 grid place-items-center text-[#ff2a2a]"><AppIcon name="tag" :size="16" /></span>
        <div class="flex-1 min-w-0">
          <p class="text-xs font-bold text-slate-100">{{ cat }}</p>
          <p class="text-[10px] text-zinc-500 font-mono">{{ st.count }} produit(s)</p>
        </div>
        <div class="flex flex-wrap items-center gap-1.5 justify-end">
          <template v-if="renaming === cat">
            <input
              v-model="renameValue"
              @keyup.enter="applyRename"
              class="bg-black/40 border border-zinc-800 rounded-lg px-2.5 py-2 text-[11px] font-mono text-slate-200 w-full sm:w-32 focus:border-[#ff2a2a]/60 focus:outline-none"
            />
            <button @click="applyRename" :disabled="busy" class="text-[10px] font-mono text-green-400 border border-green-500/30 px-2.5 py-2 rounded-lg hover:bg-green-500/10">OK</button>
            <button @click="renaming = null" class="text-[10px] font-mono text-zinc-400 px-2 py-2 inline-flex items-center"><AppIcon name="close" :size="12" /></button>
          </template>
          <button v-else @click="startRename(cat)" class="text-[10px] font-mono text-zinc-300 hover:text-white border border-zinc-800 px-2.5 py-2 rounded-lg transition-all">Renommer</button>
          <button @click="askDelete(cat, st.count)" class="text-[10px] font-mono text-red-400 hover:text-red-300 border border-red-500/30 px-2.5 py-2 rounded-lg transition-all" title="Reclasse en « Exclusif »" :disabled="busy">Suppr.</button>
        </div>
      </div>

      <p v-if="!categoryStats.length && !store.loading" class="py-12 text-center text-zinc-500 font-mono text-xs">Aucune catégorie. Ajoutez des produits d'abord.</p>
    </div>
  </div>
</template>