<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useTrack } from '~/composables/useTrack'
import { useCommentsStore } from '~/stores/comments'

interface CommentItem {
  id: string
  productId: string
  userId: string
  name: string
  picture?: string
  text: string
  createdAt: string
}

const props = defineProps<{ productId: string }>()
const auth = useAuthStore()
const { track } = useTrack()
const commentsStore = useCommentsStore()

const comments = ref<CommentItem[]>([])
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

async function load() {
  try {
    const res = await fetch(`/api/products/${encodeURIComponent(props.productId)}/comments`, {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return
    const data = await res.json()
    comments.value = Array.isArray(data?.comments) ? data.comments : []
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

onMounted(load)
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <p class="text-[9px] text-[#ff2a2a] font-mono uppercase font-bold tracking-wider">COMMENTAIRES ({{ comments.length }})</p>
      <span class="text-[9px] text-zinc-600 font-mono">Connecté requis pour commenter</span>
    </div>

    <!-- Input -->
    <div class="space-y-2">
      <div class="flex gap-2">
        <img
          v-if="auth.user?.picture"
          :src="auth.user.picture"
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
          class="shrink-0 bg-[#ff2a2a] hover:bg-red-600 text-white text-xs font-bold px-4 rounded-xl transition-all font-mono disabled:opacity-40"
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
          :src="c.picture"
          alt="avatar"
          class="w-8 h-8 rounded-full object-cover border border-zinc-700 shrink-0"
        />
        <div v-else class="w-8 h-8 rounded-full bg-black/40 border border-zinc-800 flex items-center justify-center text-slate-400 font-mono text-xs shrink-0">
          {{ (c.name || '?').slice(0, 1).toUpperCase() }}
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-baseline gap-2">
            <span class="text-xs font-bold text-slate-200">{{ c.name }}</span>
            <span class="text-[9px] text-zinc-600 font-mono">{{ timeAgo(c.createdAt) }}</span>
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
        </div>
        <div v-if="isMine(c)" class="flex flex-col gap-1.5 shrink-0">
          <button @click="startEdit(c)" :disabled="editingId === c.id"
            class="w-7 h-7 rounded-lg border border-zinc-800 hover:border-sky-500/60 text-zinc-500 hover:text-sky-400 flex items-center justify-center transition-all disabled:opacity-40"
            title="Modifier mon commentaire">
            <AppIcon name="edit" :size="11" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
