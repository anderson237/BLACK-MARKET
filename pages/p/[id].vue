<script setup lang="ts">
import type { Product } from '~/types'
import { promoPercent, promoPrice, promoCountdown, hasPromo } from '~/composables/useCatalog'
import { useAuthStore } from '~/stores/auth'
import { useTrack } from '~/composables/useTrack'
import { useCurrency } from '~/composables/useCurrency'
import { useCartStore } from '~/stores/cart'

const route = useRoute()
const config = useRuntimeConfig()
const auth = useAuthStore()
const cart = useCartStore()
const { viewProduct } = useTrack()
const { code, format } = useCurrency()
const productId = computed(() => String(route.params.id || '').replace(/\.html$/i, ''))

const { data: product, error, refresh } = await useAsyncData<Product | null>(
  `product-${productId.value}`,
  () => fetchProduct(productId.value),
  { dedupe: 'cancel' },
)

// Live product data: re-fetch when the tab regains focus so admin edits
// (title/price/stock/archive) appear on the storefront without a manual reload.
function onVisible() {
  if (document.visibilityState !== 'visible') return
  refresh().then(() => {
    if (!product.value && !error.value) navigateTo('/')
  })
}

let productPoll: ReturnType<typeof setInterval> | null = null

// Site-wide real-time: the instant the admin edits/archives/restores a product
// (SSE push), re-fetch this product page so the change appears immediately.
function onSiteEvent(e: Event) {
  const detail = (e as CustomEvent).detail
  if (detail?.kind === 'catalog') {
    refresh().then(() => {
      if (!product.value && !error.value) navigateTo('/')
    })
  }
}

onMounted(() => {
  window.addEventListener('focus', onVisible)
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('bm:site', onSiteEvent)
  // Fallback poll: Netlify's in-memory pub/sub is per-instance, so an SSE push
  // can be missed. A quiet 60s refresh keeps the page in sync anyway.
  productPoll = setInterval(() => onVisible(), 60_000)
})

onUnmounted(() => {
  window.removeEventListener('focus', onVisible)
  document.removeEventListener('visibilitychange', onVisible)
  window.removeEventListener('bm:site', onSiteEvent)
  if (productPoll) clearInterval(productPoll)
})

useHead(() => {
  const p = product.value
  if (!p) return { title: 'Produit introuvable' }
  const pageUrl = `${config.public.siteUrl}/p/${p.id}.html`
  const urlDesc = String(p.description || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180)
  const img = p.imageUrl || `${config.public.siteUrl}/img/${p.id}.jpg`
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.title,
    description: urlDesc,
    image: [img, ...(p.gallery || [])].filter(Boolean),
    category: p.category,
    offers: {
      '@type': 'Offer',
      priceCurrency: p.currency || 'XOF',
      price: p.priceXof ? String(p.priceXof) : undefined,
      availability: 'https://schema.org/PreOrder',
      seller: { '@type': 'Organization', name: 'BLACK MARKET' },
      url: pageUrl,
    },
  }
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Catalogue BLACK MARKET', item: `${config.public.siteUrl}/` },
      { '@type': 'ListItem', position: 2, name: p.title, item: pageUrl },
    ],
  }
  return {
    title: `${p.title} — BLACK MARKET`,
    meta: [
      { name: 'description', content: urlDesc },
      { name: 'robots', content: 'index, follow, max-image-preview:large' },
      { property: 'og:title', content: p.title },
      { property: 'og:description', content: urlDesc },
      { property: 'og:type', content: 'product' },
      { property: 'og:image', content: img },
      { property: 'og:url', content: pageUrl },
      { property: 'og:site_name', content: 'BLACK MARKET' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: p.title },
      { name: 'twitter:image', content: img },
    ],
    link: [{ rel: 'canonical', href: pageUrl }],
    script: [
      { type: 'application/ld+json', children: JSON.stringify(jsonLd) },
      { type: 'application/ld+json', children: JSON.stringify(breadcrumb) },
    ],
  }
})

if (error.value || product.value === null) {
  throw createError({ statusCode: 404, statusMessage: 'Produit introuvable', fatal: true })
}

