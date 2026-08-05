<script setup lang="ts">
import type { Product } from '~/types'
import { formatPriceXof, buildWaMessage } from '~/composables/useCatalog'
import { useAuthStore } from '~/stores/auth'
import { useTrack } from '~/composables/useTrack'

const route = useRoute()
const config = useRuntimeConfig()
const auth = useAuthStore()
const { viewProduct, clickPreorder } = useTrack()
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

onMounted(() => {
  window.addEventListener('focus', onVisible)
  document.addEventListener('visibilitychange', onVisible)
})

onUnmounted(() => {
  window.removeEventListener('focus', onVisible)
  document.removeEventListener('visibilitychange', onVisible)
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
    script: [{ type: 'application/ld+json', children: JSON.stringify(jsonLd) }],
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

const waUrl = computed(() => {
  const p = product.value
  if (!p) return ''
  const priceStr = formatPriceXof(p.priceXof)
  const pageUrl = `${config.public.siteUrl}/p/${p.id}.html`
  const msg = buildWaMessage(p, priceStr, pageUrl)
  const num = p.waNumber || config.public.phoneNumber
  return 'https://wa.me/' + num + '?text=' + encodeURIComponent(msg)
})

function trackClick() {
  try {
    fetch('/api/products/' + encodeURIComponent(product.value!.id) + '/clicks', { method: 'POST', keepalive: true })
  } catch {}
}

// Record the visit as a user event (drives the client space "Vues" stat).
onMounted(() => {
  if (import.meta.client && product.value) {
    viewProduct({ id: product.value.id, title: product.value.title })
  }
})

// Preorder: fire the click event + create a pending order linked to the
// account (deduped), then open WhatsApp. Fire-and-forget so the tab opens fast.
function preorder() {
  const url = waUrl.value
  if (!url) return
  auth.requireAuth(() => {
    trackClick()
    const p = product.value!
    clickPreorder({ id: p.id, title: p.title })
    fetch('/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.token}`,
      },
      body: JSON.stringify({
        productId: p.id,
        productTitle: p.title,
        productImage: p.imageUrl,
        customerName: auth.user?.name || auth.user?.pseudo || 'Client WhatsApp',
        customerPhone: auth.user?.phone || '',
        customerLocation: auth.user?.country || '—',
        quantity: 1,
        priceXof: p.priceXof,
        priceEur: p.priceEur,
      }),
    }).catch(() => {})
    window.open(url, '_blank', 'noopener,noreferrer')
  }, 'Connectez-vous pour précommander ce drop')
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
            class="w-full h-full object-cover"
          />
          <video
            v-else-if="m.type === 'video' && i === current"
            :src="m.src"
            controls
            playsinline
            preload="metadata"
            class="w-full h-full object-cover bg-black"
          />
        </template>
        <template v-if="media.length > 1">
          <button @click="current = (current - 1 + media.length) % media.length"
            class="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-[#ff2a2a]/80 text-white w-8 h-8 rounded-full text-lg font-black leading-none border border-white/20 transition-colors z-10">‹</button>
          <button @click="current = (current + 1) % media.length"
            class="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-[#ff2a2a]/80 text-white w-8 h-8 rounded-full text-lg font-black leading-none border border-white/20 transition-colors z-10">›</button>
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
          <span class="inline-block bg-[#ff2a2a]/10 text-[#ff2a2a] text-[10px] font-bold tracking-widest uppercase px-2.5 py-0.5 rounded border border-[#ff2a2a]/25 mb-2">
            {{ product.category }}
          </span>
          <h1 class="text-xl sm:text-2xl font-extrabold text-slate-100 leading-snug">{{ product.title }}</h1>
        </div>

        <div class="bg-gradient-to-r from-[#ff2a2a]/10 to-transparent p-3 rounded-xl border-l-4 border-[#ff2a2a]">
          <p class="text-[8px] text-zinc-400 uppercase font-mono font-bold tracking-widest">PRIX DE VENTE SPECIAL</p>
          <p class="text-2xl font-extrabold text-[#ff2a2a] font-mono">{{ formatPriceXof(product.priceXof) }}</p>
        </div>

        <div class="space-y-2">
          <p class="text-[9px] text-[#ff2a2a] font-mono uppercase font-bold tracking-wider">DESCRIPTION & SPECIFICATIONS</p>
          <div class="text-xs text-zinc-300 leading-relaxed bg-black/40 p-4 rounded-lg border border-zinc-900 [&_p]:mb-2 [&_h3]:text-slate-100 [&_h3]:font-bold [&_h3]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-1" v-html="descriptionHtml" />
        </div>

        <button @click="preorder"
          class="block w-full text-center bg-[#ff2a2a] hover:bg-red-600 text-white font-bold text-sm px-4 py-3 rounded-xl transition-all font-mono cursor-pointer">
          PRÉCOMMANDER SUR WHATSAPP
        </button>

        <ProductActions :product="product" />

        <div v-if="techHtml" class="space-y-2">
          <p class="text-[9px] text-[#ff2a2a] font-mono uppercase font-bold tracking-wider">FICHE TECHNIQUE</p>
          <div class="text-xs text-zinc-400 leading-relaxed bg-black/30 p-4 rounded-lg border border-zinc-900 [&_p]:mb-2 [&_h3]:text-slate-100 [&_h3]:font-bold [&_h3]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-1" v-html="techHtml" />
        </div>

        <div id="commentaires" class="border-t border-zinc-800 pt-5 scroll-mt-20">
          <ProductComments :product-id="product.id" />
        </div>
      </div>
    </div>
  </div>
</template>
