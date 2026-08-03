<script setup lang="ts">
import { COUNTRIES, countryByCode, type Country } from '~/data/countries'
import { useAuthStore } from '~/stores/auth'

useSeoMeta({ title: 'Mon espace — BLACK MARKET' })

const auth = useAuthStore()
const config = useRuntimeConfig()

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
const phoneNumber = ref('')
const prefix = ref<string>(COUNTRIES[0].prefix)
const countryCode = ref<string>(COUNTRIES[0].code)
const countrySearch = ref('')
const showCountry = ref(false)
const saving = ref(false)
const error = ref('')
const ok = ref('')

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
  phoneNumber.value = u?.phone || ''
  if (u?.phonePrefix) prefix.value = u.phonePrefix
  if (u?.country) {
    const c = COUNTRIES.find((x) => x.name === u.country)
    if (c) { countryCode.value = c.code; prefix.value = c.prefix }
  }
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
        phone: phone || undefined,
        phonePrefix: prefix.value,
        country: selectedCountry.value?.name,
      }),
    })
    if (data?.user) auth.updateUser(data.user)
    ok.value = 'Profil enregistré ✓'
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
interface CommentItem { id: string; productId: string; text: string; createdAt: string; productTitle?: string; productImage?: string }
interface EventItem { type: string; productId?: string; productTitle?: string; productImage?: string; ts: number; url?: string }
interface OrderItem { id: string; productTitle?: string; productImage?: string; quantity: number; priceXof: number; status: string; createdAt: string }
interface InteractionsData {
  user?: any
  comments: CommentItem[]
  events: EventItem[]
  orders: OrderItem[]
  stats: { comments: number; likes: number; views: number; clicks: number; shares: number; orders: number }
}

const data = ref<InteractionsData | null>(null)
const loadingData = ref(false)

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

