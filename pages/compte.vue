<script setup lang="ts">
import { COUNTRIES, countryByCode, type Country } from '~/data/countries'
import { ANIMAL_AVATARS, avatarDataUri, themedAvatarUri } from '~/data/avatars'
import { MOODS, moodOf } from '~/data/moods'
import { useAuthStore } from '~/stores/auth'
import { useInteractionsStore } from '~/stores/interactions'
import { useTrack } from '~/composables/useTrack'

const { isLight } = useTheme()

useSeoMeta({ title: 'Mon espace — BLACK MARKET' })

const auth = useAuthStore()
const config = useRuntimeConfig()
const inter = useInteractionsStore()
const { like } = useTrack()

// Guard: must be logged in to reach the client space.
onMounted(() => {
  if (!auth.isAuthed) {
    auth.openModal('Connectez-vous pour accéder à votre espace client')
    navigateTo('/')
  }
})

const needsCompletion = computed(() => auth.isAuthed && !auth.user?.phone)

const editOpen = ref(false)

// ---- completion / edit profile ----
const pseudo = ref('')
const name = ref('')
const mood = ref('')
const phoneNumber = ref('')
const prefix = ref<string>(COUNTRIES[0].prefix)
const countryCode = ref<string>(COUNTRIES[0].code)
const countrySearch = ref('')
const showCountry = ref(false)
const saving = ref(false)
const error = ref('')
const ok = ref('')
const selectedAvatar = ref('')

const filteredCountries = computed(() => {
  const q = countrySearch.value.trim().toLowerCase()
  if (!q) return COUNTRIES
  return COUNTRIES.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q) || c.prefix.includes(q))
})
const selectedCountry = computed<Country>(() => countryByCode(countryCode.value) || COUNTRIES[0])

function pickCountry(c: Country) {
  countryCode.value = c.code
  prefix.value = c.prefix
  countrySearch.value = ''
  showCountry.value = false
}

function fillForm() {
  const u = auth.user
  pseudo.value = u?.pseudo || ''
  name.value = u?.name || ''
  mood.value = u?.mood || ''
  phoneNumber.value = u?.phone || ''
  selectedAvatar.value = ANIMAL_AVATARS.find((a) => u?.picture === avatarDataUri(a.key, false) || u?.picture === avatarDataUri(a.key, true))?.key || ''
  if (u?.phonePrefix) prefix.value = u.phonePrefix
  if (u?.country) {
    const c = COUNTRIES.find((x) => x.name === u.country)
    if (c) { countryCode.value = c.code; prefix.value = c.prefix }
  }
}

function openEdit() {
  fillForm()
  editOpen.value = true
}

async function saveProfile() {
  error.value = ''
  ok.value = ''
  const phone = phoneNumber.value.replace(/[^0-9]/g, '')
  if (phone && phone.length < 6) { error.value = 'Numéro WhatsApp invalide.'; return }
  if (needsCompletion.value && !phone) { error.value = 'Votre numéro WhatsApp est requis pour activer votre espace client.'; return }
  saving.value = true
  try {
    const data = await auth.api('/api/me', {
      method: 'PUT',
      body: JSON.stringify({
        pseudo: pseudo.value,
        name: name.value || undefined,
        mood: mood.value || undefined,
        phone: phone || undefined,
        phonePrefix: prefix.value,
        country: selectedCountry.value?.name,
        picture: selectedAvatar.value ? avatarDataUri(selectedAvatar.value, isLight.value) : undefined,
      }),
    })
    if (data?.user) auth.updateUser(data.user)
    ok.value = 'Profil enregistré ✓'
    if (needsCompletion.value) navigateTo('/compte')
  } catch (e: any) {
    error.value = e?.message || 'Erreur lors de l\'enregistrement.'
  } finally {
    saving.value = false
  }
}

// ---- avatar upload ----
const uploading = ref(false)

async function onAvatarFile(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const img = await readAsDataURL(file)
  uploading.value = true
  error.value = ''
  try {
    const res = await fetch('/api/upload-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
      body: JSON.stringify({ imageBase64: img }),
    })
    const data = await res.json()
    if (!res.ok || !data.url) throw new Error(data?.error || 'Upload échoué')
    const me = await auth.api('/api/me', {
      method: 'PUT',
      body: JSON.stringify({ picture: data.url }),
    })
    if (me?.user) auth.updateUser(me.user)
    selectedAvatar.value = ''
    ok.value = 'Photo de profil mise à jour ✓'
  } catch (e: any) {
    error.value = e?.message || 'Upload de la photo échoué.'
  } finally {
    uploading.value = false
    input.value = ''
  }
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(String(fr.result))
    fr.onerror = () => reject(new Error('Lecture du fichier impossible.'))
    fr.readAsDataURL(file)
  })
}

// ---- interactions ----
interface CommentItem { id: string; productId: string; text: string; createdAt: string; editedAt?: string; role?: string; likes?: number; dislikes?: number; reports?: number; likedByMe?: boolean; dislikedByMe?: boolean; reportedByMe?: boolean; productTitle?: string; productImage?: string }
interface EventItem { type: string; productId?: string; productTitle?: string; productImage?: string; role?: string; ts: number; url?: string }
interface OrderItem { id: string; productTitle?: string; productImage?: string; quantity: number; priceXof: number; status: string; createdAt: string }
interface LikedItem { productId: string; productTitle?: string; productImage?: string }
interface InteractionsData {
  user?: any
  comments: CommentItem[]
  events: EventItem[]
  liked: LikedItem[]
  orders: OrderItem[]
  activity: {
    views: EventItem[]
    likes: EventItem[]
    shares: EventItem[]
    others: EventItem[]
  }
  stats: { comments: number; likes: number; views: number; clicks: number; shares: number; orders: number }
}

