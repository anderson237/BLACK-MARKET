<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

// Client layout: single sticky top bar. No desktop sidebar — navigation lives
// in a mobile/tablet drawer only (large screens don't need it).
const drawerOpen = ref(false)
const auth = useAuthStore()
const { isLight, toggle, init } = useTheme()
onMounted(() => init())

const config = useRuntimeConfig()
const { code, set } = useCurrency()
const nav = [
  { label: 'ACCUEIL', to: '/' },
  { label: 'CYBER GADGETS', to: '/' },
  { label: 'TECHWEAR', to: '/' },
  { label: 'STREETWEAR', to: '/' },
  { label: 'GAMING ROOM', to: '/' },
]

function closeDrawer() {
  drawerOpen.value = false
}

function preorder() {
  auth.requireAuth(() => window.open('https://wa.me/' + config.public.phoneNumber, '_blank', 'noopener,noreferrer'), 'Connectez-vous pour précommander')
}

const isAdmin = computed(() => auth.isAuthed && auth.role === 'admin')

function doLogout() {
  auth.logout()
  if (import.meta.client) {
    try {
      localStorage.removeItem('admin_authenticated')
      sessionStorage.removeItem('admin_authenticated')
    } catch {}
  }
  closeDrawer()
  navigateTo('/')
}
</script>

