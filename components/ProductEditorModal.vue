<script setup lang="ts">
import type { Product } from '~/types'
import { formatPriceXof, promoPrice, promoCountdown, saleBasePrice } from '~/composables/useCatalog'

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
  discountPercent: props.product?.discountPercent || 0,
  discountEndsAt: props.product?.discountEndsAt || '',
  imageUrl: props.product?.imageUrl || '',
  gallery: [...(props.product?.gallery || [])],
  videoUrl: props.product?.videoUrl || '',
  featuredMedia: props.product?.featuredMedia || (props.product?.videoUrl ? 'video' : 'image'),
  category: props.product?.category || 'Techwear',
  whatsappClicks: props.product?.whatsappClicks || 0,
  waNumber: props.product?.waNumber || '',
  sourceRmb: props.product?.sourceRmb || undefined,
  purchaseRmb: props.product?.purchaseRmb || 0,
  shippingRmb: props.product?.shippingRmb || 0,
  marginPercent: props.product?.marginPercent || 0,
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

// ---- Prix : achat fournisseur + transport + marge -> prix de vente ----
const rmbToXofRate = computed(() => Number(config.public.rmbToXofRate) || 82)
const xofToEurRate = computed(() => Number(config.public.xofToEurRate) || 655.957)

function computeSellingXof(): number {
  const purchase = Number(draft.purchaseRmb) || 0
  const shipping = Number(draft.shippingRmb) || 0
  const margin = Number(draft.marginPercent) || 0
  const totalRmb = purchase + shipping
  if (totalRmb <= 0) return 0
  const raw = totalRmb * (1 + margin / 100) * rmbToXofRate.value
  return Math.max(0, Math.round(raw / 100) * 100)
}

const sellingXof = computed(() => computeSellingXof())
const sellingEur = computed(() => (sellingXof.value > 0 ? Math.round(sellingXof.value / xofToEurRate.value) : 0))

function applySellingPrice() {
  if (Number(draft.purchaseRmb) > 0 || draft.shippingRmb > 0 || Number(draft.marginPercent) > 0) {
    draft.priceXof = sellingXof.value
    draft.priceEur = sellingEur.value
  }
}
watch([() => draft.purchaseRmb, () => draft.shippingRmb, () => draft.marginPercent], applySellingPrice)

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
      purchaseRmb: Number(draft.purchaseRmb) || 0,
      shippingRmb: Number(draft.shippingRmb) || 0,
      marginPercent: Number(draft.marginPercent) || 0,
      stockStatus: draft.stockStatus || 'preorder',
      stockQuantity: Math.max(0, Number(draft.stockQuantity) || 0),
      moq: Math.max(0, Number(draft.moq) || 0),
featuredMedia: draft.videoUrl ? draft.featuredMedia || 'video' : 'image',
      discountPercent: Math.min(100, Math.max(0, Number(draft.discountPercent) || 0)),
      discountEndsAt: draft.discountEndsAt || undefined,
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

/** Refresh the title, argumentaire or fiche technique via /api/ai-refine (Gemini). */
async function refine(field: 'title' | 'description' | 'technical') {
  aiBusy.value = `Génération ${field === 'title' ? 'du titre' : field === 'description' ? "de l'argumentaire" : 'de la fiche technique'} par l'IA…`
  error.value = ''
  try {
    const { html, text } = await apiPost('/api/ai-refine', {
      field,
      title: draft.title,
      category: draft.category,
      currentText: field === 'title' ? draft.title : field === 'description' ? draft.description : draft.originalDescription,
    })
    if (field === 'title') draft.title = text || draft.title
    else if (field === 'description') draft.description = html
    else draft.originalDescription = html
    aiAction.value = field === 'title' ? 'Titre généré par l\'IA ✓' : field === 'description' ? "Argumentaire optimisé par l'IA ✓" : 'Fiche technique optimisée par l\'IA ✓'
  } catch (e: any) {
    error.value = e?.message || 'Erreur IA.'
  } finally {
    aiBusy.value = ''
  }
}

// ---- Dictée vocale (Web Speech API) ----
// L'admin dicte le titre, l'argumentaire ou la fiche technique et le texte
// apparaît en direct dans l'éditeur (puis peut être optimisé par l'IA).
type DictationField = 'title' | 'description' | 'technical'
let recognition: any = null
const dictating = ref<DictationField | ''>('')
const interimText = ref('')

function dictationSupported(): boolean {
  if (!import.meta.client) return false
  const w = window as any
  return !!(w.SpeechRecognition || w.webkitSpeechRecognition)
}

