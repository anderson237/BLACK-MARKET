<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

// Admin layout: responsive sidebar (drawer on mobile, fixed on desktop).
const drawerOpen = ref(false)
const route = useRoute()
const auth = useAuthStore()
const { isLight, toggle, init } = useTheme()
onMounted(() => init())

// Admin console must never be indexed by search engines: it hosts login
// forms and private data, and keeping it out of the crawl reduces the risk
// of Google's Safe Browsing misclassifying the password form as phishing.
useHead({
  meta: [{ name: 'robots', content: 'noindex, nofollow', key: 'robots' }],
})

// Only an authenticated admin (role === 'admin') can access the console.
const isAdmin = computed(() => auth.isAuthed && auth.role === 'admin')

// The admin login screen is the only public entry point of the console.
const isLoginRoute = computed(() => {
  const p = String(route.path || '')
  return p === '/admin/login' || p === '/admin/login/'
})

// Anyone who is not an admin is bounced to the home page; admins hitting the
// login screen are sent straight to the dashboard.
watchEffect(() => {
  if (!auth.initialized) return
  if (!isAdmin.value && !isLoginRoute.value) {
    navigateTo('/')
  } else if (isAdmin.value && isLoginRoute.value) {
    navigateTo('/admin')
  }
})

const config = useRuntimeConfig()
const wa = ref(String(config.public.phoneNumber || '22900000000'))
const currency = ref(config.public.currency === 'EUR' ? 'EUR' : 'XOF')

onMounted(() => {
  try {
    const saved = localStorage.getItem('bm_admin_wa')
    if (saved) wa.value = saved
    const savedCur = localStorage.getItem('bm_admin_currency')
    if (savedCur) currency.value = savedCur as 'XOF' | 'EUR'
  } catch {}
})

function setCurrency(v: 'XOF' | 'EUR') {
  currency.value = v
  if (import.meta.client) {
    localStorage.setItem('bm_admin_currency', v)
  }
}

function cleanWa(p: string) {
  return String(p || '').replace(/\+/g, '').replace(/\s/g, '')
}

function doLogout() {
  auth.logout()
  if (import.meta.client) {
    try {
      localStorage.removeItem('admin_authenticated')
      sessionStorage.removeItem('admin_authenticated')
    } catch {}
  }
  navigateTo('/admin')
}

const navItems = [
  { label: 'Dashboard', icon: 'dashboard', to: '/admin' },
  { label: 'Catalogue', icon: 'box', to: '/admin/catalog' },
  { label: 'Commandes', icon: 'cart', to: '/admin/orders' },
  { label: 'Comptabilité', icon: 'chart', to: '/admin/comptabilite' },
  { label: 'Analyse', icon: 'chart', to: '/admin/analyse' },
  { label: 'Audience', icon: 'globe', to: '/admin/audience' },
  { label: 'Trésorerie', icon: 'wallet', to: '/admin/tresorerie' },
  { label: 'Clients', icon: 'users', to: '/admin/customers' },
  { label: 'Utilisateurs', icon: 'crown', to: '/admin/users' },
  { label: 'Catégories', icon: 'tag', to: '/admin/categories' },
  { label: 'Génération IA', icon: 'sparkles', to: '/admin/ai' },
  { label: 'Réglages', icon: 'settings', to: '/admin/settings' },
]

const isActive = (to: string) => route.path === to || route.path.startsWith(to + '/')

function closeDrawer() {
  drawerOpen.value = false
}
</script>

