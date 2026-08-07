<script setup lang="ts">
import type { Product } from '~/types'
import { promoPercent, promoPrice, promoCountdown, hasPromo } from '~/composables/useCatalog'
import { useAuthStore } from '~/stores/auth'
import { useCurrency } from '~/composables/useCurrency'
import { useCartStore } from '~/stores/cart'
import { useInteractionsStore } from '~/stores/interactions'
import { useCommentsStore } from '~/stores/comments'

const props = defineProps<{ product: Product; index: number }>()
const config = useRuntimeConfig()
const auth = useAuthStore()
const cart = useCartStore()
const inter = useInteractionsStore()
const comments = useCommentsStore()
const { code, format } = useCurrency()

// Glowing cards: products the CURRENT visitor liked or commented keep their
// highlight after a reload (state is persisted in localStorage).
const isLiked = computed(() => inter.getLike(props.product.id).liked)
const isCommented = computed(() => comments.hasCommented(props.product.id))
const isGlowing = computed(() => isLiked.value || isCommented.value)

const pct = computed(() => promoPercent(props.product))
const discountPrice = computed(() => promoPrice(props.product))
const countdown = ref(promoCountdown(props.product.discountEndsAt))
let cdTimer: ReturnType<typeof setInterval> | undefined
function startCountdown() {
  if (!hasPromo(props.product)) return
  countdown.value = promoCountdown(props.product.discountEndsAt)
  if (!countdown.value) return
  cdTimer = setInterval(() => {
    countdown.value = promoCountdown(props.product.discountEndsAt)
    if (!countdown.value && cdTimer) clearInterval(cdTimer)
  }, 1000)
}
onMounted(startCountdown)
onBeforeUnmount(() => cdTimer && clearInterval(cdTimer))

// Pinterest-style: varied image heights create the staggered masonry offset.
const heights = [380, 260, 340, 240, 300, 420, 280, 360, 220, 320]
const imgHeight = computed(() => heights[props.index % heights.length] + 'px')

const url = computed(() => `/p/${props.product.id}.html`)

// Cards auto-play the product video (muted by default); a mute button lets the
// visitor re-enable sound. Photos/videos keep showing in the product carousel.
const videoMuted = ref(true)
function toggleMute() {
  videoMuted.value = !videoMuted.value
}

function preorder() {
  // Le bouton "PRÉCOMMANDER" ajoute le produit au panier. Le client confirme
  // (-> WhatsApp) depuis son espace client.
  const effectivePrice = promoPrice(props.product)
  cart.add({
    productId: props.product.id,
    title: props.product.title,
    imageUrl: props.product.imageUrl,
    priceXof: effectivePrice,
    quantity: Math.max(1, Number(props.product.moq) || 1),
  })
}

const isStock = computed(() => props.product.stockStatus === 'in_stock')
const ctaLabel = computed(() => (isStock.value ? 'COMMANDER' : 'PRÉCOMMANDER'))
const showFeaturedVideo = computed(() => props.product.featuredMedia === 'video' && !!props.product.videoUrl)

// Titles are truncated at 100 chars with "…" to keep the grid clean; the full
// title stays available on the product page itself.
const truncatedTitle = computed(() => {
  const t = String(props.product.title || '').trim()
  return t.length > 100 ? t.slice(0, 100).trimEnd() + '…' : t
})
</script>

<template>
  <div
    class="group rounded-2xl overflow-hidden border transition-all duration-300 cursor-pointer"
    :class="isGlowing
      ? 'bg-[#1c0f18] border-[#ff2a2a]/50 shadow-[0_0_24px_rgba(255,42,42,0.18)]'
      : 'bg-[#12121a] border-zinc-800 hover:border-[#ff2a2a]/40'"
  >
    <NuxtLink :to="url" class="block" :aria-label="product.title">
      <div class="relative overflow-hidden" :style="{ height: imgHeight }">
        <video
          v-if="showFeaturedVideo"
          :src="product.videoUrl"
          :muted="videoMuted"
          autoplay
          loop
          playsinline
          :poster="product.imageUrl || undefined"
          class="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-500"
        ></video>
        <img
          v-else
          :src="product.imageUrl || `/api/img/${encodeURIComponent(product.id)}.jpg`"
          :alt="product.title"
          loading="lazy"
          decoding="async"
          class="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-500"
        />
        <button
          v-if="showFeaturedVideo"
          @click.stop.prevent="toggleMute"
          class="absolute bottom-3 right-3 w-10 h-10 rounded-full bg-black/60 hover:bg-[#ff2a2a]/80 border border-white/20 text-white flex items-center justify-center z-10 transition-colors"
          :title="videoMuted ? 'Activer le son' : 'Couper le son'"
          :aria-label="videoMuted ? 'Activer le son' : 'Couper le son'"
        >
          <AppIcon :name="videoMuted ? 'muted' : 'sound'" :size="14" />
        </button>
        <span
          v-if="isStock"
          class="absolute top-3 left-3 bg-emerald-500 text-black text-[9px] uppercase font-bold tracking-widest px-2.5 py-1 rounded shadow-lg"
        >
          ✓ EN STOCK
        </span>
        <span
          v-else
          class="absolute top-3 left-3 bg-amber-500/95 text-black text-[9px] uppercase font-bold tracking-widest px-2.5 py-1 rounded shadow-lg"
        >
