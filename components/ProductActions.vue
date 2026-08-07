<script setup lang="ts">
import type { Product } from '~/types'
import { promoPrice } from '~/composables/useCatalog'
import { useTrack } from '~/composables/useTrack'
import { useAuthStore } from '~/stores/auth'
import { useCommentsStore } from '~/stores/comments'
import { useCurrency } from '~/composables/useCurrency'

const props = defineProps<{ product: Product; compact?: boolean }>()
const { track, like, share } = useTrack()
const inter = useInteractionsStore()
const auth = useAuthStore()
const config = useRuntimeConfig()
const commentsStore = useCommentsStore()
const { format } = useCurrency()

// Seed the counts from the SSR payload (product.likeCount/commentCount) so the
// server-rendered HTML already shows the real numbers — no "flash to 0" after
// a page refresh while the client re-fetches.
if (props.product.likeCount != null) inter.seed(props.product.id, props.product.likeCount)
if (props.product.commentCount != null) commentsStore.seed(props.product.id, props.product.commentCount)

const liked = computed(() => inter.getLike(props.product.id).liked)
const likeCount = computed(() => inter.getLike(props.product.id).count)

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
  const msg = `📦 ${props.product.title}\n💰 ${format(promoPrice(props.product))}\nDécouvrez ce drop exclusif DEEP ROOTS :`
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

// ---- share menu (WhatsApp / Facebook / Messenger / TikTok / Gmail / copy) ----
const shareOpen = ref(false)
const productUrl = () => window.location.origin + '/p/' + props.product.id + '.html'
const shareMsg = () => `📦 ${props.product.title}\n💰 ${format(promoPrice(props.product))}\nDécouvrez ce drop exclusif DEEP ROOTS :`

function openShare() {
  shareOpen.value = !shareOpen.value
}

/** Web Share API when available (mobile: opens the system sheet incl. TikTok/Messenger), else fallback. */
async function nativeShareFallback(label: string) {
  const url = productUrl()
  if (navigator.share) {
    try {
      await navigator.share({ title: props.product.title, text: shareMsg(), url })
      share(props.product, 'messenger')
      return
    } catch {
      /* user cancelled -> fall through to copy */
    }
  }
  await navigator.clipboard?.writeText(url).catch(() => {})
  share(props.product, 'copy')
  window.dispatchEvent(new CustomEvent('bm:copied', { detail: `${label} : lien copié dans le presse-papiers !` }))
}

function shareTo(platform: 'wa' | 'fb' | 'gmail' | 'messenger' | 'tiktok') {
  const url = productUrl()
  const msg = shareMsg()
  shareOpen.value = false

  if (platform === 'wa') {
    const num = props.product.waNumber || config.public.phoneNumber
    window.open('https://wa.me/' + num + '?text=' + encodeURIComponent(msg + '\n' + url), '_blank', 'noopener,noreferrer')
    share(props.product, 'wa')
  } else if (platform === 'fb') {
    window.open('https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url), '_blank', 'noopener,noreferrer')
    share(props.product, 'fb')
  } else if (platform === 'gmail') {
    window.open(
      'https://mail.google.com/mail/?view=cm&fs=1&to=&su=' + encodeURIComponent(`${props.product.title} — DEEP ROOTS`) + '&body=' + encodeURIComponent(msg + '\n' + url),
      '_blank',
      'noopener,noreferrer',
    )
    share(props.product, 'gmail')
  } else {
    // Messenger & TikTok have no public web share dialog: prefer the native
    // system share sheet (mobile), fallback to copying the link.
    nativeShareFallback(platform === 'messenger' ? 'Messenger' : 'TikTok')
  }
}

const shareItems = [
  { id: 'wa', label: 'WhatsApp', emoji: '💬', color: 'text-green-400 hover:bg-green-500/10', iconBg: 'bg-green-500/15' },
  { id: 'fb', label: 'Facebook', emoji: '📘', color: 'text-blue-400 hover:bg-blue-500/10', iconBg: 'bg-blue-500/15' },
  { id: 'messenger', label: 'Messenger', emoji: '✈️', color: 'text-sky-400 hover:bg-sky-500/10', iconBg: 'bg-sky-500/15' },
  { id: 'tiktok', label: 'TikTok', emoji: '🎵', color: 'text-cyan-300 hover:bg-cyan-500/10', iconBg: 'bg-cyan-500/15' },
  { id: 'gmail', label: 'Gmail', emoji: '📧', color: 'text-red-400 hover:bg-red-500/10', iconBg: 'bg-red-500/15' },
  { id: 'copy', label: 'Copier le lien', emoji: '🔗', color: 'text-zinc-300 hover:bg-zinc-700/40', iconBg: 'bg-zinc-700/40' },
]
function onShareItem(item: any) {
  if (item.id === 'copy') { onCopy(); return }
  shareTo(item.id)
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

    <!-- Share menu (WhatsApp, Facebook, Messenger, TikTok, Gmail, copy) -->
    <div class="relative z-20">
      <button
        @click="openShare"
        class="flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl border transition-all text-[11px] font-mono font-bold"
        :class="shareOpen
          ? 'bg-[#ff2a2a]/15 border-[#ff2a2a]/50 text-[#ff2a2a]'
          : 'bg-black/30 border-zinc-800 text-zinc-400 hover:border-green-500/40 hover:text-green-400'"
        aria-label="Partager le produit"
      >
        <AppIcon name="share" :size="15" />
      </button>

      <template v-if="shareOpen">
        <div class="fixed inset-0 z-40" @click="shareOpen = false" />
        <div class="absolute right-0 top-full mt-2 z-50 w-48 bg-[#12121a] border border-zinc-800 rounded-2xl p-1.5 shadow-2xl shadow-black/60">
          <button
            v-for="s in shareItems" :key="s.id"
            @click="onShareItem(s)"
            class="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left text-[11px] font-mono font-bold transition-all hover:bg-zinc-800/60"
            :class="s.color"
          >
            <span class="w-6 h-6 rounded-lg flex items-center justify-center text-sm" :class="s.iconBg">{{ s.emoji }}</span>
            {{ s.label }}
          </button>
        </div>
      </template>
    </div>

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

