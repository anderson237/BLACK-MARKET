<script setup lang="ts">
import { COUNTRIES, countryByCode, type Country } from '~/data/countries'
import { useAuthStore } from '~/stores/auth'

const auth = useAuthStore()
const config = useRuntimeConfig()
const googleClientId = config.public.googleClientId as string

const view = ref<'login' | 'register'>('login')
const method = ref<'phone' | 'email'>('phone')

const name = ref('')
const email = ref('')
const password = ref('')
const phoneNumber = ref('')
const prefix = ref<string>(COUNTRIES[0].prefix)
const countryCode = ref<string>(COUNTRIES[0].code)
const countrySearch = ref('')
const showCountry = ref(false)

const submitting = ref(false)
const error = ref('')

const filteredCountries = computed(() => {
  const q = countrySearch.value.trim().toLowerCase()
  if (!q) return COUNTRIES
  return COUNTRIES.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q) || c.prefix.includes(q))
})

const selectedCountry = computed<Country>(() => countryByCode(countryCode.value) || COUNTRIES[0])

async function pickCountry(c: Country) {
  countryCode.value = c.code
  prefix.value = c.prefix
  countrySearch.value = ''
  showCountry.value = false
}

async function submit() {
  submitting.value = true
  error.value = ''
  try {
    if (view.value === 'register') {
      const phone = phoneNumber.value.replace(/[^0-9]/g, '')
      const country = selectedCountry.value?.name
      if (!name.value) throw new Error('Indiquez votre nom.')
      if (!email.value) throw new Error('Adresse email requise.')
      if (!password.value || password.value.length < 6) throw new Error('Mot de passe : 6 caractères minimum.')
      if (phone.length < 6) throw new Error('Numéro WhatsApp invalide.')
      await auth.register(name.value, email.value, password.value, phone, prefix.value, country)
    } else if (method.value === 'phone') {
      const phone = phoneNumber.value.replace(/[^0-9]/g, '')
      const country = selectedCountry.value?.name
      if (phone.length < 6) throw new Error('Numéro de téléphone invalide.')
      // Frictionless login: auto-creates the account (phone-only) if missing.
      await auth.loginPhone(phone, prefix.value, country)
    } else {
      if (!email.value || !password.value) throw new Error('Email et mot de passe requis.')
      await auth.loginEmail(email.value, password.value)
    }
    auth.replayPending()
  } catch (e: any) {
    error.value = e?.message || 'Une erreur est survenue.'
  } finally {
    submitting.value = false
  }
}

// ---- Google Identity Services ----
const gsiWindow = () => window as unknown as { google?: any; __bmGoogleLoading?: boolean }

function loadGoogleScript() {
  if (typeof window === 'undefined') return
  if (gsiWindow().__bmGoogleLoading) return
  gsiWindow().__bmGoogleLoading = true
  const el = document.createElement('script')
  el.src = 'https://accounts.google.com/gsi/client'
  el.async = true
  el.defer = true
  el.onload = () => initGoogle()
  document.head.appendChild(el)
}

function initGoogle() {
  if (!googleClientId || typeof window === 'undefined' || !gsiWindow().google?.accounts?.id) return
  gsiWindow().google.accounts.id.initialize({
    client_id: googleClientId,
    callback: (resp: any) => resp?.credential && onGoogleCredential(resp.credential),
  })
  renderGoogle()
}

function renderGoogle() {
  if (!googleClientId || typeof window === 'undefined' || !gsiWindow().google?.accounts?.id) return
  const target = document.getElementById('bm-google-btn')
  if (!target) return
  gsiWindow().google.accounts.id.renderButton(target, {
    theme: 'filled_black',
    size: 'large',
    shape: 'pill',
    width: 300,
    text: 'continue_with',
  })
}

async function onGoogleCredential(credential: string) {
  submitting.value = true
  error.value = ''
  try {
    await auth.loginGoogle(credential)
    auth.replayPending()
  } catch (e: any) {
    error.value = e?.message || 'Connexion Google échouée.'
  } finally {
    submitting.value = false
  }
}