function appendDictated(field: DictationField, text: string) {
  const clean = String(text).trim()
  if (!clean) return
  if (field === 'title') {
    draft.title = (draft.title ? draft.title.trimEnd() + ' ' : '') + clean
  } else {
    const para = `<p>${clean.replace(/\n+/g, ' ')}</p>`
    const current = field === 'description' ? draft.description : draft.originalDescription
    const next = current ? `${current.replace(/<p>\s*<\/p>$/i, '')} ${para}` : para
    if (field === 'description') draft.description = next
    else draft.originalDescription = next
  }
}

function stopDictation() {
  if (recognition) {
    try { recognition.stop() } catch {}
    recognition = null
  }
  dictating.value = ''
  interimText.value = ''
}

function startDictation(field: DictationField) {
  if (!import.meta.client) return
  const w = window as any
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition
  if (!Ctor) {
    error.value = 'La dictée vocale n\'est pas supportée par ce navigateur. Utilisez Chrome ou Edge.'
    return
  }
  if (dictating.value) stopDictation()
  try {
    recognition = new Ctor()
    recognition.lang = 'fr-FR'
    recognition.continuous = true
    recognition.interimResults = true
    dictating.value = field
    interimText.value = ''
    recognition.onresult = (e: any) => {
      let interim = ''
      let final = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]
        const t = res[0].transcript
        if (res.isFinal) final += t
        else interim += t
      }
      if (final) appendDictated(field, final)
      interimText.value = interim
    }
    recognition.onerror = (e: any) => {
      if (e?.error === 'not-allowed' || e?.error === 'service-not-allowed') {
        error.value = 'Accès au microphone refusé. Autorisez le micro dans le navigateur.'
      }
      interimText.value = ''
      dictating.value = ''
    }
    recognition.onend = () => {
      dictating.value = ''
      interimText.value = ''
    }
    recognition.start()
  } catch {
    error.value = 'Impossible de démarrer la dictée vocale.'
  }
}

onUnmounted(() => stopDictation())

// ---- Filigrane canvas: bake "DEEP ROOTS © 2026" onto any image ----
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
  for (let d = -targetH; d < targetH * 2; d += spacing) ctx.fillText('DEEP ROOTS © 2026', 0, d)
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

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Lecture du fichier impossible.'))
    reader.readAsDataURL(file)
  })
}

const MAX_VIDEO_MB = 60

// ---- Upload avec filigrane ----
async function handleMainFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  aiBusy.value = 'Application du filigrane DEEP ROOTS…'
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