const data = ref<InteractionsData | null>(null)
const loadingData = ref(false)
let refreshTimer: ReturnType<typeof setTimeout> | null = null

async function loadInteractions() {
  if (!auth.isAuthed) return
  loadingData.value = true
  try {
    data.value = await auth.api('/api/me/interactions')
  } catch (e: any) {
    error.value = e?.message || 'Impossible de charger vos interactions.'
  } finally {
    loadingData.value = false
  }
}

// Two-way binding: any like/comment/share fires `bm:track` -> refresh stats live.
onMounted(() => {
  window.addEventListener('bm:track', onTrackRefresh)
  window.addEventListener('focus', onTrackRefresh)
  window.addEventListener('storage', onStorage)
  document.addEventListener('visibilitychange', onVisibility)
  autoRefresh = setInterval(onTrackRefresh, 15_000)
})
onUnmounted(() => {
  window.removeEventListener('bm:track', onTrackRefresh)
  window.removeEventListener('focus', onTrackRefresh)
  window.removeEventListener('storage', onStorage)
  document.removeEventListener('visibilitychange', onVisibility)
  if (refreshTimer) clearTimeout(refreshTimer)
  if (autoRefresh) clearInterval(autoRefresh)
})
function onTrackRefresh() {
  if (refreshTimer) clearTimeout(refreshTimer)
  refreshTimer = setTimeout(() => {
    if (auth.isAuthed && !needsCompletion.value) loadInteractions()
  }, 600)
}
function onStorage(e: StorageEvent) {
  // useTrack buffers every event in localStorage (bm_events_v1); a write from
  // another tab on this device means new activity -> refresh live.
  if (e.key === 'bm_events_v1' || e.key === null) onTrackRefresh()
}
function onVisibility() {
  if (document.visibilityState === 'visible') onTrackRefresh()
}
let autoRefresh: ReturnType<typeof setInterval> | null = null

onMounted(fillForm)
watch(() => auth.isAuthed, (v) => { if (v) { fillForm(); loadInteractions() } }, { immediate: true })

