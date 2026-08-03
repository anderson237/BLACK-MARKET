<script setup lang="ts">
definePageMeta({ layout: 'admin' })

const store = useAdminStore()
const chineseDescription = ref('')
const imageBase64 = ref('')
const imageMimeType = ref('')
const customMarkup = ref(60)
const basePriceRmb = ref<number | null>(null)
const loading = ref(false)
const error = ref('')

const result = ref<any>(null)
const editMode = ref(false)
const editable = ref<any>(null)

const canRun = computed(() => Boolean(chineseDescription.value.trim() || imageBase64.value))

function onImagePicked(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    const dataUrl = reader.result as string
    const m = dataUrl.match(/^data:(.+?);base64,(.*)$/)
    if (m) {
      imageBase64.value = m[2]
      imageMimeType.value = m[1]
    }
  }
  reader.readAsDataURL(file)
}

function startEdit() {
  editMode.value = true
  editable.value = JSON.parse(JSON.stringify(result.value.data))
}

function buildProduct(data: any) {
  return {
    id: 'ai_' + Date.now(),
    title: data.translatedTitle || 'Produit IA',
    description: data.salesPitch || data.translatedDescription || '',
    features: data.features || [],
    priceEur: Number(data.priceEur) || 0,
    priceXof: Number(data.priceXof) || 0,
    imageUrl: imageBase64.value ? `data:${imageMimeType.value};base64,${imageBase64.value}` : '',
    category: 'Nouveautés',
    whatsappClicks: 0,
    createdAt: new Date().toISOString(),
  } as any
}

