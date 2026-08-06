<script setup lang="ts">
import type { Product } from '~/types'
import { useTrack } from '~/composables/useTrack'
import { useAuthStore } from '~/stores/auth'
import { useCommentsStore } from '~/stores/comments'

const props = defineProps<{ product: Product; compact?: boolean }>()
const { track, like, share } = useTrack()
const inter = useInteractionsStore()
const auth = useAuthStore()
const config = useRuntimeConfig()

const liked = computed(() => inter.getLike(props.product.id).liked)
const likeCount = computed(() => inter.getLike(props.product.id).count)

const commentsStore = useCommentsStore()
const commentCount = computed(() => commentsStore.getCount(props.product.id))

function syncStats() {
  // Always re-sync from the server so returning to a page (or re-focusing the
  // tab) shows the centralized, up-to-date comment & like counts.
  commentsStore.refresh(props.product.id)
  inter.refreshCount(props.product.id)
}

function onVisible() {
  if (document.visibilityState === 'visible') syncStats()
}

onMounted(() => {
  syncStats()
  window.addEventListener('focus', onVisible)
  document.addEventListener('visibilitychange', onVisible)
  // React live to a comment/like made elsewhere while this control is mounted.
  window.addEventListener('bm:track', onTrackEvent)
})

onUnmounted(() => {
  window.removeEventListener('focus', onVisible)
  document.removeEventListener('visibilitychange', onVisible)
  window.removeEventListener('bm:track', onTrackEvent)
})

function onTrackEvent(e: Event) {
  const ev = (e as CustomEvent).detail
  if (!ev || !ev.productId) return
  if (ev.productId !== props.product.id) return
  if (ev.type === 'comment') commentsStore.refresh(props.product.id)
  if (ev.type === 'like' || ev.type === 'unlike') inter.refreshCount(props.product.id)
}

function onLike() {
  auth.requireAuth(() => {
    // Toggle FIRST so the store's 800ms cooldown (lastLocal) is armed before
    // `like()` dispatches bm:track -> refreshCount. Otherwise refreshCount would
    // start before lastLocal exists and the stale server read would clobber the
    // optimistic count (the old -1/0 bug).
    inter.toggleLike(props.product.id)
    like(props.product, liked.value)
  }, 'Connectez-vous pour liker ce drop')
}

function onShareWa() {
  const msg = `📦 ${props.product.title}\n💰 ${props.product.priceXof} F CFA\nDécouvrez ce drop exclusif BLACK MARKET :`
  const url = window.location.origin + '/p/' + props.product.id + '.html'
  const num = props.product.waNumber || config.public.phoneNumber
  window.open(
    'https://wa.me/' + num + '?text=' + encodeURIComponent(msg + '\n' + url),
    '_blank',
    'noopener,noreferrer',
  )
  share(props.product, 'wa')
}

async function onCopy() {
  share(props.product, 'copy')
  await navigator.clipboard?.writeText(window.location.origin + '/p/' + props.product.id + '.html').catch(() => {})
  // toast
  window.dispatchEvent(new CustomEvent('bm:copied', { detail: 'Lien copié dans le presse-papiers !' }))
}

function onComment() {
  const url = '/p/' + props.product.id + '.html#commentaires'
  if (window.location.pathname.startsWith('/p/')) {
    document.getElementById('commentaires')?.scrollIntoView({ behavior: 'smooth' })
  } else {
    window.location.href = url
  }
}
</script>

<template>
  <div :class="compact ? 'grid grid-cols-2 sm:grid-cols-4 gap-1.5' : 'flex items-center gap-1.5'">
    <!-- Like -->
    <button
      @click="onLike"
      class="group/act flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl border transition-all text-[11px] font-mono font-bold"
      :class="liked
        ? 'bg-[#ff2a2a]/15 border-[#ff2a2a]/50 text-[#ff2a2a]'
        : 'bg-black/30 border-zinc-800 text-zinc-400 hover:border-[#ff2a2a]/40 hover:text-slate-100'"
      :aria-label="liked ? 'Retirer le like' : 'J\'aime'"
    >
      <AppIcon name="heart" :size="15" :class="like ? 'fill-[#ff2a2a] text-[#ff2a2a]' : ''" />
      <span class="hidden sm:inline">{{ likeCount }}</span>
    </button>

    <!-- Comment -->
    <button
      @click="onComment"
      class="flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl border bg-black/30 border-zinc-800 text-zinc-400 hover:border-sky-400/40 hover:text-sky-300 transition-all text-[11px] font-mono font-bold"
      aria-label="Commenter"
    >
      <AppIcon name="comment" :size="15" />
      <span class="hidden sm:inline">{{ commentCount }}</span>
    </button>

    <!-- Share WhatsApp -->
    <button
      @click="onShareWa"
      class="flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl border bg-black/30 border-zinc-800 text-zinc-400 hover:border-green-500/40 hover:text-green-400 transition-all text-[11px] font-mono font-bold"
      aria-label="Partager sur WhatsApp"
    >
      <AppIcon name="share" :size="15" />
    </button>

    <!-- Copy link -->
    <button
      @click="onCopy"
      class="flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl border bg-black/30 border-zinc-800 text-zinc-400 hover:border-sky-400/40 hover:text-sky-300 transition-all text-[11px] font-mono font-bold"
      aria-label="Copier le lien"
    >
      <AppIcon name="link" :size="15" />
    </button>
  </div>
</template>
