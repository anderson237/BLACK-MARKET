<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useTrack } from '~/composables/useTrack'
import { useCommentsStore } from '~/stores/comments'
import { themedAvatarUri } from '~/data/avatars'

const { isLight } = useTheme()

interface CommentItem {
  id: string
  productId: string
  userId: string
  name: string
  picture?: string
  role?: string
  text: string
  createdAt: string
  editedAt?: string
  likes?: number
  dislikes?: number
  reports?: number
  likedBy?: string[]
  dislikedBy?: string[]
  reportedBy?: string[]
  likedByMe?: boolean
  dislikedByMe?: boolean
  reportedByMe?: boolean
}

const props = defineProps<{ productId: string }>()
const auth = useAuthStore()
const { track, copyLink } = useTrack()
const commentsStore = useCommentsStore()

const comments = ref<CommentItem[]>([])
const totalCount = ref(0)
const text = ref('')
const loading = ref(false)
const submitting = ref(false)
const error = ref('')
const loaded = ref(false)
const editingId = ref<string | null>(null)
const editingText = ref('')
const editingError = ref('')

const isMine = (c: CommentItem) => auth.isAuthed && !!c.userId && c.userId === auth.user?.id

function startEdit(c: CommentItem) {
  editingId.value = c.id
  editingText.value = c.text
  editingError.value = ''
}

async function saveEdit(c: CommentItem) {
  const body = editingText.value.trim()
  if (!body) return
  editingError.value = ''
  try {
    const res = await fetch(`/api/me/comments/${encodeURIComponent(c.id)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.token}`,
      },
      body: JSON.stringify({ text: body }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data?.statusMessage || data?.error || `Erreur ${res.status}`)
    c.text = data.comment?.text || body
    editingId.value = null
    track({ type: 'comment', productId: props.productId })
  } catch (e: any) {
    editingError.value = e?.message || 'Impossible de modifier le commentaire.'
  }
}

// ---- comment reactions: like / dislike / share / report ----
function guardAuth(): boolean {
  if (auth.isAuthed) return true
  auth.openModal('Connectez-vous pour réagir aux commentaires.')
  return false
}

async function toggleReaction(c: CommentItem, kind: 'like' | 'dislike') {
  if (!guardAuth()) return
  try {
    const res = await fetch(`/api/comments/${encodeURIComponent(c.id)}/${kind}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.token}`,
      },
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data?.statusMessage || data?.error || `Erreur ${res.status}`)
    const upd = data.comment
    if (upd) {
      c.likes = upd.likes
      c.dislikes = upd.dislikes
      c.likedByMe = (upd.likedBy || []).includes(auth.user?.id)
      c.dislikedByMe = (upd.dislikedBy || []).includes(auth.user?.id)
    }
    window.dispatchEvent(new CustomEvent('bm:track', { detail: { type: 'comment' } }))
  } catch (e: any) {
    window.alert(e?.message || 'Impossible de réagir à ce commentaire.')
  }
}

function shareComment(c: CommentItem) {
  track({ type: 'share', productId: c.productId })
  copyLink(c.productId)
}

async function reportThis(c: CommentItem) {
  if (!guardAuth()) return
  if (c.reportedByMe) return
  try {
    const res = await fetch(`/api/comments/${encodeURIComponent(c.id)}/report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.token}`,
      },
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data?.statusMessage || data?.error || `Erreur ${res.status}`)
    c.reportedByMe = true
    c.reports = (c.reports || 0) + 1
    window.dispatchEvent(new CustomEvent('bm:track', { detail: { type: 'comment' } }))
  } catch (e: any) {
    window.alert(e?.message || 'Impossible de signaler ce commentaire.')
  }
}