<template>
  <div class="min-h-screen">
    <!-- Top bar -->
    <header class="sticky top-0 z-30 bg-[#0d0d14]/85 backdrop-blur-md border-b border-zinc-800/60">
      <div class="max-w-[1400px] mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <NuxtLink to="/" class="flex items-center gap-2.5 min-w-0">
          <span class="w-8 h-8 rounded-lg bg-[#ff2a2a] flex items-center justify-center text-white font-black text-lg shadow-lg shadow-[#ff2a2a]/30 shrink-0">D</span>
          <div class="leading-none min-w-0">
            <p class="text-sm font-extrabold tracking-widest text-white font-mono truncate">DEEP ROOTS</p>
            <p class="text-[9px] text-[#ff2a2a] font-mono font-bold tracking-widest uppercase">Import-Export Global</p>
          </div>
        </NuxtLink>
        <div class="flex items-center gap-2">
          <NuxtLink v-if="auth.isAuthed" to="/compte"
            class="hidden md:inline-flex items-center gap-1.5 text-[10px] font-mono text-zinc-300 hover:text-white border border-zinc-800 hover:border-[#ff2a2a]/60 px-3 py-2 rounded-xl transition-all" title="Mon espace client">
            <AppIcon name="users" :size="14" /><span class="hidden lg:inline">Mon espace</span>
          </NuxtLink>
          <select :value="code" @change="set(($event.target as HTMLSelectElement).value as 'XOF' | 'EUR' | 'USD')"
            class="hidden md:inline-flex items-center text-[10px] font-mono text-zinc-300 hover:text-white border border-zinc-800 hover:border-[#ff2a2a]/60 px-2 py-2 rounded-xl bg-transparent cursor-pointer transition-all focus:outline-none"
            title="Afficher les prix dans une autre devise">
            <option value="XOF" class="bg-[#12121a]">F CFA</option>
            <option value="EUR" class="bg-[#12121a]">€ EUR</option>
            <option value="USD" class="bg-[#12121a]">$ USD</option>
          </select>
          <NuxtLink v-if="isAdmin" to="/admin"
            class="inline-flex items-center gap-1.5 text-[10px] font-mono text-zinc-300 hover:text-white border border-zinc-800 px-3 py-2 rounded-xl transition-all" title="Ouvrir le dashboard admin">
            <AppIcon name="dashboard" :size="14" /><span class="hidden sm:inline">Dashboard Admin</span>
          </NuxtLink>
          <button v-if="!auth.isAuthed" @click="auth.openModal('Connectez-vous pour continuer')"
            class="hidden md:inline-flex items-center gap-1.5 text-[10px] font-mono text-zinc-300 hover:text-white border border-zinc-800 hover:border-[#ff2a2a]/60 px-3 py-2 rounded-xl transition-all" title="Se connecter">
            <AppIcon name="login" :size="14" /><span class="hidden lg:inline">Connexion</span>
          </button>
          <button v-if="auth.isAuthed" @click="doLogout"
            class="hidden md:inline-flex items-center gap-1.5 text-[10px] font-mono text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-500/60 px-3 py-2 rounded-xl transition-all" title="Se déconnecter">
            <AppIcon name="logout" :size="14" /><span class="hidden lg:inline">Déconnexion</span>
          </button>
          <button @click="preorder"
            class="bg-[#ff2a2a] hover:bg-red-600 text-white text-xs px-3 py-2 rounded-xl font-bold font-mono transition-all cursor-pointer inline-flex items-center gap-1.5"
            title="Précommander sur WhatsApp">
            <AppIcon name="whatsapp" :size="14" />
            <span class="hidden sm:inline">PRÉCOMMANDER</span>
            <span class="sm:hidden">WhatsApp</span>
          </button>
          <button @click="toggle()" :title="isLight ? 'Passer au mode sombre' : 'Passer au mode clair'"
            :aria-label="isLight ? 'Passer au mode sombre' : 'Passer au mode clair'"
            class="w-10 h-10 rounded-lg border border-zinc-800 flex items-center justify-center text-zinc-300 hover:border-[#ff2a2a]/50 hover:text-white transition-all">
            <AppIcon :name="isLight ? 'sun' : 'moon'" :size="15" />
          </button>
          <button @click="drawerOpen = true" aria-label="Menu"
            class="lg:hidden w-10 h-10 rounded-lg border border-zinc-800 flex items-center justify-center text-zinc-300 hover:border-[#ff2a2a]/50 hover:text-white transition-all">
            <AppIcon name="menu" :size="16" />
          </button>
        </div>
      </div>
    </header>

    <!-- Mobile/tablet drawer -->
    <div v-if="drawerOpen" class="fixed inset-0 z-40 lg:hidden" @click.self="closeDrawer">
      <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" @click="closeDrawer" />
      <div class="absolute left-0 top-0 bottom-0 w-72 bg-[#12121a] border-r border-zinc-800 shadow-2xl flex flex-col">
        <div class="flex items-center justify-between px-4 py-4 border-b border-zinc-800">
          <span class="font-mono text-xs font-bold text-white uppercase tracking-widest">Menu</span>
          <button @click="closeDrawer" aria-label="Fermer" class="w-10 h-10 rounded-lg border border-zinc-800 flex items-center justify-center text-zinc-300 hover:text-white"><AppIcon name="close" :size="14" /></button>
        </div>
        <nav class="flex-1 overflow-y-auto p-4 space-y-1">
          <NuxtLink v-for="item in nav" :key="item.label" :to="item.to" @click="closeDrawer" class="block px-3 py-3 rounded-lg text-[12px] font-mono font-bold text-zinc-300 hover:text-white hover:bg-zinc-800/60 transition-all uppercase tracking-widest">
            {{ item.label }}
          </NuxtLink>
          <NuxtLink v-if="auth.isAuthed" to="/compte" @click="closeDrawer" class="flex items-center gap-2 px-3 py-3 rounded-lg text-[12px] font-mono font-bold text-zinc-300 hover:text-white hover:bg-zinc-800/60 transition-all uppercase tracking-widest">
            <AppIcon name="users" :size="15" /> Mon espace
          </NuxtLink>
          <NuxtLink v-if="isAdmin" to="/admin" @click="closeDrawer" class="flex items-center gap-2 px-3 py-3 rounded-lg text-[12px] font-mono font-bold text-zinc-500 hover:text-white hover:bg-zinc-800/60 transition-all uppercase tracking-widest">
            <AppIcon name="dashboard" :size="15" /> Dashboard Admin
          </NuxtLink>
        </nav>
        <div class="p-4 border-t border-zinc-800 space-y-2">
          <select :value="code" @change="set(($event.target as HTMLSelectElement).value as 'XOF' | 'EUR' | 'USD')"
            class="w-full text-[11px] font-mono text-zinc-300 border border-zinc-800 bg-transparent px-3 py-2.5 rounded-xl cursor-pointer focus:outline-none uppercase tracking-widest"
            title="Afficher les prix dans une autre devise">
            <option value="XOF" class="bg-[#12121a]">F CFA (Franc CFA)</option>
            <option value="EUR" class="bg-[#12121a]">EUR (Euro)</option>
            <option value="USD" class="bg-[#12121a]">USD (Dollar)</option>
          </select>
          <a :href="`https://wa.me/${String(config.public.phoneNumber || '').replace(/[^0-9]/g, '')}`" target="_blank" rel="noopener"
             class="flex items-center justify-center gap-2 text-center text-[11px] font-mono text-emerald-400 border border-emerald-500/30 px-3 py-2.5 rounded-xl transition-all uppercase tracking-widest">
            <AppIcon name="whatsapp" :size="14" /> WhatsApp Direct
          </a>
          <button @click="preorder; closeDrawer()"
             class="block w-full text-center bg-[#ff2a2a] hover:bg-red-600 text-white text-xs px-3 py-2.5 rounded-xl font-bold font-mono transition-all cursor-pointer">
            PRÉCOMMANDER
          </button>
          <button v-if="!auth.isAuthed" @click="auth.openModal('Connectez-vous pour continuer'); closeDrawer()"
             class="block w-full text-center text-[11px] font-mono text-zinc-300 border border-zinc-800 px-3 py-2.5 rounded-xl transition-all uppercase tracking-widest">
            Connexion
          </button>
          <button v-if="auth.isAuthed" @click="doLogout"
             class="block w-full text-center text-[11px] font-mono text-red-400 border border-red-500/30 px-3 py-2.5 rounded-xl transition-all uppercase tracking-widest">
            Déconnexion
          </button>
        </div>
      </div>
    </div>

    <!-- Main content -->
    <main>
      <slot />
    </main>
  </div>
</template>