async function run() {
  error.value = ''
  result.value = null
  editMode.value = false
  if (!canRun.value) {
    error.value = 'Collez une description chinoise ou une image de produit.'
    return
  }
  loading.value = true
  try {
    const res = await fetch('/api/translate-product', {
      method: 'POST',
      headers: store.headers(),
      body: JSON.stringify({
        chineseDescription: chineseDescription.value.trim() || undefined,
        imageBase64: imageBase64.value || undefined,
        imageMimeType: imageMimeType.value || undefined,
        customMarkup: customMarkup.value,
        basePriceRmb: basePriceRmb.value || undefined,
      }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      throw new Error(j?.statusMessage || j?.error || `Erreur ${res.status}`)
    }
    const json = await res.json()
    result.value = json
  } catch (e: any) {
    error.value = e?.message || "Impossible d'appeler l'IA."
  } finally {
    loading.value = false
  }
}

async function saveProduct(p: any) {
  try {
    await store.createProduct(p)
    return true
  } catch (e: any) {
    error.value = e?.message || "Impossible d'ajouter le produit."
    return false
  }
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-lg font-extrabold text-white font-mono uppercase tracking-widest">Génération IA</h1>
        <p class="text-[11px] text-zinc-500 font-mono mt-1">Sourcing Taobao / 1688 → fiche produit FR prête à vendre.</p>
      </div>
      <span class="text-[9px] font-mono uppercase border border-zinc-800 rounded-lg px-2 py-1 text-zinc-500">Gemini</span>
    </div>

    <p v-if="error" class="mb-4 bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-400 font-mono">{{ error }}</p>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Input -->
      <section class="bg-[#12121a] border border-zinc-800 rounded-2xl p-4 space-y-3">
        <p class="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Source</p>
        <textarea
          v-model="chineseDescription"
          rows="5"
          placeholder="Collez la description chinoise du produit (Taobao, 1688, WeChat)…"
          class="w-full bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:border-[#ff2a2a]/60 focus:outline-none resize-y"
        />
        <div>
          <label class="block text-[10px] text-zinc-500 font-mono uppercase tracking-widest mb-1.5">Image du produit (optionnel)</label>
          <label class="flex flex-col items-center justify-center gap-1.5 border border-dashed border-zinc-800 hover:border-[#ff2a2a]/50 rounded-xl py-6 cursor-pointer text-zinc-400 hover:text-white transition-all">
            <span class="text-xl">📷</span>
            <span class="text-[10px] font-mono">{{ imageBase64 ? 'Image chargée ✓' : 'Cliquer pour ajouter' }}</span>
            <input type="file" accept="image/*" class="hidden" @change="onImagePicked" />
          </label>
          <img v-if="imageBase64" :src="`data:${imageMimeType};base64,${imageBase64}`" class="mt-2 w-20 h-20 object-cover rounded-lg border border-zinc-800" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-[10px] text-zinc-500 font-mono uppercase tracking-widest mb-1">Marge %</label>
            <input v-model.number="customMarkup" type="number" min="0" class="w-full bg-black/40 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:border-[#ff2a2a]/60 focus:outline-none" />
          </div>
          <div>
            <label class="block text-[10px] text-zinc-500 font-mono uppercase tracking-widest mb-1">Prix base (RMB)</label>
            <input v-model.number="basePriceRmb" type="number" min="0" placeholder="0" class="w-full bg-black/40 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:border-[#ff2a2a]/60 focus:outline-none" />
          </div>
        </div>
        <button
          @click="run"
          :disabled="loading || !canRun"
          class="w-full inline-flex items-center justify-center gap-2 bg-[#ff2a2a] hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold px-4 py-3 rounded-xl font-mono transition-all"
        >
          <span v-if="loading" class="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          {{ loading ? 'Génération…' : '✦ Générer la fiche' }}
        </button>
      </section>

      <!-- Output -->
      <section class="bg-[#12121a] border border-zinc-800 rounded-2xl p-4 space-y-3">
        <div class="flex items-center justify-between">
          <p class="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Résultat</p>
          <button v-if="result && !editMode" @click="startEdit" class="text-[10px] font-mono text-zinc-300 hover:text-white border border-zinc-800 px-2.5 py-1.5 rounded-lg">✎ Éditer</button>
        </div>

        <div v-if="loading" class="py-12 flex flex-col items-center gap-3 text-zinc-500">
          <div class="w-6 h-6 border-2 border-[#ff2a2a]/40 border-t-[#ff2a2a] rounded-full animate-spin" />
          <p class="text-[11px] font-mono">L'IA analyse le produit…</p>
        </div>

        <template v-else-if="result">
          <div class="space-y-3">
            <img v-if="imageBase64" :src="`data:${imageMimeType};base64,${imageBase64}`" class="w-full h-40 object-cover rounded-xl border border-zinc-800" />
            <div v-if="!editMode">
              <p class="text-sm font-extrabold text-white">{{ result.data.translatedTitle }}</p>
              <p class="text-[10px] text-zinc-400 font-mono mt-1">{{ result.data.translatedDescription }}</p>
              <ul class="mt-2 space-y-1">
                <li v-for="f in result.data.features" :key="f" class="text-[11px] text-zinc-300">• {{ f }}</li>
              </ul>
              <div class="mt-3 flex items-center gap-3">
                <span class="text-base font-black text-[#ff2a2a]">{{ result.data.priceXof.toLocaleString('fr-FR') }} F CFA</span>
                <span class="text-[10px] font-mono text-zinc-500">{{ result.data.priceEur }} €</span>
              </div>
              <p class="text-[9px] text-zinc-600 font-mono mt-1">{{ result.data.priceExplanation }}</p>
            </div>
            <div v-else class="space-y-2">
              <input v-model="editable.translatedTitle" class="w-full bg-black/40 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:border-[#ff2a2a]/60 focus:outline-none" />
              <textarea v-model="editable.salesPitch" rows="5" class="w-full bg-black/40 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:border-[#ff2a2a]/60 focus:outline-none" />
              <div class="grid grid-cols-2 gap-3">
                <input v-model.number="editable.priceEur" type="number" class="bg-black/40 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200" />
                <input v-model.number="editable.priceXof" type="number" class="bg-black/40 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200" />
              </div>
            </div>
            <button
              @click="saveProduct(buildProduct(editMode ? editable : result.data))"
              class="w-full inline-flex items-center justify-center gap-2 bg-[#ff2a2a] hover:bg-red-600 text-white text-xs font-bold px-4 py-3 rounded-xl font-mono transition-all"
            >
              ＋ Ajouter au catalogue
            </button>
          </div>
        </template>

        <div v-else class="py-12 text-center text-zinc-600 font-mono text-[11px]">
          Les résultats apparaîtront ici.
        </div>
      </section>
    </div>
  </div>
</template>