// Build media carousel: main image + gallery + optional video.
const media = computed<{ type: 'image' | 'video'; src: string }[]>(() => {
  if (!product.value) return []
  const list: { type: 'image' | 'video'; src: string }[] = [{ type: 'image', src: product.value.imageUrl || '' }]
  ;(product.value.gallery || []).forEach((u) => {
    if (u) list.push({ type: 'image', src: u })
  })
  if (product.value.videoUrl) list.push({ type: 'video', src: product.value.videoUrl })
  return list
})

const current = ref(0)

// ---- Promo : réduction, prix barré et compte à rebours ----
const pct = computed(() => promoPercent(product.value || {}))
const discountPrice = computed(() => promoPrice(product.value || {}))
const countdown = ref(promoCountdown(product.value?.discountEndsAt))
let cdTimer: ReturnType<typeof setInterval> | undefined
function startCountdown() {
  if (!product.value || !hasPromo(product.value)) return
  countdown.value = promoCountdown(product.value.discountEndsAt)
  if (!countdown.value) return
  cdTimer = setInterval(() => {
    countdown.value = promoCountdown(product.value?.discountEndsAt)
    if (!countdown.value && cdTimer) clearInterval(cdTimer)
  }, 1000)
}
watch(() => product.value?.discountEndsAt, startCountdown)
onMounted(() => startCountdown())
onBeforeUnmount(() => cdTimer && clearInterval(cdTimer))

// Record the visit as a user event (drives the client space "Vues" stat).
onMounted(() => {
  if (import.meta.client && product.value) {
    viewProduct({ id: product.value.id, title: product.value.title })
  }
})

// Preorder: adds the product to the basket (server-persisted). WhatsApp only
// opens when the client confirms the preorder from their dashboard.
const isStock = computed(() => product.value?.stockStatus === 'in_stock')
function preorder() {
  const p = product.value
  if (!p) return
  cart.add({
    productId: p.id,
    title: p.title,
    imageUrl: p.imageUrl,
    priceXof: promoPrice(p),
    priceEur: p.priceEur,
    quantity: Math.max(1, Number(p.moq) || 1),
  })
}

// Rich content: descriptions are AI-generated HTML -> render sanitized.
const descriptionHtml = computed(() => sanitizeHtml(product.value?.description || ''))
const techHtml = computed(() => sanitizeHtml(product.value?.originalDescription || ''))
</script>

