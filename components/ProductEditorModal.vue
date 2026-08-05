<script setup lang="ts">
import type { Product } from '~/types'

const props = defineProps<{ product: Product | null }>()
const emit = defineEmits<{ saved: [p: Product]; deleted: [id: string]; close: [] }>()

const store = useAdminStore()
const isNew = !props.product

const config = useRuntimeConfig()
const phoneNumberHint = config.public.phoneNumber || '—'

const draft = reactive({
  id: props.product?.id || '',
  title: props.product?.title || '',
  chineseTitle: props.product?.chineseTitle || '',
  description: props.product?.description || '',
  originalDescription: props.product?.originalDescription || '',
  chineseDescription: props.product?.chineseDescription || '',
  features: [...(props.product?.features || [])],
  priceEur: props.product?.priceEur || 0,
  priceXof: props.product?.priceXof || 0,
  imageUrl: props.product?.imageUrl || '',
  gallery: [...(props.product?.gallery || [])],
  videoUrl: props.product?.videoUrl || '',
  featuredMedia: props.product?.featuredMedia || (props.product?.videoUrl ? 'video' : 'image'),
  category: props.product?.category || 'Techwear',
  whatsappClicks: props.product?.whatsappClicks || 0,
  waNumber: props.product?.waNumber || '',
  sourceRmb: props.product?.sourceRmb || undefined,
  stockStatus: props.product?.stockStatus || 'preorder',
  stockQuantity: props.product?.stockQuantity ?? 0,
  moq: props.product?.moq ?? 0,
})

const saving = ref(false)
const error = ref('')
const aiAction = ref('')
const aiBusy = ref('')
const featureInput = ref('')
const newGalleryUrl = ref('')
const blocksModeDesc = ref(true)
const blocksModeTech = ref(true)

const categories = ['Techwear', 'Streetwear', 'Cyber Gadgets', 'Gaming Room', 'Accessoires', 'Exclusif', 'Nouveautés']

async function save() {
  if (!draft.title.trim() && !draft.description.trim()) {
    error.value = 'Remplissez au moins le titre ou la description.'
    return
  }
  saving.value = true
  error.value = ''
  try {
    const body: Product = {
      ...draft,
      id: draft.id || `prod_${Date.now()}`,
      features: draft.features.filter((f) => f.trim() !== ''),
      sourceRmb: Number(draft.sourceRmb) || 0,
      stockStatus: draft.stockStatus || 'preorder',
      stockQuantity: Math.max(0, Number(draft.stockQuantity) || 0),
      moq: Math.max(0, Number(draft.moq) || 0),
      featuredMedia: draft.videoUrl ? draft.featuredMedia || 'video' : 'image',
    }
    const saved = isNew ? await store.createProduct(body) : await store.updateProduct(body)
    emit('saved', saved)
  } catch (e: any) {
    error.value = e?.message || 'Échec de la sauvegarde.'
  } finally {
    saving.value = false
  }
}

async function remove() {
  try {
    await store.deleteProduct(draft.id)
    emit('deleted', draft.id)
  } catch (e: any) {
    error.value = e?.message || 'Échec de la suppression.'
  }
}

function addFeature() {
  const v = featureInput.value.trim()
  if (v) draft.features.push(v)
  featureInput.value = ''
}

function addGalleryUrl() {
  const v = newGalleryUrl.value.trim()
  if (v) draft.gallery.push(v)
  newGalleryUrl.value = ''
}

async function apiPost(path: string, body: any) {
  const res = await fetch(path, { method: 'POST', headers: store.headers(), body: JSON.stringify(body) })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json?.statusMessage || json?.error || `Erreur ${res.status}`)
  return json
}

/** Refresh the argumentaire or fiche technique via /api/ai-refine (Gemini). */
async function refine(field: 'description' | 'technical') {
  aiBusy.value = `Optimisation ${field === 'description' ? "de l'argumentaire" : 'de la fiche technique'} par l'IA…`
  error.value = ''
  try {
    const { html } = await apiPost('/api/ai-refine', {
      field,
      title: draft.title,
      category: draft.category,
      currentText: field === 'description' ? draft.description : draft.originalDescription,
    })
    if (field === 'description') draft.description = html
    else draft.originalDescription = html
    aiAction.value = field === 'description' ? "Argumentaire optimisé par l'IA ✓" : 'Fiche technique optimisée par l\'IA ✓'
  } catch (e: any) {
    error.value = e?.message || 'Erreur IA.'
  } finally {
    aiBusy.value = ''
  }
}

