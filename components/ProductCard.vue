<script setup lang="ts">
import type { Product } from '~/types'
import { formatPriceXof } from '~/composables/useCatalog'
import { useAuthStore } from '~/stores/auth'

const props = defineProps<{ product: Product; index: number }>()
const config = useRuntimeConfig()
const auth = useAuthStore()

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
  const msg = `📦 ${props.product.title}\n💰 ${formatPriceXof(props.product.priceXof)} F CFA\nDécouvrez ce drop exclusif BLACK MARKET :`
  const link = window.location.origin + url.value
  const num = props.product.waNumber || config.public.phoneNumber
  auth.requireAuth(
    () => window.open('https://wa.me/' + num + '?text=' + encodeURIComponent(msg + '\n' + link), '_blank', 'noopener,noreferrer'),
    'Connectez-vous pour précommander',
  )
}
</script>

<template>
  <div class="group bg-[#12121a] rounded-2xl overflow-hidden border border-zinc-800 hover:border-[#ff2a2a]/40 transition-all duration-300 cursor-pointer">
    <NuxtLink :to="url" class="block" :aria-label="product.title">
      <div class="relative overflow-hidden" :style="{ height: imgHeight }">
        <video
          v-if="product.videoUrl"
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
          class="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-500"
        />
        <button
          v-if="product.videoUrl"
          @click.stop.prevent="toggleMute"
          class="absolute bottom-3 right-3 w-10 h-10 rounded-full bg-black/60 hover:bg-[#ff2a2a]/80 border border-white/20 text-white flex items-center justify-center z-10 transition-colors"
          :title="videoMuted ? 'Activer le son' : 'Couper le son'"
          :aria-label="videoMuted ? 'Activer le son' : 'Couper le son'"
        >
          <AppIcon :name="videoMuted ? 'muted' : 'sound'" :size="14" />
        </button>
        <span class="absolute top-3 left-3 bg-[#ff2a2a] text-white text-[9px] uppercase font-bold tracking-widest px-2.5 py-1 rounded">
          {{ product.category || 'EXCLUSIF' }}
        </span>
        <span v-if="product.videoUrl" class="absolute top-3 right-3 bg-black/60 text-white text-[8px] uppercase font-bold tracking-widest px-2 py-1 rounded border border-white/20 flex items-center gap-1">
          <AppIcon name="video" :size="10" /> VIDEO
        </span>
      </div>
    </NuxtLink>

    <div class="p-4">
      <NuxtLink :to="url">
        <h3 class="font-extrabold text-sm text-slate-100 group-hover:text-[#ff2a2a] transition-colors leading-snug">
          {{ product.title }}
        </h3>
      </NuxtLink>
      <div class="mt-2 flex items-center justify-between pt-2 border-t border-zinc-900">
        <span class="font-extrabold text-slate-100 text-sm font-mono">{{ formatPriceXof(product.priceXof) }}</span>
      </div>

      <button
        @click="preorder"
        class="mt-3 w-full bg-[#ff2a2a] hover:bg-red-600 text-white text-[11px] font-bold font-mono uppercase tracking-widest px-3 py-2.5 rounded-xl transition-all cursor-pointer"
      >
        PRÉCOMMANDER
      </button>

      <div class="mt-2.5">
        <ProductActions :product="product" compact />
      </div>
    </div>
  </div>
</template>