function timeAgo(isoOrTs: string | number): string {
  const t = typeof isoOrTs === 'number' ? isoOrTs : new Date(isoOrTs).getTime()
  const diff = Date.now() - t
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'à l\'instant'
  if (mins < 60) return `il y a ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `il y a ${hours} h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `il y a ${days} j`
  return new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

const eventLabel: Record<string, string> = {
  view: 'a consulté',
  click: 'a précommandé via WhatsApp',
  like: 'a aimé',
  unlike: 'a retiré son like',
  share: 'a partagé',
  copy: 'a copié le lien',
  comment: 'a commenté',
}

const avatarUrl = computed(() => themedAvatarUri(auth.user?.picture || '', isLight.value))
const displayName = computed(() => auth.user?.pseudo || auth.user?.name || 'Client BLACK MARKET')
const initials = computed(() => displayName.value.slice(0, 2).toUpperCase())
const currentMood = computed(() => moodOf(auth.user?.mood))
const productUrl = (id?: string) => (id ? `/p/${id}.html` : '/')

// ---- CRUD: delete your own interactions ----
const deleting = ref<string | null>(null)
const editingId = ref<string | null>(null)
const editingText = ref('')
const savingEdit = ref(false)
const editError = ref('')

async function deleteOwnComment(id: string) {
  if (!window.confirm('Supprimer définitivement ce commentaire ?')) return
  deleting.value = id
  try {
    await auth.api('/api/me/comments/' + encodeURIComponent(id), { method: 'DELETE' })
    if (data.value) data.value.comments = data.value.comments.filter((c) => c.id !== id)
    window.dispatchEvent(new CustomEvent('bm:track', { detail: { type: 'comment' } }))
  } catch (e: any) {
    window.alert(e?.message || 'Impossible de supprimer le commentaire.')
  } finally {
    deleting.value = null
  }
}

function startEditComment(c: CommentItem) {
  editingId.value = c.id
  editingText.value = c.text
  editError.value = ''
}

function cancelEditComment() {
  editingId.value = null
  editingText.value = ''
  editError.value = ''
}

const editingComment = computed(() => data.value?.comments.find((c) => c.id === editingId.value) || null)

async function saveEditComment(id: string) {
  const text = editingText.value.trim()
  if (!text) return
  savingEdit.value = true
  editError.value = ''
  try {
    const res = await auth.api('/api/me/comments/' + encodeURIComponent(id), {
      method: 'PUT',
      body: JSON.stringify({ text }),
    })
    if (data.value) {
      const idx = data.value.comments.findIndex((c) => c.id === id)
      if (idx >= 0) {
        data.value.comments[idx].text = res.comment?.text || text
        data.value.comments[idx].editedAt = res.comment?.editedAt || new Date().toISOString()
      }
    }
    editingId.value = null
    editingText.value = ''
    window.dispatchEvent(new CustomEvent('bm:track', { detail: { type: 'comment' } }))
  } catch (e: any) {
    editError.value = e?.message || 'Impossible de modifier le commentaire.'
  } finally {
    savingEdit.value = false
  }
}

async function deleteOwnEvent(ts: number) {
  if (!window.confirm('Retirer cette activité de votre historique ?')) return
  deleting.value = 'e' + ts
  try {
    await auth.api('/api/me/events/' + encodeURIComponent(String(ts)), { method: 'DELETE' })
    if (data.value) {
      const rm = (arr: EventItem[]) => arr.filter((e) => e.ts !== ts)
      data.value.events = rm(data.value.events)
      data.value.activity.views = rm(data.value.activity.views)
      data.value.activity.likes = rm(data.value.activity.likes)
      data.value.activity.shares = rm(data.value.activity.shares)
      data.value.activity.others = rm(data.value.activity.others)
    }
  } catch (e: any) {
    window.alert(e?.message || 'Impossible de retirer cet événement.')
  } finally {
    deleting.value = null
  }
}

function unlikeProduct(productId: string) {
  like({ id: productId }, false)
  inter.toggleLike(productId)
  if (data.value) {
    data.value.liked = data.value.liked.filter((l) => l.productId !== productId)
    data.value.stats.likes = Math.max(0, data.value.stats.likes - 1)
  }
  loadInteractions()
}

// ---- activity tabs: categories + "voir plus" (9 first) ----
type CatKey = 'views' | 'likes' | 'shares' | 'comments' | 'orders' | 'others'
const PAGE = 9
const CATEGORIES: { key: CatKey; label: string; icon: string }[] = [
  { key: 'views', label: 'Pages consultées', icon: 'eye' },
  { key: 'likes', label: 'Likes', icon: 'heart' },
  { key: 'shares', label: 'Partages', icon: 'share' },
  { key: 'comments', label: 'Commentaires', icon: 'comment' },
  { key: 'orders', label: 'Commandes', icon: 'cart' },
  { key: 'others', label: 'Autres réactions', icon: 'sparkles' },
]
const activeCat = ref<CatKey>('views')
const shown = reactive<Record<CatKey, number>>({ views: PAGE, likes: PAGE, shares: PAGE, comments: PAGE, orders: PAGE, others: PAGE })

function catIcon(key: CatKey): string {
  return CATEGORIES.find((c) => c.key === key)?.icon || 'sparkles'
}

function catItems(key: CatKey): any[] {
  const d = data.value
  if (!d || !d.activity) return []
  if (key === 'comments') return d.comments
  if (key === 'orders') return d.orders
  if (key === 'views') return d.activity.views
  if (key === 'likes') return d.activity.likes
  if (key === 'shares') return d.activity.shares
  return d.activity.others
}

function visibleItems(key: CatKey): any[] {
  return catItems(key).slice(0, shown[key])
}

function showMore(key: CatKey) {
  shown[key] = Math.min(catItems(key).length, shown[key] + PAGE)
}

function showLess(key: CatKey) {
  shown[key] = PAGE
}

const catList = computed(() =>
  CATEGORIES.map((c) => ({ ...c, count: catItems(c.key).length })),
)

const totalActivity = computed(() => {
  const d = data.value
  if (!d || !d.activity) return 0
  return d.comments.length + d.orders.length
    + d.activity.views.length + d.activity.likes.length + d.activity.shares.length + d.activity.others.length
})
</script>

<template>
  <div class="max-w-[900px] mx-auto px-4 py-8" v-if="auth.isAuthed">
    <!-- NOT COMPLETE: ask for WhatsApp to activate the space -->
    <div v-if="needsCompletion" class="max-w-md mx-auto">
      <div class="bg-[#12121a] border border-zinc-800 rounded-2xl p-6">
        <div class="flex items-center gap-3 mb-4">
          <img v-if="avatarUrl" :src="avatarUrl" alt="avatar" class="w-12 h-12 rounded-full object-cover border border-zinc-700" />
          <div v-else class="w-12 h-12 rounded-full bg-[#ff2a2a]/15 border border-[#ff2a2a]/40 flex items-center justify-center text-[#ff2a2a] font-black">{{ initials }}</div>
          <div>
            <h1 class="text-base font-extrabold text-slate-100 font-mono uppercase">Activez votre espace client</h1>
            <p class="text-[11px] text-zinc-500 font-mono mt-0.5">Complétez votre numéro WhatsApp pour débloquer votre espace.</p>
          </div>
        </div>

        <div class="space-y-3">
          <div>
            <label class="text-[9px] text-zinc-500 font-mono uppercase tracking-widest">Pseudo (optionnel)</label>
            <input v-model="pseudo" type="text" placeholder="Votre pseudonyme" class="mt-1 w-full bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 font-mono focus:outline-none focus:border-[#ff2a2a]/60 transition-colors" />
          </div>

          <div>
            <label class="text-[9px] text-zinc-500 font-mono uppercase tracking-widest">Pays</label>
            <div class="relative mt-1">
              <button type="button" @click="showCountry = !showCountry" class="w-full flex items-center justify-between bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 font-mono hover:border-zinc-600 transition-colors">
                <span v-if="selectedCountry">{{ selectedCountry.flag }} {{ selectedCountry.name }} {{ selectedCountry.prefix }}</span>
                <span class="text-zinc-500 text-[10px]">▼</span>
              </button>
              <div v-if="showCountry" class="absolute z-20 w-full mt-1 bg-[#1a1a24] border border-zinc-700 rounded-xl overflow-hidden shadow-2xl">
                <input v-model="countrySearch" placeholder="Rechercher un pays…" class="w-full bg-black/30 border-b border-zinc-800 px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none" />
                <div class="max-h-48 overflow-y-auto">
                  <button v-for="c in filteredCountries" :key="c.code" type="button" @click="pickCountry(c)" class="w-full text-left px-3 py-2 text-xs text-slate-300 font-mono hover:bg-[#ff2a2a]/10 transition-colors">
                    {{ c.flag }} {{ c.name }} <span class="text-zinc-500">{{ c.prefix }}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label class="text-[9px] text-zinc-500 font-mono uppercase tracking-widest">Avatar (choisissez un animal)</label>
            <div class="grid grid-cols-5 sm:grid-cols-6 gap-1.5 mt-2">
              <button v-for="a in ANIMAL_AVATARS" :key="a.key" type="button"
                class="aspect-square rounded-xl overflow-hidden border transition-all"
                :class="selectedAvatar === a.key ? 'border-[#ff2a2a] ring-2 ring-[#ff2a2a]/40' : 'border-zinc-800 hover:border-zinc-600'"
                :title="a.label" @click="selectedAvatar = a.key === selectedAvatar ? '' : a.key">
                <img :src="avatarDataUri(a.key, isLight.value)" :alt="a.label" class="w-full h-full object-cover" />
              </button>
            </div>
            <label class="inline-flex items-center gap-1.5 mt-2 text-[10px] font-mono text-zinc-400 hover:text-white cursor-pointer transition-colors">
              <AppIcon name="plus" :size="12" /> Photo manuelle
              <input type="file" accept="image/*" class="hidden" @change="onAvatarFile" />
            </label>
          </div>

          <div>
            <label class="text-[9px] text-zinc-500 font-mono uppercase tracking-widest">Humeur (optionnel)</label>
            <div class="flex flex-wrap gap-1.5 mt-2">
              <button v-for="m in MOODS" :key="m.emoji" type="button"
                class="w-9 h-9 rounded-xl border text-lg flex items-center justify-center transition-all"
                :class="mood === m.emoji ? 'bg-[#ff2a2a]/20 border-[#ff2a2a]/60 scale-110' : 'bg-black/30 border-zinc-800 hover:border-zinc-600'"
                :title="m.label" @click="mood = mood === m.emoji ? '' : m.emoji">{{ m.emoji }}</button>
            </div>
          </div>

          <div>
            <label class="text-[9px] text-zinc-500 font-mono uppercase tracking-widest">Numéro WhatsApp *</label>
            <div class="flex gap-1.5 mt-1">
              <span class="shrink-0 bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-slate-300 font-mono">{{ prefix }}</span>
              <input v-model="phoneNumber" type="tel" inputmode="numeric" placeholder="Numéro WhatsApp"
                class="flex-1 bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 font-mono focus:outline-none focus:border-[#ff2a2a]/60 transition-colors" />
            </div>
          </div>

          <p v-if="error" class="text-[11px] text-[#ff2a2a] font-mono">{{ error }}</p>
          <p v-if="ok" class="text-[11px] text-emerald-400 font-mono">{{ ok }}</p>

          <div class="flex gap-2">
            <button @click="saveProfile" :disabled="saving" class="flex-1 bg-[#ff2a2a] hover:bg-red-600 text-white font-bold text-sm px-4 py-3 rounded-xl transition-all font-mono disabled:opacity-50">
              {{ saving ? '…' : 'Activer mon espace' }}
            </button>
            <NuxtLink to="/" class="inline-flex items-center justify-center gap-1.5 border border-zinc-800 hover:border-[#ff2a2a]/60 hover:text-white text-zinc-400 text-[11px] font-mono px-4 py-3 rounded-xl transition-all" title="Retour à l'accueil">
              <AppIcon name="chevronLeft" :size="14" /> Accueil
            </NuxtLink>
          </div>
        </div>
      </div>
    </div>

    <!-- CLIENT SPACE -->
    <template v-else>
      <NuxtLink to="/" class="inline-flex items-center gap-1 text-[10px] font-mono text-zinc-400 hover:text-[#ff2a2a] border border-zinc-800 px-3 py-1.5 rounded-lg mb-6 transition-all">← RETOUR AU CATALOGUE</NuxtLink>

      <!-- Profile header -->
      <div class="bg-[#12121a] border border-zinc-800 rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-5">
        <div class="relative">
          <img v-if="avatarUrl" :src="avatarUrl" alt="avatar" class="w-20 h-20 rounded-full object-cover border-2 border-[#ff2a2a]/50" />
          <div v-else class="w-20 h-20 rounded-full bg-[#ff2a2a]/15 border-2 border-[#ff2a2a]/50 flex items-center justify-center text-[#ff2a2a] font-black text-xl">{{ initials }}</div>
          <label class="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#ff2a2a] hover:bg-red-600 flex items-center justify-center cursor-pointer border border-black" title="Changer la photo">
            <AppIcon name="edit" :size="12" />
            <input type="file" accept="image/*" class="hidden" @change="onAvatarFile" />
          </label>
        </div>
        <div class="flex-1 text-center sm:text-left min-w-0">
          <h1 class="text-lg font-extrabold text-slate-100 font-mono">{{ displayName }} <StaffBadge :role="auth.role" /><span v-if="currentMood" :title="currentMood.label" class="align-middle">{{ currentMood.emoji }}</span></h1>
          <p class="text-[11px] text-zinc-400 font-mono">{{ auth.user?.email || '—' }}</p>
          <p class="text-[11px] text-zinc-500 font-mono mt-1">
            {{ auth.user?.phone ? (auth.user.phonePrefix || '') + ' ' + auth.user.phone : '—' }}
            <span v-if="auth.user?.country"> · {{ auth.user.country }}</span>
          </p>
          <p class="text-[10px] text-zinc-600 font-mono mt-1">Membre depuis {{ auth.user?.createdAt ? new Date(auth.user.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—' }}</p>
        </div>
        <div class="flex flex-col gap-2">
          <button @click="openEdit" class="text-[10px] font-mono text-zinc-300 hover:text-white border border-zinc-800 hover:border-[#ff2a2a]/60 px-3 py-2 rounded-xl transition-all inline-flex items-center gap-1.5">
            <AppIcon name="edit" :size="13" /> Modifier
          </button>
        </div>
      </div>

      <!-- Stats -->
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6" v-if="data">
        <div class="bg-black/30 border border-zinc-900 rounded-xl p-3 text-center">
          <p class="text-xl font-black text-[#ff2a2a] font-mono">{{ data.stats.comments }}</p>
          <p class="text-[9px] text-zinc-500 font-mono uppercase tracking-widest mt-1">Commentaires</p>
        </div>
        <div class="bg-black/30 border border-zinc-900 rounded-xl p-3 text-center">
          <p class="text-xl font-black text-[#ff2a2a] font-mono">{{ data.stats.likes }}</p>
          <p class="text-[9px] text-zinc-500 font-mono uppercase tracking-widest mt-1">Likes</p>
        </div>
        <div class="bg-black/30 border border-zinc-900 rounded-xl p-3 text-center">
          <p class="text-xl font-black text-[#ff2a2a] font-mono">{{ data.stats.views }}</p>
          <p class="text-[9px] text-zinc-500 font-mono uppercase tracking-widest mt-1">Vues</p>
        </div>
        <div class="bg-black/30 border border-zinc-900 rounded-xl p-3 text-center">
          <p class="text-xl font-black text-[#ff2a2a] font-mono">{{ data.stats.clicks }}</p>
          <p class="text-[9px] text-zinc-500 font-mono uppercase tracking-widest mt-1">Précommandes</p>
        </div>
        <div class="bg-black/30 border border-zinc-900 rounded-xl p-3 text-center">
          <p class="text-xl font-black text-[#ff2a2a] font-mono">{{ data.stats.shares }}</p>
          <p class="text-[9px] text-zinc-500 font-mono uppercase tracking-widest mt-1">Partages</p>
        </div>
        <div class="bg-black/30 border border-zinc-900 rounded-xl p-3 text-center">
          <p class="text-xl font-black text-[#ff2a2a] font-mono">{{ data.stats.orders }}</p>
          <p class="text-[9px] text-zinc-500 font-mono uppercase tracking-widest mt-1">Commandes</p>
        </div>
      </div>

      <!-- Liked products -->
      <div v-if="data && data.liked.length" class="mt-8">
        <p class="text-[9px] text-[#ff2a2a] font-mono uppercase font-bold tracking-wider mb-3">PRODUITS QUE VOUS AIMEZ ({{ data.stats.likes }})</p>
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <div v-for="l in data.liked" :key="'L' + l.productId" class="relative">
            <NuxtLink :to="productUrl(l.productId)"
              class="block bg-black/30 border border-zinc-900 rounded-xl overflow-hidden hover:border-[#ff2a2a]/40 transition-all group">
              <img v-if="l.productImage" :src="l.productImage" alt="" class="w-full h-24 object-cover" />
              <div v-else class="w-full h-24 bg-[#16161d] flex items-center justify-center text-[#ff2a2a]">
                <AppIcon name="heart" :size="20" />
              </div>
              <p class="text-[10px] font-mono text-slate-300 px-2 py-2 truncate">{{ l.productTitle || 'Produit' }}</p>
            </NuxtLink>
            <button @click.stop="unlikeProduct(l.productId)"
              class="absolute top-1.5 right-1.5 w-10 h-10 rounded-full bg-black/70 hover:bg-[#ff2a2a] border border-white/20 text-[#ff2a2a] hover:text-white flex items-center justify-center transition-all"
              title="Retirer le like">
              <AppIcon name="heart" :size="13" />
            </button>
          </div>
        </div>
      </div>

      <!-- Edit profile modal -->
      <Teleport to="body">
        <div v-if="editOpen" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
          <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" @click="editOpen = false" />
          <div class="relative w-full sm:max-w-md bg-[#12121a] border border-zinc-800 sm:rounded-3xl rounded-t-3xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
            <div class="flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-[#0d0d14] shrink-0">
              <p class="text-sm font-extrabold text-white font-mono uppercase tracking-widest">Modifier mon profil</p>
              <button @click="editOpen = false" aria-label="Fermer" class="w-10 h-10 rounded-lg border border-zinc-800 flex items-center justify-center text-zinc-300 hover:text-white hover:border-[#ff2a2a]/50 transition-all">✕</button>
            </div>

            <div class="flex-1 overflow-y-auto p-5 space-y-4">
              <div class="flex items-center gap-3">
                <div class="relative shrink-0">
                  <img v-if="avatarUrl" :src="avatarUrl" alt="avatar" class="w-16 h-16 rounded-full object-cover border-2 border-[#ff2a2a]/50" />
                  <div v-else class="w-16 h-16 rounded-full bg-[#ff2a2a]/15 border-2 border-[#ff2a2a]/50 flex items-center justify-center text-[#ff2a2a] font-black text-lg">{{ initials }}</div>
                  <label class="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#ff2a2a] hover:bg-red-600 flex items-center justify-center cursor-pointer border border-black" title="Téléverser une photo">
                    <AppIcon name="edit" :size="11" />
                    <input type="file" accept="image/*" class="hidden" @change="onAvatarFile" />
                  </label>
                </div>
                <p class="text-[10px] font-mono text-zinc-500 leading-relaxed">Avatar : choisissez un animal par défaut ou téléversez votre propre photo.</p>
              </div>

              <div>
                <label class="text-[9px] text-zinc-500 font-mono uppercase tracking-widest">Avatar animal</label>
                <div class="grid grid-cols-5 sm:grid-cols-6 gap-1.5 mt-2">
                  <button v-for="a in ANIMAL_AVATARS" :key="a.key" type="button"
                    class="aspect-square rounded-xl overflow-hidden border transition-all"
                    :class="selectedAvatar === a.key ? 'border-[#ff2a2a] ring-2 ring-[#ff2a2a]/40' : 'border-zinc-800 hover:border-zinc-600'"
                    :title="a.label" @click="selectedAvatar = a.key === selectedAvatar ? '' : a.key">
                    <img :src="avatarDataUri(a.key, isLight.value)" :alt="a.label" class="w-full h-full object-cover" />
                  </button>
                </div>
              </div>

              <div>
                <label class="text-[9px] text-zinc-500 font-mono uppercase tracking-widest">Pseudo</label>
                <input v-model="pseudo" type="text" placeholder="Votre pseudonyme" class="mt-1 w-full bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 font-mono focus:outline-none focus:border-[#ff2a2a]/60 transition-colors" />
              </div>

              <div>
                <label class="text-[9px] text-zinc-500 font-mono uppercase tracking-widest">Nom & prénom (optionnel)</label>
                <input v-model="name" type="text" placeholder="Nom & prénom" class="mt-1 w-full bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 font-mono focus:outline-none focus:border-[#ff2a2a]/60 transition-colors" />
              </div>

              <div>
                <label class="text-[9px] text-zinc-500 font-mono uppercase tracking-widest">Humeur</label>
                <div class="flex flex-wrap gap-1.5 mt-2">
                  <button v-for="m in MOODS" :key="m.emoji" type="button"
                    class="w-9 h-9 rounded-xl border text-lg flex items-center justify-center transition-all"
                    :class="mood === m.emoji ? 'bg-[#ff2a2a]/20 border-[#ff2a2a]/60 scale-110' : 'bg-black/30 border-zinc-800 hover:border-zinc-600'"
                    :title="m.label" @click="mood = mood === m.emoji ? '' : m.emoji">{{ m.emoji }}</button>
                </div>
              </div>

              <div>
                <label class="text-[9px] text-zinc-500 font-mono uppercase tracking-widest">Pays</label>
                <div class="relative mt-1">
                  <button type="button" @click="showCountry = !showCountry" class="w-full flex items-center justify-between bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 font-mono hover:border-zinc-600 transition-colors">
                    <span v-if="selectedCountry">{{ selectedCountry.flag }} {{ selectedCountry.name }} {{ selectedCountry.prefix }}</span>
                    <span class="text-zinc-500 text-[10px]">▼</span>
                  </button>
                  <div v-if="showCountry" class="absolute z-20 w-full mt-1 bg-[#1a1a24] border border-zinc-700 rounded-xl overflow-hidden shadow-2xl">
                    <input v-model="countrySearch" placeholder="Rechercher un pays…" class="w-full bg-black/30 border-b border-zinc-800 px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none" />
                    <div class="max-h-44 overflow-y-auto">
                      <button v-for="c in filteredCountries" :key="c.code" type="button" @click="pickCountry(c)" class="w-full text-left px-3 py-2 text-xs text-slate-300 font-mono hover:bg-[#ff2a2a]/10 transition-colors">
                        {{ c.flag }} {{ c.name }} <span class="text-zinc-500">{{ c.prefix }}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label class="text-[9px] text-zinc-500 font-mono uppercase tracking-widest">Numéro WhatsApp</label>
                <div class="flex gap-1.5 mt-1">
                  <span class="shrink-0 bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-slate-300 font-mono">{{ prefix }}</span>
                  <input v-model="phoneNumber" type="tel" inputmode="numeric" placeholder="Numéro WhatsApp" class="flex-1 bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 font-mono focus:outline-none focus:border-[#ff2a2a]/60 transition-colors" />
                </div>
              </div>

              <p v-if="error" class="text-[11px] text-[#ff2a2a] font-mono">{{ error }}</p>
              <p v-if="ok" class="text-[11px] text-emerald-400 font-mono">{{ ok }}</p>
            </div>

            <div class="border-t border-zinc-800 bg-[#0d0d14] px-5 py-4 flex items-center gap-2 shrink-0">
              <button @click="editOpen = false" class="flex-1 text-[11px] font-mono text-zinc-400 hover:text-white border border-zinc-800 px-4 py-2.5 rounded-xl transition-all">Annuler</button>
              <button @click="saveProfile" :disabled="saving" class="flex-1 bg-[#ff2a2a] hover:bg-red-600 text-white text-xs font-bold font-mono px-4 py-2.5 rounded-xl transition-all disabled:opacity-50">{{ saving ? '…' : 'Enregistrer' }}</button>
            </div>
          </div>
        </div>
      </Teleport>

      <!-- Edit comment modal -->
      <Teleport to="body">
        <div v-if="editingId" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
          <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" @click="cancelEditComment" />
          <div class="relative w-full sm:max-w-md bg-[#12121a] border border-zinc-800 sm:rounded-3xl rounded-t-3xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
            <div class="flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-[#0d0d14] shrink-0">
              <p class="text-sm font-extrabold text-white font-mono uppercase tracking-widest">Modifier le commentaire</p>
              <button @click="cancelEditComment" aria-label="Fermer" class="w-10 h-10 rounded-lg border border-zinc-800 flex items-center justify-center text-zinc-300 hover:text-white hover:border-[#ff2a2a]/50 transition-all">✕</button>
            </div>

            <div class="flex-1 overflow-y-auto p-5 space-y-4">
              <div class="flex items-center gap-3 bg-black/30 border border-zinc-900 rounded-xl p-3">
                <img v-if="editingComment?.productImage" :src="editingComment.productImage" alt="" class="w-11 h-11 rounded-lg object-cover border border-zinc-800 shrink-0" />
                <div v-else class="w-11 h-11 rounded-lg bg-[#16161d] border border-zinc-800 flex items-center justify-center text-[#ff2a2a] shrink-0">
                  <AppIcon name="comment" :size="14" />
                </div>
                <div class="min-w-0">
                  <p class="text-[11px] font-mono text-zinc-300 truncate">{{ editingComment?.productTitle || 'Produit' }}</p>
                  <p class="text-[9px] font-mono text-zinc-600">{{ editingComment ? timeAgo(editingComment.createdAt) : '' }}</p>
                </div>
              </div>

              <div>
                <label class="text-[9px] text-zinc-500 font-mono uppercase tracking-widest">Votre commentaire</label>
                <textarea v-model="editingText" rows="4" maxlength="1000" placeholder="Votre commentaire…"
                  class="mt-1 w-full bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 font-mono focus:outline-none focus:border-[#ff2a2a]/60 transition-colors resize-none" />
                <div class="flex items-center justify-between mt-1">
                  <p v-if="editError" class="text-[11px] text-[#ff2a2a] font-mono">{{ editError }}</p>
                  <p class="text-[9px] font-mono text-zinc-600 ml-auto">{{ editingText.length }}/1000</p>
                </div>
              </div>
            </div>

            <div class="border-t border-zinc-800 bg-[#0d0d14] px-5 py-4 flex items-center gap-2 shrink-0">
              <button @click="cancelEditComment" class="flex-1 text-[11px] font-mono text-zinc-400 hover:text-white border border-zinc-800 px-4 py-2.5 rounded-xl transition-all">Annuler</button>
              <button @click="saveEditComment(editingId!)" :disabled="savingEdit || !editingText.trim()" class="flex-1 bg-[#ff2a2a] hover:bg-red-600 text-white text-xs font-bold font-mono px-4 py-2.5 rounded-xl transition-all disabled:opacity-50">{{ savingEdit ? '…' : 'Enregistrer' }}</button>
            </div>
          </div>
        </div>
      </Teleport>

      <!-- Interactions -->
      <div class="mt-8">
        <p class="text-[9px] text-[#ff2a2a] font-mono uppercase font-bold tracking-wider mb-3">VOTRE ACTIVITÉ SUR BLACK MARKET</p>

        <div v-if="loadingData" class="space-y-3">
          <div v-for="n in 3" :key="n" class="skeleton h-16 rounded-xl" />
        </div>

        <template v-else-if="data">
          <div v-if="totalActivity === 0" class="text-center py-10 text-zinc-600 font-mono text-[11px]">
            AUCUNE ACTIVITÉ POUR L'INSTANT — PARCOUREZ LE CATALOGUE !
          </div>

          <div v-else>
            <!-- Category tabs -->
            <div class="flex flex-wrap gap-1.5 mb-4">
              <button v-for="c in catList" :key="c.key" @click="activeCat = c.key"
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-mono uppercase tracking-wider transition-all"
                :class="activeCat === c.key
                  ? 'bg-[#ff2a2a] border-[#ff2a2a] text-white font-bold'
                  : 'bg-black/30 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600'">
                <AppIcon :name="c.icon" :size="12" />
                <span>{{ c.label }}</span>
                <span v-if="c.count" class="px-1.5 rounded bg-white/10">{{ c.count }}</span>
              </button>
            </div>

            <div class="space-y-2">
              <!-- Event categories: views / likes / shares / others -->
              <template v-if="activeCat === 'views' || activeCat === 'likes' || activeCat === 'shares' || activeCat === 'others'">
                <div v-if="visibleItems(activeCat).length === 0" class="text-center py-8 text-zinc-600 font-mono text-[11px]">
                  AUCUNE ACTIVITÉ DE CE TYPE POUR L'INSTANT.
                </div>
                <div v-for="e in visibleItems(activeCat)" :key="'e' + e.ts" class="flex items-center gap-3 bg-black/30 border border-zinc-900 rounded-xl p-3">
                  <NuxtLink :to="productUrl(e.productId)">
                    <img v-if="e.productImage" :src="e.productImage" alt="" class="w-11 h-11 rounded-lg object-cover border border-zinc-800 shrink-0" />
                    <div v-else class="w-11 h-11 rounded-lg bg-[#16161d] border border-zinc-800 flex items-center justify-center text-[#ff2a2a]">
                      <AppIcon :name="catIcon(activeCat)" :size="14" />
                    </div>
                  </NuxtLink>
                  <div class="flex-1 min-w-0">
                    <p class="text-xs text-zinc-300">Vous <StaffBadge :role="e.role || auth.role" /> <span class="text-slate-100 font-bold">{{ eventLabel[e.type] || 'avez interagi avec' }}</span>
                      <NuxtLink :to="productUrl(e.productId)" class="text-[#ff2a2a] hover:underline">{{ e.productTitle || 'un produit' }}</NuxtLink>
                    </p>
                    <p class="text-[10px] text-zinc-500 font-mono mt-0.5">{{ timeAgo(e.ts) }}</p>
                  </div>
                  <button @click="deleteOwnEvent(e.ts)" :disabled="deleting === 'e' + e.ts"
                class="shrink-0 w-10 h-10 rounded-lg border border-zinc-800 hover:border-red-500/60 text-zinc-500 hover:text-red-400 flex items-center justify-center transition-all disabled:opacity-40"
                title="Retirer de mon historique">
                    <AppIcon name="trash" :size="13" />
                  </button>
                </div>
              </template>

              <!-- Comments -->
              <template v-else-if="activeCat === 'comments'">
                <div v-if="visibleItems('comments').length === 0" class="text-center py-8 text-zinc-600 font-mono text-[11px]">
                  AUCUN COMMENTAIRE POSTÉ POUR L'INSTANT.
                </div>
                <div v-for="c in visibleItems('comments')" :key="'c' + c.id" class="flex items-center gap-3 bg-black/30 border border-zinc-900 rounded-xl p-3">
                  <NuxtLink :to="productUrl(c.productId)">
                    <img v-if="c.productImage" :src="c.productImage" alt="" class="w-11 h-11 rounded-lg object-cover border border-zinc-800 shrink-0" />
                    <div v-else class="w-11 h-11 rounded-lg bg-[#16161d] border border-zinc-800 flex items-center justify-center text-[#ff2a2a]">
                      <AppIcon name="comment" :size="14" />
                    </div>
                  </NuxtLink>
                  <div class="flex-1 min-w-0">
                    <p class="text-xs text-zinc-300"><span class="text-slate-100 font-bold">Vous avez commenté</span> <StaffBadge :role="c.role || auth.role" /> {{ c.text }}</p>
                    <NuxtLink :to="productUrl(c.productId)" class="text-[10px] text-zinc-500 font-mono hover:text-[#ff2a2a] transition-colors">{{ c.productTitle || 'Produit' }} · {{ timeAgo(c.createdAt) }}<span v-if="c.editedAt" class="text-zinc-500 italic"> · modifié</span></NuxtLink>
                    <div class="flex items-center gap-3 mt-1.5">
                      <span class="inline-flex items-center gap-1 text-[10px] font-mono text-zinc-500"><AppIcon name="thumbsUp" :size="11" /> {{ c.likes || 0 }}</span>
                      <span class="inline-flex items-center gap-1 text-[10px] font-mono text-zinc-500"><AppIcon name="thumbsDown" :size="11" /> {{ c.dislikes || 0 }}</span>
                      <span v-if="c.reports" class="inline-flex items-center gap-1 text-[10px] font-mono text-amber-400/80"><AppIcon name="flag" :size="11" /> {{ c.reports }}</span>
                    </div>
                  </div>
                  <div class="flex flex-col gap-1.5 shrink-0">
                    <button @click="startEditComment(c)"
                    class="w-10 h-10 rounded-lg border border-zinc-800 hover:border-sky-500/60 text-zinc-500 hover:text-sky-400 flex items-center justify-center transition-all"
                    title="Modifier ce commentaire">
                      <AppIcon name="edit" :size="13" />
                    </button>
                    <button @click="deleteOwnComment(c.id)" :disabled="deleting === c.id"
                    class="w-10 h-10 rounded-lg border border-zinc-800 hover:border-red-500/60 text-zinc-500 hover:text-red-400 flex items-center justify-center transition-all disabled:opacity-40"
                    title="Supprimer ce commentaire">
                      <AppIcon name="trash" :size="13" />
                    </button>
                  </div>
                </div>
              </template>

              <!-- Orders -->
              <template v-else>
                <div v-if="visibleItems('orders').length === 0" class="text-center py-8 text-zinc-600 font-mono text-[11px]">
                  AUCUNE COMMANDE POUR L'INSTANT.
                </div>
                <div v-for="o in visibleItems('orders')" :key="'o' + o.id" class="flex items-center gap-3 bg-black/30 border border-zinc-900 rounded-xl p-3">
                  <img v-if="o.productImage" :src="o.productImage" alt="" class="w-11 h-11 rounded-lg object-cover border border-zinc-800 shrink-0" />
                  <div v-else class="w-11 h-11 rounded-lg bg-[#16161d] border border-zinc-800 flex items-center justify-center text-[#ff2a2a]">
                    <AppIcon name="cart" :size="14" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-xs font-bold text-slate-200 truncate">Commande — {{ o.productTitle || o.id }}</p>
                    <p class="text-[10px] text-zinc-500 font-mono mt-0.5">x{{ o.quantity }} · {{ o.priceXof ? o.priceXof.toLocaleString('fr-FR') + ' F CFA' : '' }} · {{ timeAgo(o.createdAt) }}</p>
                  </div>
                  <span class="text-[9px] font-mono uppercase tracking-widest px-2 py-1 rounded border" :class="o.status === 'completed' ? 'text-emerald-400 border-emerald-500/30' : o.status === 'cancelled' ? 'text-red-400 border-red-500/30' : 'text-amber-400 border-amber-500/30'">{{ o.status }}</span>
                </div>
              </template>

              <!-- Voir plus / moins -->
              <div v-if="catItems(activeCat).length > shown[activeCat]" class="flex justify-center pt-1">
                <button @click="showMore(activeCat)"
                  class="text-[10px] font-mono text-zinc-400 hover:text-white border border-zinc-800 hover:border-[#ff2a2a]/50 px-4 py-2 rounded-xl transition-all inline-flex items-center gap-1.5">
                  <AppIcon name="chevronDown" :size="12" /> VOIR PLUS ({{ catItems(activeCat).length - shown[activeCat] }})
                </button>
              </div>
              <div v-else-if="catItems(activeCat).length > PAGE" class="flex justify-center pt-1">
                <button @click="showLess(activeCat)"
                  class="text-[10px] font-mono text-zinc-500 hover:text-white border border-zinc-800 px-4 py-2 rounded-xl transition-all inline-flex items-center gap-1.5">
                  <AppIcon name="chevronUp" :size="12" /> VOIR MOINS
                </button>
              </div>
            </div>
          </div>
        </template>
      </div>
    </template>
  </div>
  <div v-else class="max-w-[900px] mx-auto px-4 py-20 text-center text-zinc-600 font-mono text-xs">
    REDIRECTION VERS L'ESPACE CLIENT…
  </div>
</template>