const avatarUrl = computed(() => auth.user?.picture || '')
const displayName = computed(() => auth.user?.pseudo || auth.user?.name || 'Client BLACK MARKET')
const initials = computed(() => displayName.value.slice(0, 2).toUpperCase())
const productUrl = (id?: string) => (id ? `/p/${id}.html` : '/')
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
            <label class="text-[9px] text-zinc-500 font-mono uppercase tracking-widest">Numéro WhatsApp *</label>
            <div class="flex gap-1.5 mt-1">
              <span class="shrink-0 bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-slate-300 font-mono">{{ prefix }}</span>
              <input v-model="phoneNumber" type="tel" inputmode="numeric" placeholder="Numéro WhatsApp"
                class="flex-1 bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 font-mono focus:outline-none focus:border-[#ff2a2a]/60 transition-colors" />
            </div>
          </div>

          <p v-if="error" class="text-[11px] text-[#ff2a2a] font-mono">{{ error }}</p>
          <p v-if="ok" class="text-[11px] text-emerald-400 font-mono">{{ ok }}</p>

          <button @click="saveProfile" :disabled="saving" class="w-full bg-[#ff2a2a] hover:bg-red-600 text-white font-bold text-sm px-4 py-3 rounded-xl transition-all font-mono disabled:opacity-50">
            {{ saving ? '…' : 'Activer mon espace' }}
          </button>
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
          <h1 class="text-lg font-extrabold text-slate-100 font-mono">{{ displayName }}</h1>
          <p class="text-[11px] text-zinc-400 font-mono">{{ auth.user?.email || '—' }}</p>
          <p class="text-[11px] text-zinc-500 font-mono mt-1">
            {{ auth.user?.phone ? (auth.user.phonePrefix || '') + ' ' + auth.user.phone : '—' }}
            <span v-if="auth.user?.country"> · {{ auth.user.country }}</span>
          </p>
          <p class="text-[10px] text-zinc-600 font-mono mt-1">Membre depuis {{ auth.user?.createdAt ? new Date(auth.user.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—' }}</p>
        </div>
        <div class="flex flex-col gap-2">
          <button @click="fillForm" class="text-[10px] font-mono text-zinc-300 hover:text-white border border-zinc-800 hover:border-[#ff2a2a]/60 px-3 py-2 rounded-xl transition-all inline-flex items-center gap-1.5">
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

      <!-- Edit profile inline -->
      <div v-if="editOpen" class="bg-[#12121a] border border-zinc-800 rounded-2xl p-6 mt-6 space-y-3">
        <p class="text-[9px] text-[#ff2a2a] font-mono uppercase font-bold tracking-wider">MODIFIER MON PROFIL</p>
        <input v-model="pseudo" type="text" placeholder="Pseudo" class="w-full bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 font-mono focus:outline-none focus:border-[#ff2a2a]/60 transition-colors" />
        <input v-model="name" type="text" placeholder="Nom & prénom" class="w-full bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 font-mono focus:outline-none focus:border-[#ff2a2a]/60 transition-colors" />
        <div class="flex gap-1.5">
          <span class="shrink-0 bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-slate-300 font-mono">{{ prefix }}</span>
          <input v-model="phoneNumber" type="tel" inputmode="numeric" placeholder="Numéro WhatsApp" class="flex-1 bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 font-mono focus:outline-none focus:border-[#ff2a2a]/60 transition-colors" />
        </div>
        <p v-if="error" class="text-[11px] text-[#ff2a2a] font-mono">{{ error }}</p>
        <p v-if="ok" class="text-[11px] text-emerald-400 font-mono">{{ ok }}</p>
        <div class="flex gap-2">
          <button @click="saveProfile" :disabled="saving" class="flex-1 bg-[#ff2a2a] hover:bg-red-600 text-white font-bold text-sm px-4 py-2.5 rounded-xl transition-all font-mono disabled:opacity-50">{{ saving ? '…' : 'Enregistrer' }}</button>
          <button @click="editOpen = false" class="text-[11px] font-mono text-zinc-400 border border-zinc-800 px-4 py-2.5 rounded-xl transition-all hover:text-white">Annuler</button>
        </div>
      </div>

      <!-- Interactions -->
      <div class="mt-8">
        <p class="text-[9px] text-[#ff2a2a] font-mono uppercase font-bold tracking-wider mb-3">VOTRE ACTIVITÉ SUR BLACK MARKET</p>

        <div v-if="loadingData" class="space-y-3">
          <div v-for="n in 3" :key="n" class="skeleton h-16 rounded-xl" />
        </div>

        <template v-else-if="data">
          <div v-if="data.events.length === 0 && data.comments.length === 0 && data.orders.length === 0" class="text-center py-10 text-zinc-600 font-mono text-[11px]">
            AUCUNE ACTIVITÉ POUR L'INSTANT — PARCOUREZ LE CATALOGUE !
          </div>

          <div v-else class="space-y-2">
            <div v-for="o in data.orders" :key="'o' + o.id" class="flex items-center gap-3 bg-black/30 border border-zinc-900 rounded-xl p-3">
              <img v-if="o.productImage" :src="o.productImage" alt="" class="w-11 h-11 rounded-lg object-cover border border-zinc-800 shrink-0" />
              <div class="flex-1 min-w-0">
                <p class="text-xs font-bold text-slate-200 truncate">Commande — {{ o.productTitle || o.id }}</p>
                <p class="text-[10px] text-zinc-500 font-mono mt-0.5">x{{ o.quantity }} · {{ o.priceXof ? o.priceXof.toLocaleString('fr-FR') + ' F CFA' : '' }} · {{ timeAgo(o.createdAt) }}</p>
              </div>
              <span class="text-[9px] font-mono uppercase tracking-widest px-2 py-1 rounded border" :class="o.status === 'completed' ? 'text-emerald-400 border-emerald-500/30' : o.status === 'cancelled' ? 'text-red-400 border-red-500/30' : 'text-amber-400 border-amber-500/30'">{{ o.status }}</span>
            </div>

            <div v-for="c in data.comments" :key="'c' + c.id" class="flex items-center gap-3 bg-black/30 border border-zinc-900 rounded-xl p-3">
              <NuxtLink :to="productUrl(c.productId)">
                <img v-if="c.productImage" :src="c.productImage" alt="" class="w-11 h-11 rounded-lg object-cover border border-zinc-800 shrink-0" />
              </NuxtLink>
              <div class="flex-1 min-w-0">
                <p class="text-xs text-zinc-300"><span class="text-slate-100 font-bold">Vous avez commenté</span> {{ c.text }}</p>
                <NuxtLink :to="productUrl(c.productId)" class="text-[10px] text-zinc-500 font-mono hover:text-[#ff2a2a] transition-colors">{{ c.productTitle || 'Produit' }} · {{ timeAgo(c.createdAt) }}</NuxtLink>
              </div>
            </div>

            <div v-for="(e, i) in data.events" :key="'e' + i" class="flex items-center gap-3 bg-black/30 border border-zinc-900 rounded-xl p-3">
              <NuxtLink :to="productUrl(e.productId)">
                <img v-if="e.productImage" :src="e.productImage" alt="" class="w-11 h-11 rounded-lg object-cover border border-zinc-800 shrink-0" />
              </NuxtLink>
              <div class="flex-1 min-w-0">
                <p class="text-xs text-zinc-300">Vous <span class="text-slate-100 font-bold">{{ eventLabel[e.type] || 'avez interagi avec' }}</span>
                  <NuxtLink :to="productUrl(e.productId)" class="text-[#ff2a2a] hover:underline">{{ e.productTitle || 'un produit' }}</NuxtLink>
                </p>
                <p class="text-[10px] text-zinc-500 font-mono mt-0.5">{{ timeAgo(e.ts) }}</p>
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