async function handleVideoFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
    error.value = `Vidéo trop volumineuse (max ${MAX_VIDEO_MB} Mo).`
    return
  }
  aiBusy.value = 'Upload de la vidéo…'
  error.value = ''
  try {
    const dataUrl = await readFileAsDataUrl(file)
    const json = await apiPost('/api/upload-video', { videoBase64: dataUrl })
    draft.videoUrl = json.url
    draft.featuredMedia = 'video'
  } catch (err: any) {
    error.value = err?.message || 'Erreur upload vidéo.'
  } finally {
    aiBusy.value = ''
    ;(e.target as HTMLInputElement).value = ''
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
            <div class="flex items-center gap-2">
              <input v-model="draft.title" class="flex-1 min-w-0 bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:border-[#ff2a2a]/60 focus:outline-none" placeholder="Nom du produit" />
              <button type="button" @click="refine('title')" :disabled="!!aiBusy"
                class="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-xl border bg-zinc-800/60 hover:bg-zinc-700 border-zinc-700 text-zinc-300 hover:text-[#ff2a2a] text-xs font-bold transition-all disabled:opacity-50"
                title="Générer le titre par IA" aria-label="Générer le titre par IA">✨</button>
              <button type="button" @click="dictating === 'title' ? stopDictation() : startDictation('title')" :disabled="!!aiBusy"
                class="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-xl border transition-all disabled:opacity-50"
                :class="dictating === 'title'
                  ? 'bg-red-600/20 border-red-500/60 text-red-400 animate-pulse'
                  : 'bg-black/40 border-zinc-800 text-zinc-300 hover:border-[#ff2a2a]/50 hover:text-[#ff2a2a]'"
                :title="dictating === 'title' ? 'Arrêter la dictée' : 'Dicter le titre (voix)'" :aria-label="dictating === 'title' ? 'Arrêter la dictée' : 'Dicter le titre'">
                <AppIcon :name="dictating === 'title' ? 'micOff' : 'mic'" :size="15" />
              </button>
            </div>
            <p v-if="dictating === 'title'" class="flex items-center gap-1.5 text-[10px] text-red-400 font-mono animate-pulse">
              <span class="w-1.5 h-1.5 rounded-full bg-red-500" /> En train de dicter le titre… {{ interimText ? `« ${interimText} »` : '' }}
            </p>
          </div>
          <div class="space-y-2">
            <label class="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Grossiste 中文 (chinois)</label>
            <input v-model="draft.chineseTitle" class="w-full bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:border-[#ff2a2a]/60 focus:outline-none" placeholder="Titre du grossiste chinois" />
          </div>
        </div>

        <!-- Catégorie -->
        <div class="space-y-2">
          <label class="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Catégorie</label>
          <select v-model="draft.category" class="w-full bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:border-[#ff2a2a]/60 focus:outline-none">
            <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>

        <!-- Prix & marge -->
        <div class="space-y-2">
          <label class="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Prix & marge</label>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div class="space-y-2">
              <label class="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Prix d'achat fournisseur (¥)</label>
              <input v-model.number="draft.purchaseRmb" type="number" min="0" class="w-full bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:border-[#ff2a2a]/60 focus:outline-none" placeholder="200" />
            </div>
            <div class="space-y-2">
              <label class="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Transport (¥)</label>
              <input v-model.number="draft.shippingRmb" type="number" min="0" class="w-full bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:border-[#ff2a2a]/60 focus:outline-none" placeholder="30" />
            </div>
            <div class="space-y-2">
              <label class="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Bénéfice (%)</label>
              <input v-model.number="draft.marginPercent" type="number" min="0" class="w-full bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:border-[#ff2a2a]/60 focus:outline-none" placeholder="80" />
            </div>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div v-if="sellingXof > 0" class="space-y-2">
              <label class="text-[10px] text-emerald-400 font-mono uppercase tracking-widest">Prix de vente auto (F CFA)</label>
              <div class="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3 py-2.5 text-sm font-mono text-emerald-300">{{ sellingXof.toLocaleString('fr-FR') }} F CFA</div>
            </div>
            <div v-if="sellingEur > 0" class="space-y-2">
              <label class="text-[10px] text-emerald-400 font-mono uppercase tracking-widest">Prix de vente auto (€)</label>
              <div class="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3 py-2.5 text-sm font-mono text-emerald-300">{{ sellingEur }} €</div>
            </div>
          </div>
<p class="text-[9px] text-zinc-600 font-mono">Prix de vente = (achat + transport) × (1 + marge%) × taux {{ rmbToXofRate }}. Dès qu'un coût est renseigné, il remplace automatiquement le prix de vente enregistré.</p>
        </div>

        <!-- Promo & réduction -->
        <div class="space-y-3 border border-[#ff2a2a]/20 rounded-2xl p-3 bg-[#1a1020]">
          <div class="flex items-center justify-between">
            <label class="text-[10px] text-[#ff2a2a] font-mono uppercase tracking-widest">🎁 PROMO & RÉDUCTION</label>
            <span v-if="draft.discountPercent > 0" class="bg-[#ff2a2a]/15 text-[#ff2a2a] border border-[#ff2a2a]/30 text-[9px] font-mono font-bold px-2 py-0.5 rounded">-{{ draft.discountPercent }}%</span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="space-y-2">
              <label class="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Réduction (%)</label>
              <input v-model.number="draft.discountPercent" type="number" min="0" max="100" class="w-full bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:border-[#ff2a2a]/60 focus:outline-none" placeholder="0" />
            </div>
            <div class="space-y-2">
              <label class="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Fin de la promo</label>
              <input v-model="draft.discountEndsAt" type="datetime-local" class="w-full bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:border-[#ff2a2a]/60 focus:outline-none [color-scheme:dark]" />
            </div>
          </div>
          <p v-if="draft.discountPercent > 0" class="text-[10px] text-emerald-400 font-mono">
            Prix barré : {{ formatPriceXof(saleBasePrice(draft.priceXof)) }}
            <span class="text-zinc-400">→</span>
            <span class="text-emerald-300 font-bold">{{ formatPriceXof(promoPrice({ priceXof: draft.priceXof, discountPercent: draft.discountPercent, discountEndsAt: draft.discountEndsAt })) }}</span>
            <span v-if="draft.discountEndsAt" class="text-zinc-400"> · se termine dans {{ promoCountdown(draft.discountEndsAt) }}</span>
          </p>
          <p v-if="draft.discountPercent < 0 || draft.discountPercent > 100" class="text-[10px] text-red-400 font-mono">La réduction doit être comprise entre 0 et 100 %.</p>
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
            <input ref="fileInput" type="file" id="mainFileInput" accept="image/*" @change="handleMainFile" class="hidden" />
            <label for="mainFileInput"
              class="shrink-0 inline-flex items-center justify-center gap-1.5 bg-zinc-800/60 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-bold px-3 py-2.5 rounded-xl transition-all cursor-pointer">
              📷 <span>Uploader une photo</span>
            </label>
            <button type="button" @click="generateAiPhoto" :disabled="!!aiBusy" class="shrink-0 inline-flex items-center justify-center gap-1 bg-[#ff2a2a]/15 border border-[#ff2a2a]/40 text-[#ff2a2a] hover:bg-[#ff2a2a]/25 text-xs font-bold px-3 py-2.5 rounded-xl transition-all disabled:opacity-50">✨ Photo IA</button>
            <button type="button" @click="generateAiCarousel" :disabled="!!aiBusy" class="shrink-0 inline-flex items-center justify-center gap-1 bg-[#ff2a2a]/15 border border-[#ff2a2a]/40 text-[#ff2a2a] hover:bg-[#ff2a2a]/25 text-xs font-bold px-3 py-2.5 rounded-xl transition-all disabled:opacity-50">✨ 3 photos</button>
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
            <input ref="galleryInput" type="file" id="galleryFileInput" accept="image/*" multiple @change="handleGalleryFile" class="hidden" />
            <label for="galleryFileInput"
              class="inline-flex items-center justify-center gap-1.5 bg-zinc-800/60 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-bold px-3 py-2.5 rounded-xl transition-all cursor-pointer">
              🖼️ <span>Ajouter des photos</span>
            </label>
          </div>
          <input v-model="newGalleryUrl" @keyup.enter="addGalleryUrl" class="flex-1 bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:border-[#ff2a2a]/60 focus:outline-none" placeholder="ou URL image/vidéo... (Entrée pour ajouter)" />
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
          <div class="flex flex-wrap gap-2">
            <input type="file" id="videoFileInput" accept="video/*" @change="handleVideoFile" class="hidden" />
            <label for="videoFileInput" title="Uploader une vidéo MP4/WebM/MOV (max 60 Mo)"
              class="inline-flex items-center justify-center gap-1.5 bg-zinc-800/60 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-bold px-3 py-2.5 rounded-xl transition-all cursor-pointer">
              🎬 <span>Uploader la vidéo (max 60 Mo)</span>
            </label>
          </div>
          <p v-if="aiBusy" class="text-[11px] text-zinc-400 font-mono">{{ aiBusy }}</p>
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
              <button type="button" @click="dictating === 'description' ? stopDictation() : startDictation('description')" :disabled="!!aiBusy"
                class="inline-flex items-center gap-1 border px-2 py-1 rounded-lg text-[10px] font-bold transition-all disabled:opacity-50"
                :class="dictating === 'description'
                  ? 'bg-red-600/20 border-red-500/60 text-red-400 animate-pulse'
                  : 'bg-zinc-800/60 hover:bg-zinc-700 border-zinc-700 text-zinc-300 hover:text-[#ff2a2a]'"
                :title="dictating === 'description' ? 'Arrêter la dictée' : 'Dicter l\'argumentaire (voix)'">
                <AppIcon :name="dictating === 'description' ? 'micOff' : 'mic'" :size="12" /> {{ dictating === 'description' ? 'Stop' : 'Dicter' }}
              </button>
              <button @click="refine('description')" :disabled="!!aiBusy" class="inline-flex items-center gap-1 bg-zinc-800/60 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-[10px] font-bold px-2 py-1 rounded-lg transition-all disabled:opacity-50">✨ Optimiser IA</button>
            </div>
          </div>
          <p v-if="dictating === 'description'" class="flex items-center gap-1.5 text-[10px] text-red-400 font-mono animate-pulse">
            <span class="w-1.5 h-1.5 rounded-full bg-red-500" /> Dictée en cours… {{ interimText ? `« ${interimText} »` : '' }}
          </p>
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
              <button type="button" @click="dictating === 'technical' ? stopDictation() : startDictation('technical')" :disabled="!!aiBusy"
                class="inline-flex items-center gap-1 border px-2 py-1 rounded-lg text-[10px] font-bold transition-all disabled:opacity-50"
                :class="dictating === 'technical'
                  ? 'bg-red-600/20 border-red-500/60 text-red-400 animate-pulse'
                  : 'bg-zinc-800/60 hover:bg-zinc-700 border-zinc-700 text-zinc-300 hover:text-[#ff2a2a]'"
                :title="dictating === 'technical' ? 'Arrêter la dictée' : 'Dicter la fiche technique (voix)'">
                <AppIcon :name="dictating === 'technical' ? 'micOff' : 'mic'" :size="12" /> {{ dictating === 'technical' ? 'Stop' : 'Dicter' }}
              </button>
              <button @click="refine('technical')" :disabled="!!aiBusy" class="inline-flex items-center gap-1 bg-zinc-800/60 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-[10px] font-bold px-2 py-1 rounded-lg transition-all disabled:opacity-50">✨ Optimiser IA</button>
            </div>
          </div>
          <p v-if="dictating === 'technical'" class="flex items-center gap-1.5 text-[10px] text-red-400 font-mono animate-pulse">
            <span class="w-1.5 h-1.5 rounded-full bg-red-500" /> Dictée en cours… {{ interimText ? `« ${interimText} »` : '' }}
          </p>
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