// ---- Filigrane canvas: bake "BLACK MARKET © 2026" onto any image ----
function watermarkDataUrl(img: HTMLImageElement, targetW = 720, targetH = 720): string {
  const canvas = document.createElement('canvas')
  canvas.width = targetW
  canvas.height = targetH
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas non supporté.')
  const scale = Math.max(targetW / img.width, targetH / img.height)
  const dw = img.width * scale
  const dh = img.height * scale
  ctx.drawImage(img, (targetW - dw) / 2, (targetH - dh) / 2, dw, dh)
  ctx.fillStyle = 'rgba(0,0,0,0.25)'
  ctx.fillRect(0, 0, targetW, targetH)
  ctx.save()
  ctx.translate(targetW / 2, targetH / 2)
  ctx.rotate(-Math.PI / 6)
  ctx.font = `bold ${Math.round(targetW * 0.05)}px monospace`
  ctx.fillStyle = 'rgba(255,255,255,0.30)'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const spacing = Math.round(targetH * 0.3)
  for (let d = -targetH; d < targetH * 2; d += spacing) ctx.fillText('BLACK MARKET © 2026', 0, d)
  ctx.restore()
  return canvas.toDataURL('image/jpeg', 0.9)
}

function readImageFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Image invalide.'))
    img.src = url
  })
}

// ---- Upload avec filigrane ----
async function handleMainFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  aiBusy.value = 'Application du filigrane BLACK MARKET…'
  try {
    const img = await readImageFile(file)
    const dataUrl = watermarkDataUrl(img)
    const json = await apiPost('/api/upload-image', { imageBase64: dataUrl })
    draft.imageUrl = json.url
  } catch (err: any) {
    error.value = err?.message || 'Erreur upload.'
  } finally {
    aiBusy.value = ''
    ;(e.target as HTMLInputElement).value = ''
  }
}

async function handleGalleryFile(e: Event) {
  const files = Array.from((e.target as HTMLInputElement).files || [])
  if (!files.length) return
  aiBusy.value = 'Traitement des images de galerie…'
  try {
    for (const file of files) {
      const img = await readImageFile(file)
      const json = await apiPost('/api/upload-image', { imageBase64: watermarkDataUrl(img) })
      draft.gallery.push(json.url)
    }
  } catch (err: any) {
    error.value = err?.message || 'Erreur upload galerie.'
  } finally {
    aiBusy.value = ''
    ;(e.target as HTMLInputElement).value = ''
  }
}

// ---- IA Pollinations (gratuit, sans clé) ----
function pollinationsUrl(prompt: string, w = 720, h = 720, seed?: number): string {
  const p = new URLSearchParams({ width: String(w), height: String(h), nologo: 'true', model: 'flux' })
  if (seed != null) p.set('seed', String(seed))
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${p.toString()}`
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Échec du chargement de l\'image générée.'))
    img.src = src
  })
}

function buildAdPrompt(suffix: string): string {
  const base = `${draft.title || draft.category || 'premium streetwear product'} — ${draft.description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 220)} `
  return `${base} advertising, premium e-commerce, dramatic studio lighting, dark red and black background, neon accents, professional product photography, ${suffix}`
}

async function generateAiPhoto() {
  aiBusy.value = 'Génération de la photo publicitaire IA (Flux)…'
  error.value = ''
  try {
    const url = pollinationsUrl(buildAdPrompt('vertical composition 9:16'), 720, 1280, Math.floor(Math.random() * 1000))
    const img = await loadImg(url)
    const json = await apiPost('/api/upload-image', { imageBase64: watermarkDataUrl(img, 720, 1280) })
    draft.imageUrl = json.url
  } catch (err: any) {
    error.value = err?.message || 'Erreur génération IA.'
  } finally {
    aiBusy.value = ''
  }
}

async function generateAiCarousel() {
  aiBusy.value = 'Génération de 3 photos carrousel IA…'
  error.value = ''
  try {
    for (let i = 0; i < 3; i++) {
      const prompt = buildAdPrompt(`angle ${i + 1}, ${i === 0 ? 'hero shot' : i === 1 ? 'detail shot' : 'lifestyle shot'}`)
      const url = pollinationsUrl(prompt, 720, 1280, Math.floor(Math.random() * 1000) + i * 13)
      const img = await loadImg(url)
      const json = await apiPost('/api/upload-image', { imageBase64: watermarkDataUrl(img, 720, 1280) })
      draft.gallery.push(json.url)
    }
  } catch (err: any) {
    error.value = err?.message || 'Erreur génération carrousel.'
  } finally {
    aiBusy.value = ''
  }
}

async function generateAiVideo() {
  aiBusy.value = 'Génération de la vidéo publicitaire IA…'
  error.value = ''
  try {
    const url = `https://video.pollinations.ai/prompt/${encodeURIComponent(buildAdPrompt('commercial video ad, sleek product reveal'))}?width=720&height=1280&nologo=true`
    draft.videoUrl = url
  } catch (err: any) {
    error.value = err?.message || 'Erreur vidéo IA.'
  } finally {
    aiBusy.value = ''
  }
}
</script>