📦 PRÉCOMMANDE
        </span>
        <span v-if="pct > 0" class="absolute top-9 right-3 bg-[#ff2a2a] text-white text-[11px] font-black tracking-wider px-2.5 py-1 rounded-full shadow-lg shadow-[#ff2a2a]/30 animate-pulse">
          -{{ pct }}%
        </span>
        <span v-if="product.videoUrl" class="absolute top-3 right-3 bg-black/60 text-white text-[8px] uppercase font-bold tracking-widest px-2 py-1 rounded border border-white/20 flex items-center gap-1">
          <AppIcon name="video" :size="10" /> VIDEO
        </span>
        <!-- Glow badges: liked / commented by the current visitor -->
        <div v-if="isGlowing" class="absolute top-12 left-3 flex flex-col gap-1">
          <span v-if="isLiked" class="inline-flex items-center gap-1 text-[9px] font-mono font-bold text-[#ff2a2a] bg-black/70 border border-[#ff2a2a]/50 backdrop-blur px-2 py-1 rounded-md">
            ❤️ J'aime
          </span>
          <span v-if="isCommented" class="inline-flex items-center gap-1 text-[9px] font-mono font-bold text-sky-300 bg-black/70 border border-sky-400/50 backdrop-blur px-2 py-1 rounded-md">
            💬 Commenté
          </span>
        </div>
      </div>
    </NuxtLink>

    <div class="p-4">
      <NuxtLink :to="url">
        <h3 class="font-extrabold text-sm text-slate-100 group-hover:text-[#ff2a2a] transition-colors leading-snug line-clamp-2">
          {{ truncatedTitle }}
        </h3>
      </NuxtLink>
      <div class="mt-2 flex items-center justify-between pt-2 border-t border-zinc-900">
        <div class="flex items-baseline gap-2 flex-wrap">
          <template v-if="pct > 0">
            <span class="text-[10px] text-zinc-500 font-mono line-through">{{ format(product.priceXof) }}</span>
            <span class="font-extrabold text-[#ff2a2a] text-sm font-mono">{{ format(discountPrice) }}</span>
            <span v-if="countdown" class="w-full text-[9px] text-amber-400 font-mono font-bold">⏳ Fin promo dans {{ countdown }}</span>
          </template>
          <span v-else class="font-extrabold text-slate-100 text-sm font-mono">{{ format(product.priceXof) }}</span>
        </div>
      </div>

      <div v-if="Number(product.moq) > 0 || Number(product.stockQuantity) > 0" class="mt-2 flex flex-wrap gap-1.5">
        <span v-if="Number(product.moq) > 0" class="inline-flex items-center gap-1 text-[9px] font-mono font-bold uppercase tracking-wider text-zinc-300 bg-black/50 border border-zinc-800 rounded-md px-2 py-1">
          <AppIcon name="tag" :size="10" class="text-[#ff2a2a]" /> MOQ {{ product.moq }}
        </span>
        <span v-if="Number(product.stockQuantity) > 0" class="inline-flex items-center gap-1 text-[9px] font-mono font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-md px-2 py-1">
          <AppIcon name="box" :size="10" /> {{ product.stockQuantity }} en stock
        </span>
      </div>

      <button
        @click="preorder"
        class="mt-3 w-full bg-[#ff2a2a] hover:bg-red-600 text-white text-[11px] font-bold font-mono uppercase tracking-widest px-3 py-2.5 rounded-xl transition-all cursor-pointer"
      >
        {{ ctaLabel }}
      </button>

      <div class="mt-2.5">
        <ProductActions :product="product" compact />
      </div>
    </div>
  </div>
</template>
