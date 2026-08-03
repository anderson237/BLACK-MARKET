<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

const auth = useAuthStore()
const email = ref('')
const key = ref('')
const submitting = ref(false)
const error = ref('')

async function submit() {
  submitting.value = true
  error.value = ''
  try {
    await auth.loginAdmin(email.value, key.value)
  } catch (e: any) {
    error.value = e?.message || 'Clé d\'accès incorrecte.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="min-h-[70vh] flex items-center justify-center px-4">
    <form @submit.prevent="submit" class="w-full max-w-sm bg-[#12121a] border border-zinc-800 rounded-2xl p-6 space-y-4">
      <div class="text-center">
        <span class="w-10 h-10 rounded-xl bg-[#ff2a2a] grid place-items-center text-white font-black text-xl mx-auto mb-2">B</span>
        <h1 class="text-sm font-extrabold text-white font-mono uppercase tracking-widest">Administration</h1>
        <p class="text-[11px] text-zinc-500 font-mono mt-1">Connectez-vous pour accéder à la console.</p>
      </div>

      <input
        v-model="email"
        type="email"
        placeholder="Email administrateur"
        class="w-full bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:border-[#ff2a2a]/60 focus:outline-none"
      />
      <input
        v-model="key"
        type="password"
        placeholder="Clé d'accès"
        class="w-full bg-black/40 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:border-[#ff2a2a]/60 focus:outline-none"
      />

      <button type="submit" :disabled="submitting"
        class="w-full bg-[#ff2a2a] hover:bg-red-600 text-white font-bold text-sm py-3 rounded-xl transition-all font-mono disabled:opacity-50">
        {{ submitting ? 'Connexion…' : 'Se connecter' }}
      </button>

      <p v-if="error" class="text-[11px] text-[#ff2a2a] font-mono text-center">{{ error }}</p>
    </form>
  </div>
</template>