<template>
  <!-- Auth gate: only the login screen is public; every other admin route is
       reserved for admins (non-admins are redirected to the home page). -->
  <div v-if="!isAdmin">
    <template v-if="isLoginRoute">
      <div class="min-h-screen bg-[#08080c]">
        <div class="max-w-[1400px] mx-auto px-4 py-4 flex items-center justify-between">
          <NuxtLink to="/" class="flex items-center gap-2">
            <span class="w-10 h-10 shrink-0 rounded-lg bg-[#ff2a2a] flex items-center justify-center text-white font-black text-lg">B</span>
            <span class="font-mono text-[10px] text-zinc-500 uppercase tracking-widest">BLACK MARKET · ADMIN</span>
          </NuxtLink>
          <NuxtLink to="/" class="text-[10px] font-mono text-zinc-400 hover:text-[#ff2a2a] border border-zinc-800 px-3 py-1.5 rounded-lg transition-all">← Voir le site</NuxtLink>
          <button @click="toggle()" :title="isLight ? 'Mode sombre' : 'Mode clair'"
            :aria-label="isLight ? 'Passer au mode sombre' : 'Passer au mode clair'"
            class="w-9 h-9 rounded-lg border border-zinc-800 flex items-center justify-center text-zinc-300 hover:border-[#ff2a2a]/50 hover:text-white transition-all">
            <AppIcon :name="isLight ? 'sun' : 'moon'" :size="14" />
          </button>
        </div>
        <slot />
      </div>
    </template>
    <div v-else class="min-h-screen bg-[#08080c] grid place-items-center">
      <p class="text-[11px] font-mono text-zinc-600">Redirection vers l'accueil…</p>
    </div>
  </div>

  <div v-else class="min-h-screen">
    <!-- Top bar -->
    <header class="sticky top-0 z-30 bg-[#0d0d14]/85 backdrop-blur-md border-b border-zinc-800/60">
      <div class="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-3">
        <div class="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <button @click="drawerOpen = true" aria-label="Menu"
            class="md:hidden w-10 h-10 shrink-0 rounded-lg border border-zinc-800 flex items-center justify-center text-zinc-300 hover:border-[#ff2a2a]/50 hover:text-white transition-all">
            <AppIcon name="menu" :size="16" />
          </button>
          <NuxtLink to="/admin" class="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <span class="w-7 h-7 sm:w-8 sm:h-8 shrink-0 rounded-lg bg-[#ff2a2a] flex items-center justify-center text-white font-black text-base sm:text-lg">B</span>
            <div class="leading-none min-w-0">
              <p class="text-[11px] sm:text-sm font-extrabold tracking-widest text-white font-mono truncate">BLACK MARKET</p>
              <p class="hidden sm:block text-[8px] sm:text-[9px] text-zinc-500 font-mono uppercase tracking-widest">Admin console</p>
            </div>
          </NuxtLink>
        </div>
        <div class="flex items-center gap-1 sm:gap-2 ml-auto shrink-0">
          <a :href="`https://wa.me/${cleanWa(wa)}`" target="_blank" rel="noopener"
            class="hidden md:inline-flex items-center gap-1.5 text-[10px] font-mono text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 px-2.5 py-1.5 rounded-lg transition-all" title="N°. WhatsApp vendes">
            <AppIcon name="whatsapp" :size="13" /> {{ wa }}
          </a>
          <select :value="currency" @change="setCurrency(($event.target as HTMLSelectElement).value as 'XOF' | 'EUR')"
            class="bg-black/40 border border-zinc-800 rounded-lg px-2.5 py-2 text-[10px] font-mono text-slate-200 focus:outline-none focus:border-[#ff2a2a]/60 cursor-pointer" title="Devise">
            <option value="XOF" class="bg-[#0d0d14]">XOF</option>
            <option value="EUR" class="bg-[#0d0d14]">EUR</option>
          </select>
          <button @click="toggle()" :title="isLight ? 'Mode sombre' : 'Mode clair'"
            :aria-label="isLight ? 'Passer au mode sombre' : 'Passer au mode clair'"
            class="w-10 h-10 shrink-0 rounded-lg border border-zinc-800 flex items-center justify-center text-zinc-300 hover:border-[#ff2a2a]/50 hover:text-white transition-all">
            <AppIcon :name="isLight ? 'sun' : 'moon'" :size="15" />
          </button>
          <button @click="doLogout"
            class="text-[10px] font-mono text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-500/60 px-2.5 py-2 rounded-lg transition-all inline-flex items-center gap-1.5" title="Se déconnecter">
            <AppIcon name="logout" :size="13" />
            <span class="sm:hidden">Sortie</span><span class="hidden sm:inline">Déconnexion</span>
          </button>
          <NuxtLink to="/" class="text-[10px] font-mono text-zinc-400 hover:text-[#ff2a2a] border border-zinc-800 px-2.5 py-2 rounded-lg transition-all inline-flex items-center gap-1.5" title="Voir le site">
            <AppIcon name="chevronLeft" :size="13" /><span class="hidden sm:inline">Voir le site</span>
          </NuxtLink>
        </div>
      </div>
    </header>

    <!-- Desktop sidebar -->
    <aside class="hidden md:flex fixed left-0 top-[53px] bottom-0 w-52 lg:w-56 border-r border-zinc-800/60 bg-[#0d0d14]/60 flex-col">
      <nav class="flex-1 p-4 space-y-1 overflow-y-auto">
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[12px] font-mono font-bold transition-all uppercase tracking-wider"
          :class="isActive(item.to) ? 'bg-[#ff2a2a]/15 text-[#ff2a2a] border border-[#ff2a2a]/30' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60 border border-transparent'"
        >
          <AppIcon :name="item.icon" :size="15" />{{ item.label }}
        </NuxtLink>
      </nav>
    </aside>

    <!-- Mobile drawer -->
    <div v-if="drawerOpen" class="fixed inset-0 z-40 md:hidden">
      <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" @click="closeDrawer" />
      <div class="absolute left-0 top-0 bottom-0 w-72 bg-[#12121a] border-r border-zinc-800 shadow-2xl flex flex-col">
        <div class="flex items-center justify-between px-4 py-4 border-b border-zinc-800">
          <span class="font-mono text-xs font-bold text-white uppercase tracking-widest">Administration</span>
          <button @click="closeDrawer" aria-label="Fermer" class="w-10 h-10 rounded-lg border border-zinc-800 flex items-center justify-center text-zinc-300 hover:text-white"><AppIcon name="close" :size="14" /></button>
        </div>
        <nav class="flex-1 overflow-y-auto p-4 space-y-1">
          <NuxtLink v-for="item in navItems" :key="item.to" :to="item.to" @click="closeDrawer"
            class="flex items-center gap-2.5 px-3 py-3 rounded-lg text-[12px] font-mono font-bold transition-all uppercase tracking-wider"
            :class="isActive(item.to) ? 'bg-[#ff2a2a]/15 text-[#ff2a2a] border border-[#ff2a2a]/30' : 'text-zinc-300 hover:text-white hover:bg-zinc-800/60 border border-transparent'">
            <AppIcon :name="item.icon" :size="15" />{{ item.label }}
          </NuxtLink>
        </nav>
        <div class="p-4 border-t border-zinc-800">
          <NuxtLink to="/" class="block text-center text-[11px] font-mono text-zinc-400 hover:text-white border border-zinc-800 px-3 py-2.5 rounded-lg transition-all uppercase tracking-widest">
            ← Voir le site
          </NuxtLink>
        </div>
      </div>
    </div>

    <!-- Content: max-w and overflow handled here so editors never stretch the layout -->
    <main class="md:pl-52 lg:pl-56">
      <div class="max-w-[1200px] mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <slot />
      </div>
    </main>
  </div>
</template>