<template>
  <!-- Fixed full-screen overlay: scroll is internal, layout never stretches. -->
  <div class="fixed inset-0 z-50 flex items-stretch justify-center p-0 sm:p-4">
    <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" @click="emit('close')" />

    <div class="relative w-full max-w-2xl bg-[#12121a] border border-zinc-800 flex flex-col overflow-hidden sm:rounded-3xl">
      <!-- Header -->
      <div class="flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-[#0d0d14] shrink-0">
        <h2 class="text-sm font-extrabold text-white font-mono uppercase tracking-widest">
          {{ isNew ? '+ Nouveau produit' : '✏️ Éditer le produit' }}
        </h2>
        <button @click="emit('close')" aria-label="Fermer"
          class="w-8 h-8 rounded-lg border border-zinc-800 flex items-center justify-center text-zinc-300 hover:text-white hover:border-[#ff2a2a]/50 transition-all">✕</button>
      </div>

      <!-- Scrollable body -->
      <div class="flex-1 overflow-y-auto p-5 space-y-5">
        <p v-if="error" class="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-400 font-mono">{{ error }}</p>
        <p v-if="aiAction" class="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-xs text-emerald-400 font-mono">{{ aiAction }}</p>

        <!-- Titre + chinese -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div class="space-y-2">
            <label class="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Titre</label>
            <input v-model="draft.title" class="w-full bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:border-[#ff2a2a]/60 focus:outline-none" placeholder="Nom du produit" />
          </div>
          <div class="space-y-2">
            <label class="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Grossiste 中文 (chinois)</label>
            <input v-model="draft.chineseTitle" class="w-full bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:border-[#ff2a2a]/60 focus:outline-none" placeholder="Titre du grossiste chinois" />
          </div>
        </div>

        <!-- Catégorie + prix + source -->
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          <div class="space-y-2">
            <label class="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Catégorie</label>
            <select v-model="draft.category" class="w-full bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:border-[#ff2a2a]/60 focus:outline-none">
              <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
            </select>
          </div>
          <div class="space-y-2">
            <label class="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Prix F CFA</label>
            <input v-model.number="draft.priceXof" type="number" class="w-full bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:border-[#ff2a2a]/60 focus:outline-none" placeholder="29500" />
          </div>
          <div class="space-y-2">
            <label class="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Source ¥ RMB</label>
            <input v-model.number="draft.sourceRmb" type="number" class="w-full bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:border-[#ff2a2a]/60 focus:outline-none" placeholder="200" />
          </div>
        </div>

        <!-- Stock : statut + quantité + MOQ -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div class="space-y-2">
            <label class="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Statut stock</label>
            <select v-model="draft.stockStatus" class="w-full bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:border-[#ff2a2a]/60 focus:outline-none">
              <option value="preorder">📦 Précommande</option>
              <option value="in_stock">✅ En stock</option>
            </select>
          </div>
          <div class="space-y-2">
            <label class="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Quantité en stock</label>
            <input v-model.number="draft.stockQuantity" type="number" min="0" class="w-full bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:border-[#ff2a2a]/60 focus:outline-none" placeholder="0 = non affichée" />
            <p class="text-[9px] text-zinc-600 font-mono">Affichée en vitrine si différente de 0.</p>
          </div>
          <div class="space-y-2">
            <label class="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">MOQ (min. de commande)</label>
            <input v-model.number="draft.moq" type="number" min="0" class="w-full bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:border-[#ff2a2a]/60 focus:outline-none" placeholder="0" />
            <p class="text-[9px] text-zinc-600 font-mono">0 = pas de minimum (MOQ non affiché).</p>
          </div>
        </div>

        <!-- WhatsApp per product (fallback: site number) -->
        <div class="space-y-2">
          <label class="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">WhatsApp (numéro du produit)</label>
          <input v-model="draft.waNumber" type="tel" inputmode="numeric" class="w-full bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:border-[#ff2a2a]/60 focus:outline-none" placeholder="ex: 237691234567 — vide = numéro du site" />
          <p class="text-[9px] text-zinc-600 font-mono">Si vide, la précommande part vers le numéro du site ({{ phoneNumberHint }}).</p>
        </div>

        <!-- Image upload + filigrane -->
        <div class="space-y-2">
          <label class="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Image principale (upload + filigrane auto)</label>
          <div class="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
            <input type="file" ref="fileInput" accept="image/*" @change="handleMainFile" class="text-[11px] text-zinc-400 w-full sm:w-auto" />
            <button @click="generateAiPhoto" :disabled="!!aiBusy" class="shrink-0 inline-flex items-center justify-center gap-1 bg-[#ff2a2a]/15 border border-[#ff2a2a]/40 text-[#ff2a2a] hover:bg-[#ff2a2a]/25 text-xs font-bold px-3 py-2.5 rounded-xl transition-all disabled:opacity-50">✨ Photo IA</button>
            <button @click="generateAiCarousel" :disabled="!!aiBusy" class="shrink-0 inline-flex items-center justify-center gap-1 bg-[#ff2a2a]/15 border border-[#ff2a2a]/40 text-[#ff2a2a] hover:bg-[#ff2a2a]/25 text-xs font-bold px-3 py-2.5 rounded-xl transition-all disabled:opacity-50">✨ 3 photos</button>
          </div>
          <p v-if="aiBusy" class="text-[11px] text-zinc-400 font-mono">{{ aiBusy }}</p>
        </div>

        <div v-if="draft.imageUrl" class="rounded-xl overflow-hidden border border-zinc-800">
          <img :src="draft.imageUrl" alt="Aperçu" class="w-full h-40 object-cover" />
        </div>

        <!-- Galerie multi-upload -->
        <div class="space-y-2">
          <label class="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Galerie (upload multiple)</label>
          <div class="flex flex-wrap gap-2">
            <input type="file" ref="galleryInput" accept="image/*" multiple @change="handleGalleryFile" class="text-[11px] text-zinc-400" />
          </div>
          <div class="flex gap-2">
            <input v-model="newGalleryUrl" @keyup.enter="addGalleryUrl" class="flex-1 bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:border-[#ff2a2a]/60 focus:outline-none" placeholder="ou URL image/vidéo..." />
            <button @click="addGalleryUrl" class="shrink-0 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold px-3 py-2.5 rounded-xl transition-all">+</button>
          </div>
          <div v-if="draft.gallery.length" class="flex flex-wrap gap-2">
            <div v-for="(u, i) in draft.gallery" :key="i" class="relative group">
              <img :src="u" :alt="`galerie ${i + 1}`" class="w-16 h-16 rounded-lg object-cover border border-zinc-700" @error="($event.target as HTMLImageElement).style.display='none'" />
              <button @click="draft.gallery.splice(i, 1)" class="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-600 text-white text-[10px] flex items-center justify-center shadow">✕</button>
            </div>
          </div>
        </div>

        <!-- Vidéo -->
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <label class="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Vidéo publique (URL)</label>
            <button @click="generateAiVideo" :disabled="!!aiBusy" class="inline-flex items-center gap-1 bg-[#ff2a2a]/15 border border-[#ff2a2a]/40 text-[#ff2a2a] hover:bg-[#ff2a2a]/25 text-xs font-bold px-3 py-2 rounded-xl transition-all disabled:opacity-50">🎬 Vidéo IA</button>
          </div>
          <input v-model="draft.videoUrl" class="w-full bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:border-[#ff2a2a]/60 focus:outline-none" placeholder="/api/vid/... ou https://..." />
        </div>

        <!-- En vitrine : image ou video -->
        <div class="space-y-2">
          <label class="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Affiché en vitrine (page client)</label>
          <div class="flex gap-2">
            <button type="button" @click="draft.featuredMedia = 'image'"
              class="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border text-xs font-bold font-mono transition-all"
              :class="draft.featuredMedia === 'image'
                ? 'bg-[#ff2a2a]/15 border-[#ff2a2a]/50 text-[#ff2a2a]'
                : 'bg-black/40 border-zinc-800 text-zinc-400 hover:border-zinc-600'">
              🖼️ Image
            </button>
            <button type="button" @click="draft.featuredMedia = 'video'" :disabled="!draft.videoUrl"
              class="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border text-xs font-bold font-mono transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              :class="draft.featuredMedia === 'video'
                ? 'bg-[#ff2a2a]/15 border-[#ff2a2a]/50 text-[#ff2a2a]'
                : 'bg-black/40 border-zinc-800 text-zinc-400 hover:border-zinc-600'">
              🎬 Vidéo
            </button>
          </div>
          <p class="text-[9px] text-zinc-600 font-mono">
            {{ draft.videoUrl
              ? 'La vidéo joue automatiquement en boucle, muette, sur la page d\'accueil.'
              : 'Ajoutez une vidéo pour pouvoir l\'afficher en vitrine (sinon l\'image principale est utilisée).' }}
          </p>
        </div>

        <!-- Argumentaire + refine -->
        <div class="space-y-2">
          <div class="flex items-center justify-between gap-2">
            <label class="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Argumentaire de vente</label>
            <div class="flex items-center gap-1.5">
              <button type="button" @click="blocksModeDesc = !blocksModeDesc"
                class="inline-flex items-center gap-1 bg-zinc-800/60 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-[10px] font-bold px-2 py-1 rounded-lg transition-all"
                :title="blocksModeDesc ? 'Basculer en éditeur texte simple' : 'Basculer en éditeur par blocs (drag & drop)'">
                {{ blocksModeDesc ? '🔀 Blocs' : '🔀 Simple' }}
              </button>
              <button @click="refine('description')" :disabled="!!aiBusy" class="inline-flex items-center gap-1 bg-zinc-800/60 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-[10px] font-bold px-2 py-1 rounded-lg transition-all disabled:opacity-50">✨ Optimiser IA</button>
            </div>
          </div>
          <RichBlocksEditor v-if="blocksModeDesc" v-model="draft.description" />
          <RichEditor v-else v-model="draft.description" />
        </div>

        <!-- Fiche technique + IA -->
        <div class="space-y-2">
          <div class="flex items-center justify-between gap-2">
            <label class="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Fiche technique</label>
            <div class="flex items-center gap-1.5">
              <button type="button" @click="blocksModeTech = !blocksModeTech"
                class="inline-flex items-center gap-1 bg-zinc-800/60 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-[10px] font-bold px-2 py-1 rounded-lg transition-all"
                :title="blocksModeTech ? 'Basculer en éditeur texte simple' : 'Basculer en éditeur par blocs (drag & drop)'">
                {{ blocksModeTech ? '🔀 Blocs' : '🔀 Simple' }}
              </button>
              <button @click="refine('technical')" :disabled="!!aiBusy" class="inline-flex items-center gap-1 bg-zinc-800/60 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-[10px] font-bold px-2 py-1 rounded-lg transition-all disabled:opacity-50">✨ Optimiser IA</button>
            </div>
          </div>
          <RichBlocksEditor v-if="blocksModeTech" v-model="draft.originalDescription" />
          <RichEditor v-else v-model="draft.originalDescription" />
        </div>

        <!-- Chinois desc + points -->
        <div class="space-y-2">
          <label class="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Description chinoise</label>
          <textarea v-model="draft.chineseDescription" rows="3" class="w-full bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:border-[#ff2a2a]/60 focus:outline-none font-mono" placeholder="中文描述..." />
        </div>

        <div class="space-y-2">
          <label class="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Fiche technique (points)</label>
          <div class="flex gap-2">
            <input v-model="featureInput" @keyup.enter="addFeature" class="flex-1 bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:border-[#ff2a2a]/60 focus:outline-none" placeholder="Ex: LED RGB personnalisables" />
            <button @click="addFeature" class="shrink-0 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold px-3 py-2.5 rounded-xl transition-all">+</button>
          </div>
          <ul v-if="draft.features.length" class="space-y-1.5">
            <li v-for="(f, i) in draft.features" :key="i" class="flex items-start gap-2 text-xs text-zinc-300">
              <span class="text-[#ff2a2a] font-bold mt-0.5">▪</span>
              <span class="flex-1">{{ f }}</span>
              <button @click="draft.features.splice(i, 1)" class="text-red-400 hover:text-red-300 text-[10px]">✕</button>
            </li>
          </ul>
        </div>
      </div>

      <!-- Footer -->
      <div class="border-t border-zinc-800 bg-[#0d0d14] px-5 py-4 flex items-center justify-between gap-3 shrink-0">
        <button v-if="!isNew" @click="remove"
          class="text-[11px] font-mono text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-500/60 px-3 py-2.5 rounded-xl transition-all">Supprimer</button>
        <div v-else class="flex-1" />
        <div class="flex items-center gap-2">
          <button @click="emit('close')" class="text-[11px] font-mono text-zinc-400 hover:text-white border border-zinc-800 px-3 py-2.5 rounded-xl transition-all">Annuler</button>
          <button @click="save" :disabled="saving"
            class="bg-[#ff2a2a] hover:bg-red-600 text-white text-xs font-bold font-mono px-4 py-2.5 rounded-xl transition-all disabled:opacity-50">{{ saving ? 'Sauvegarde…' : '💾 Enregistrer' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>