async function load() {
  try {
    const res = await fetch(`/api/products/${encodeURIComponent(props.productId)}/comments`, {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return
    const data = await res.json()
    comments.value = Array.isArray(data?.comments) ? data.comments : []
    totalCount.value = Number.isFinite(Number(data?.count)) ? Number(data.count) : comments.value.length
    if (Number.isFinite(Number(data?.count))) {
      commentsStore.counts[props.productId] = Number(data.count)
      commentsStore.loaded[props.productId] = true
    } else {
      commentsStore.bump(props.productId, comments.value.length - commentsStore.getCount(props.productId))
    }
  } catch {
  } finally {
    loaded.value = true
  }
}

// ---- live auto-refresh: new comments + counters appear without a manual reload
let autoTimer: ReturnType<typeof setInterval> | null = null

function onVisible() {
  if (document.visibilityState === 'visible') load()
}

onMounted(() => {
  load()
  autoTimer = setInterval(load, 12_000)
  window.addEventListener('focus', onVisible)
  document.addEventListener('visibilitychange', onVisible)
})

onUnmounted(() => {
  if (autoTimer) clearInterval(autoTimer)
  window.removeEventListener('focus', onVisible)
  document.removeEventListener('visibilitychange', onVisible)
})

async function submit() {
  const body = text.value.trim()
  if (!body) return
  auth.requireAuth(async () => {
    submitting.value = true
    error.value = ''
    try {
      const res = await fetch(`/api/products/${encodeURIComponent(props.productId)}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.token}`,
        },
        body: JSON.stringify({
          userId: auth.user?.id,
          name: auth.user?.name || 'Utilisateur',
          picture: auth.user?.picture,
          text: body,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.statusMessage || data?.error || `Erreur ${res.status}`)
      comments.value.unshift(data.comment)
      commentsStore.bump(props.productId, 1)
      text.value = ''
      track({ type: 'comment', productId: props.productId })
    } catch (e: any) {
      error.value = e?.message || 'Impossible d\'envoyer le commentaire.'
    } finally {
      submitting.value = false
    }
  }, 'Connectez-vous pour commenter')
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'à l\'instant'
  if (mins < 60) return `il y a ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `il y a ${hours} h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `il y a ${days} j`
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

</script><template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <p class="text-[9px] text-[#ff2a2a] font-mono uppercase font-bold tracking-wider">COMMENTAIRES ({{ totalCount }})</p>
      <span class="text-[9px] text-zinc-600 font-mono">Connecté requis pour commenter</span>
    </div>

    <!-- Input -->
    <div class="space-y-2">
      <div class="flex gap-2">
        <img
          v-if="auth.user?.picture"
          :src="themedAvatarUri(auth.user.picture, isLight.value)"
          alt="avatar"
          class="w-9 h-9 rounded-full object-cover border border-zinc-700 shrink-0"
        />
        <div v-else class="w-9 h-9 rounded-full bg-black/40 border border-zinc-800 flex items-center justify-center text-slate-400 font-mono text-sm shrink-0">
          {{ (auth.user?.name || '?').slice(0, 1).toUpperCase() }}
        </div>
        <input
          v-model="text"
          type="text"
          :placeholder="auth.isAuthed ? 'Écrire un commentaire…' : 'Connectez-vous pour commenter'"
          class="flex-1 bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 font-mono focus:outline-none focus:border-[#ff2a2a]/60 transition-colors"
          :readonly="!auth.isAuthed"
          @focus="!auth.isAuthed && auth.openModal('Connectez-vous pour commenter')"
        />
        <button
          @click="submit"
          :disabled="submitting || !text.trim()"
          class="shrink-0 bg-[#ff2a2a] hover:bg-red-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all font-mono disabled:opacity-40"
        >
          {{ submitting ? '…' : 'Envoyer' }}
        </button>
      </div>
      <p v-if="error" class="text-[11px] text-[#ff2a2a] font-mono">{{ error }}</p>
    </div>

    <!-- List -->
    <div v-if="loading" class="space-y-3">
      <div v-for="n in 3" :key="n" class="skeleton h-14 rounded-xl" />
    </div>
    <div v-else-if="comments.length === 0" class="text-center py-6 text-zinc-600 font-mono text-[11px]">
      AUCUN COMMENTAIRE — SOYEZ LE PREMIER
    </div>
    <div v-else class="space-y-3">
      <div v-for="c in comments" :key="c.id" class="flex gap-3 bg-black/30 border border-zinc-900 rounded-xl p-3">
        <img
          v-if="c.picture"
          :src="themedAvatarUri(c.picture, isLight.value)"
          alt="avatar"
          class="w-8 h-8 rounded-full object-cover border border-zinc-700 shrink-0"
        />
        <div v-else class="w-8 h-8 rounded-full bg-black/40 border border-zinc-800 flex items-center justify-center text-slate-400 font-mono text-xs shrink-0">
          {{ (c.name || '?').slice(0, 1).toUpperCase() }}
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-baseline gap-2">
            <span class="text-xs font-bold text-slate-200">{{ c.name }}</span>
            <StaffBadge :role="c.role" />
            <span class="text-[9px] text-zinc-600 font-mono">{{ timeAgo(c.createdAt) }}</span>
            <span v-if="c.editedAt" class="text-[9px] text-zinc-500 font-mono italic">· modifié</span>
          </div>
          <template v-if="editingId === c.id">
            <textarea v-model="editingText" rows="2" maxlength="1000"
              class="mt-1 w-full bg-black/40 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-[#ff2a2a]/60 transition-colors resize-none" />
            <p v-if="editingError" class="text-[10px] text-[#ff2a2a] font-mono mt-1">{{ editingError }}</p>
            <div class="flex items-center gap-2 mt-1.5">
              <button @click="saveEdit(c)" :disabled="!editingText.trim()"
                class="shrink-0 bg-[#ff2a2a] hover:bg-red-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all font-mono disabled:opacity-40">Enregistrer</button>
              <button @click="editingId = null; editingText = ''"
                class="shrink-0 text-[10px] font-mono text-zinc-400 hover:text-white border border-zinc-800 px-3 py-1.5 rounded-lg transition-all">Annuler</button>
            </div>
          </template>
          <p v-else class="text-xs text-zinc-300 mt-0.5 break-words">{{ c.text }}</p>
          <div v-if="editingId !== c.id" class="flex items-center gap-3 mt-2 flex-wrap">
            <button @click="toggleReaction(c, 'like')"
              class="inline-flex items-center gap-1 text-[10px] font-mono transition-colors"
              :class="c.likedByMe ? 'text-[#ff2a2a]' : 'text-zinc-500 hover:text-[#ff2a2a]'"
              :title="c.likedByMe ? 'Retirer le like' : 'J\'aime ce commentaire'">
              <AppIcon name="thumbsUp" :size="12" /> {{ c.likes || 0 }}
            </button>
            <button @click="toggleReaction(c, 'dislike')"
              class="inline-flex items-center gap-1 text-[10px] font-mono transition-colors"
              :class="c.dislikedByMe ? 'text-sky-400' : 'text-zinc-500 hover:text-sky-400'"
              :title="c.dislikedByMe ? 'Retirer le dislike' : 'Je n\'aime pas ce commentaire'">
              <AppIcon name="thumbsDown" :size="12" /> {{ c.dislikes || 0 }}
            </button>
            <button @click="shareComment(c)" title="Partager le produit"
              class="inline-flex items-center gap-1 text-[10px] font-mono text-zinc-500 hover:text-violet-400 transition-colors">
              <AppIcon name="share" :size="12" /> Partager
            </button>
            <button @click="reportThis(c)" :disabled="c.reportedByMe"
              class="inline-flex items-center gap-1 text-[10px] font-mono transition-colors"
              :class="c.reportedByMe ? 'text-amber-400 cursor-default' : 'text-zinc-500 hover:text-amber-400'"
              :title="c.reportedByMe ? 'Commentaire déjà signalé' : 'Signaler ce commentaire'">
              <AppIcon name="flag" :size="12" /> {{ c.reportedByMe ? 'Signalé' : 'Signaler' }}
            </button>
          </div>
        </div>
        <div v-if="isMine(c)" class="flex flex-col gap-1.5 shrink-0">
          <button @click="startEdit(c)" :disabled="editingId === c.id"
            class="w-10 h-10 rounded-lg border border-zinc-800 hover:border-sky-500/60 text-zinc-500 hover:text-sky-400 flex items-center justify-center transition-all disabled:opacity-40"
            title="Modifier mon commentaire">
            <AppIcon name="edit" :size="11" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