watch(() => auth.modalOpen, (open) => {
  if (!open) return
  // Reset autofill-agnostic state per open.
  error.value = ''
  if (googleClientId) {
    // Re-initialize the Google button once the DOM is present.
    nextTick(() => {
      if (gsiWindow().google?.accounts?.id) {
        initGoogle()
      } else {
        loadGoogleScript()
      }
    })
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="auth">
      <div v-if="auth.modalOpen" class="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" @click.self="auth.closeModal()">
        <div class="w-full max-w-md bg-[#12121a] border border-zinc-800 rounded-2xl p-6 relative shadow-2xl shadow-black/60 auth-pop">
          <button @click="auth.closeModal()" class="absolute top-3 right-3 text-zinc-500 hover:text-slate-100 w-8 h-8 rounded-lg hover:bg-white/5 transition-colors text-lg leading-none" aria-label="Fermer">✕</button>

          <div class="mb-5">
            <span class="w-9 h-9 rounded-lg bg-[#ff2a2a] flex items-center justify-center text-white font-black text-lg mb-2">B</span>
            <h2 class="text-lg font-extrabold text-slate-100 font-mono tracking-wide uppercase">{{ view === 'login' ? 'Connexion' : 'Inscription' }}</h2>
            <p class="text-[11px] text-zinc-500 font-mono mt-1">{{ auth.pendingAction?.label || 'Accédez à votre compte BLACK MARKET' }}</p>
          </div>

          <!-- Google -->
          <div v-if="googleClientId" class="mb-4">
            <div id="bm-google-btn" class="w-full flex justify-center" />
          </div>

          <div v-if="googleClientId" class="flex items-center gap-3 mb-4">
            <span class="h-px flex-1 bg-zinc-800" /><span class="text-[9px] text-zinc-600 font-mono uppercase">ou</span><span class="h-px flex-1 bg-zinc-800" />
          </div>

          <!-- LOGIN -->
          <template v-if="view === 'login'">
            <!-- Method toggle -->
            <div class="flex gap-1.5 mb-4 bg-black/30 rounded-xl p-1 border border-zinc-800">
              <button @click="method = 'phone'" class="flex-1 py-2 rounded-lg text-[11px] font-bold font-mono uppercase tracking-wider transition-colors" :class="method === 'phone' ? 'bg-[#ff2a2a] text-white' : 'text-zinc-500 hover:text-slate-200'">WhatsApp</button>
              <button @click="method = 'email'" class="flex-1 py-2 rounded-lg text-[11px] font-bold font-mono uppercase tracking-wider transition-colors" :class="method === 'email' ? 'bg-[#ff2a2a] text-white' : 'text-zinc-500 hover:text-slate-200'">Email</button>
            </div>

            <!-- Login: WhatsApp (phone) -->
            <form v-if="method === 'phone'" @submit.prevent="submit" class="space-y-3">
              <!-- Country + phone -->
              <div class="relative">
                <button type="button" @click="showCountry = !showCountry" class="w-full flex items-center justify-between bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 font-mono hover:border-zinc-600 transition-colors">
                  <span v-if="selectedCountry">{{ selectedCountry.flag }} {{ selectedCountry.name }} {{ selectedCountry.prefix }}</span>
                  <span v-else class="text-zinc-500">Sélectionner le pays</span>
                  <span class="text-zinc-500 text-[10px]">▼</span>
                </button>
                <div v-if="showCountry" class="absolute z-20 w-full mt-1 bg-[#1a1a24] border border-zinc-700 rounded-xl overflow-hidden shadow-2xl shadow-black/60">
                  <input v-model="countrySearch" placeholder="Rechercher un pays…" class="w-full bg-black/30 border-b border-zinc-800 px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none" />
                  <div class="max-h-56 overflow-y-auto">
                    <button v-for="c in filteredCountries" :key="c.code" type="button" @click="pickCountry(c)" class="w-full text-left px-3 py-2 text-xs text-slate-300 font-mono hover:bg-[#ff2a2a]/10 transition-colors">
                      {{ c.flag }} {{ c.name }} <span class="text-zinc-500">{{ c.prefix }}</span>
                    </button>
                  </div>
                </div>
              </div>

              <div class="flex gap-1.5">
                <span class="shrink-0 bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-slate-300 font-mono">{{ prefix }}</span>
                <input
                  v-model="phoneNumber"
                  type="tel"
                  inputmode="numeric"
                  placeholder="Numéro WhatsApp"
                  class="flex-1 bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 font-mono focus:outline-none focus:border-[#ff2a2a]/60 transition-colors"
                />
              </div>

              <button type="submit" :disabled="submitting" class="w-full bg-[#ff2a2a] hover:bg-red-600 text-white font-bold text-sm px-4 py-3 rounded-xl transition-all font-mono disabled:opacity-50">
                {{ submitting ? '…' : 'Continuer' }}
              </button>
            </form>

            <!-- Login: Email -->
            <form v-else @submit.prevent="submit" class="space-y-3">
              <input v-model="email" type="email" placeholder="Adresse email" class="w-full bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 font-mono focus:outline-none focus:border-[#ff2a2a]/60 transition-colors" />
              <input v-model="password" type="password" placeholder="Mot de passe" class="w-full bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 font-mono focus:outline-none focus:border-[#ff2a2a]/60 transition-colors" />
              <button type="submit" :disabled="submitting" class="w-full bg-[#ff2a2a] hover:bg-red-600 text-white font-bold text-sm px-4 py-3 rounded-xl transition-all font-mono disabled:opacity-50">
                {{ submitting ? '…' : 'Se connecter' }}
              </button>
            </form>
          </template>

          <!-- REGISTER: email + password + WhatsApp phone, all required -->
          <form v-else @submit.prevent="submit" class="space-y-3">
            <input v-model="name" type="text" placeholder="Nom & prénom" class="w-full bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 font-mono focus:outline-none focus:border-[#ff2a2a]/60 transition-colors" />
            <input v-model="email" type="email" placeholder="Adresse email" class="w-full bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 font-mono focus:outline-none focus:border-[#ff2a2a]/60 transition-colors" />
            <input v-model="password" type="password" placeholder="Mot de passe (6 caractères min.)" class="w-full bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 font-mono focus:outline-none focus:border-[#ff2a2a]/60 transition-colors" />

            <!-- Country + phone (WhatsApp) -->
            <div class="relative">
              <button type="button" @click="showCountry = !showCountry" class="w-full flex items-center justify-between bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 font-mono hover:border-zinc-600 transition-colors">
                <span v-if="selectedCountry">{{ selectedCountry.flag }} {{ selectedCountry.name }} {{ selectedCountry.prefix }}</span>
                <span v-else class="text-zinc-500">Sélectionner le pays</span>
                <span class="text-zinc-500 text-[10px]">▼</span>
              </button>
              <div v-if="showCountry" class="absolute z-20 w-full mt-1 bg-[#1a1a24] border border-zinc-700 rounded-xl overflow-hidden shadow-2xl shadow-black/60">
                <input v-model="countrySearch" placeholder="Rechercher un pays…" class="w-full bg-black/30 border-b border-zinc-800 px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none" />
                <div class="max-h-56 overflow-y-auto">
                  <button v-for="c in filteredCountries" :key="c.code" type="button" @click="pickCountry(c)" class="w-full text-left px-3 py-2 text-xs text-slate-300 font-mono hover:bg-[#ff2a2a]/10 transition-colors">
                    {{ c.flag }} {{ c.name }} <span class="text-zinc-500">{{ c.prefix }}</span>
                  </button>
                </div>
              </div>
            </div>

            <div class="flex gap-1.5">
              <span class="shrink-0 bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-slate-300 font-mono">{{ prefix }}</span>
              <input
                v-model="phoneNumber"
                type="tel"
                inputmode="numeric"
                placeholder="Numéro WhatsApp"
                class="flex-1 bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 font-mono focus:outline-none focus:border-[#ff2a2a]/60 transition-colors"
              />
            </div>

            <button type="submit" :disabled="submitting" class="w-full bg-[#ff2a2a] hover:bg-red-600 text-white font-bold text-sm px-4 py-3 rounded-xl transition-all font-mono disabled:opacity-50">
              {{ submitting ? '…' : 'Créer mon compte' }}
            </button>
          </form>

          <p v-if="error" class="mt-3 text-[11px] text-[#ff2a2a] font-mono text-center">{{ error }}</p>

          <!-- Switch view -->
          <p class="mt-4 text-center text-[11px] text-zinc-500 font-mono">
            <template v-if="view === 'login'">Pas encore de compte ?
              <button @click="view = 'register'" class="text-[#ff2a2a] font-bold hover:underline">Créer un compte</button>
            </template>
            <template v-else>Déjà un compte ?
              <button @click="view = 'login'" class="text-[#ff2a2a] font-bold hover:underline">Se connecter</button>
            </template>
          </p>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.auth-enter-active,
.auth-leave-active {
  transition: opacity 0.2s ease;
}
.auth-enter-from,
.auth-leave-to {
  opacity: 0;
}
.auth-pop {
  animation: pop 0.22s cubic-bezier(0.16, 1, 0.3, 1) both;
}
@keyframes pop {
  from { opacity: 0; transform: scale(0.96) translateY(8px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}
</style>