<template>
  <div class="max-w-[1200px] mx-auto px-4 py-8" v-if="product">
    <!-- Breadcrumb -->
    <NuxtLink to="/" class="inline-flex items-center gap-1 text-[10px] font-mono text-zinc-400 hover:text-[#ff2a2a] border border-zinc-800 px-3 py-1.5 rounded-lg mb-6 transition-all">
      ← TOUT LE CATALOGUE
    </NuxtLink>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
      <!-- Carousel -->
      <div class="relative aspect-square rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-800" v-if="media.length">
        <template v-for="(m, i) in media" :key="i">
          <img
            v-if="m.type === 'image' && i === current"
            :src="m.src"
            :alt="product.title"
            :loading="i === 0 ? 'eager' : 'lazy'"
            :fetchpriority="i === 0 ? 'high' : undefined"
            decoding="async"
            class="w-full h-full object-cover"
          />
          <video
            v-else-if="m.type === 'video' && i === current"
            :src="m.src"
            controls
            playsinline
            preload="metadata"
            :poster="media[0]?.src || undefined"
            class="w-full h-full object-cover bg-black"
          />
        </template>
        <template v-if="media.length > 1">
          <button @click="current = (current - 1 + media.length) % media.length"
            class="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-[#ff2a2a]/80 text-white w-10 h-10 rounded-full text-lg font-black leading-none border border-white/20 transition-colors z-10">‹</button>
          <button @click="current = (current + 1) % media.length"
            class="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-[#ff2a2a]/80 text-white w-10 h-10 rounded-full text-lg font-black leading-none border border-white/20 transition-colors z-10">›</button>
          <div class="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5 z-10">
            <span v-for="(_, i) in media" :key="i"
              class="w-1.5 h-1.5 rounded-full transition-colors"
              :class="i === current ? 'bg-[#ff2a2a]' : 'bg-white/40'" />
          </div>
        </template>
      </div>

      <!-- Info -->
      <div class="space-y-5">
        <div>
          <div class="flex items-center flex-wrap gap-2 mb-2">
            <span class="inline-block bg-[#ff2a2a]/10 text-[#ff2a2a] text-[10px] font-bold tracking-widest uppercase px-2.5 py-0.5 rounded border border-[#ff2a2a]/25">
              {{ product.category }}
            </span>
            <span
              v-if="isStock"
              class="inline-block bg-emerald-500/15 text-emerald-400 text-[10px] font-bold tracking-widest uppercase px-2.5 py-0.5 rounded border border-emerald-500/40"
            >
              ✓ EN STOCK
            </span>
            <span
              v-else
              class="inline-block bg-amber-500/15 text-amber-400 text-[10px] font-bold tracking-widest uppercase px-2.5 py-0.5 rounded border border-amber-500/40"
            >
              📦 PRÉCOMMANDE
            </span>
          </div>
          <h1 class="text-xl sm:text-2xl font-extrabold text-slate-100 leading-snug">{{ product.title }}</h1>
        </div>

        <div class="bg-gradient-to-r from-[#ff2a2a]/10 to-transparent p-3 rounded-xl border-l-4 border-[#ff2a2a]">
          <div class="flex items-center gap-2 mb-1">
            <p class="text-[8px] text-zinc-400 uppercase font-mono font-bold tracking-widest">PRIX DE VENTE SPECIAL</p>
            <span v-if="pct > 0" class="bg-[#ff2a2a] text-white text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse">−{{ pct }}%</span>
          </div>
          <template v-if="pct > 0">
            <span class="text-sm text-zinc-500 font-mono line-through mr-2">{{ format(product.priceXof) }}</span>
            <span class="text-3xl font-extrabold text-[#ff2a2a] font-mono">{{ format(discountPrice) }}</span>
          </template>
          <p v-else class="text-2xl font-extrabold text-[#ff2a2a] font-mono">{{ format(product.priceXof) }}</p>
          <div v-if="pct > 0 && countdown" class="mt-2 inline-flex items-center gap-2 bg-black/50 border border-amber-500/40 text-amber-300 text-[11px] font-mono font-bold px-3 py-1.5 rounded-lg">
            <span class="relative flex h-2 w-2">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-60" />
              <span class="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
            </span>
            La promo se termine dans {{ countdown }}
          </div>
        </div>

        <div v-if="Number(product.moq) > 0 || Number(product.stockQuantity) > 0" class="flex flex-wrap gap-2">
          <span v-if="Number(product.moq) > 0" class="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-200 bg-black/40 border border-zinc-800 rounded-lg px-3 py-1.5">
            <AppIcon name="tag" :size="13" class="text-[#ff2a2a]" /> MOQ : {{ product.moq }} unité(s) minimum
          </span>
          <span v-if="Number(product.stockQuantity) > 0" class="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-1.5">
            <AppIcon name="box" :size="13" /> {{ product.stockQuantity }} unité(s) en stock
          </span>
        </div>

        <div class="space-y-2">
          <p class="text-[9px] text-[#ff2a2a] font-mono uppercase font-bold tracking-wider">DESCRIPTION & SPECIFICATIONS</p>
          <div class="text-xs text-zinc-300 leading-relaxed bg-black/40 p-4 rounded-lg border border-zinc-900 break-words [overflow-wrap:anywhere] [&_p]:mb-2 [&_h3]:text-slate-100 [&_h3]:font-bold [&_h3]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-1" v-html="descriptionHtml" />
        </div>

        <button @click="preorder"
          class="block w-full text-center bg-[#ff2a2a] hover:bg-red-600 text-white font-bold text-sm px-4 py-3 rounded-xl transition-all font-mono cursor-pointer">
          {{ isStock ? '🛒 AJOUTER AU PANIER' : '🛒 AJOUTER AUX PRÉCOMMANDES' }}
        </button>

        <ProductActions :product="product" />

        <div v-if="techHtml" class="space-y-2">
          <p class="text-[9px] text-[#ff2a2a] font-mono uppercase font-bold tracking-wider">FICHE TECHNIQUE</p>
          <div class="text-xs text-zinc-400 leading-relaxed bg-black/30 p-4 rounded-lg border border-zinc-900 break-words [overflow-wrap:anywhere] [&_p]:mb-2 [&_h3]:text-slate-100 [&_h3]:font-bold [&_h3]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-1" v-html="techHtml" />
        </div>

        <div id="commentaires" class="border-t border-zinc-800 pt-5 scroll-mt-20">
          <ProductComments :product-id="product.id" />
        </div>
      </div>
    </div>
  </div>
</template>
