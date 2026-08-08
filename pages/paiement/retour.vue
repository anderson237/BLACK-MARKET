<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useCurrency } from '~/composables/useCurrency'

const route = useRoute()
const auth = useAuthStore()
const config = useRuntimeConfig()
const { format } = useCurrency()

useSeoMeta({ title: 'Paiement — DEEP ROOTS' })

const canceled = ref(route.query.canceled === '1')
const checking = ref(true)
const result = ref<{ status: string; payment?: any } | null>(null)
const error = ref('')

onMounted(async () => {
  if (!auth.isAuthed) {
    auth.openModal('Connectez-vous pour vérifier votre paiement')
    navigateTo('/compte')
    return
  }
  const tx = String(route.query.tx || '')
  const cid = String(route.query.checkout_id || '')
  if (!tx && !cid) {
    checking.value = false
    error.value = 'Aucune transaction à vérifier.'
    return
  }
  try {
    const q = tx ? `?tx=${encodeURIComponent(tx)}` : `?checkout_id=${encodeURIComponent(cid)}`
    const res = await fetch(`/api/payments/status${q}`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${auth.token}` },
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      error.value = json?.statusMessage || json?.message || 'Impossible de vérifier le paiement.'
    } else {
      result.value = json
    }
  } catch {
    error.value = 'Erreur réseau lors de la vérification du paiement.'
  } finally {
    checking.value = false
  }
})

const paid = computed(() => result.value?.status === 'SUCCESS')
function reloadPage() {
  window.location.reload()
}
</script>

<template>
  <div class="max-w-[560px] mx-auto px-4 py-16">
    <div class="bg-[#12121a] border border-zinc-800 rounded-2xl p-8 text-center">
      <!-- Spinner while checking -->
      <div v-if="checking" class="py-8">
        <div class="w-10 h-10 mx-auto border-2 border-zinc-600 border-t-[#ff2a2a] rounded-full animate-spin" />
        <p class="mt-4 text-sm font-mono text-zinc-400">Vérification du paiement…</p>
      </div>

      <!-- Error / missing transaction -->
      <div v-else-if="error" class="py-8">
        <div class="w-14 h-14 mx-auto rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 text-2xl">⚠</div>
        <h1 class="mt-4 text-lg font-extrabold text-white font-mono uppercase">Paiement en attente</h1>
        <p class="mt-2 text-sm text-zinc-400 font-mono">{{ error }}</p>
        <NuxtLink to="/compte" class="inline-block mt-6 bg-[#ff2a2a] hover:bg-red-600 text-white text-xs font-bold font-mono px-6 py-3 rounded-xl transition-all">Retour à mon espace</NuxtLink>
      </div>

      <!-- Canceled by the user -->
      <div v-else-if="canceled && !paid" class="py-8">
        <div class="w-14 h-14 mx-auto rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 text-2xl">✕</div>
        <h1 class="mt-4 text-lg font-extrabold text-white font-mono uppercase">Paiement annulé</h1>
        <p class="mt-2 text-sm text-zinc-400 font-mono">Aucun débit n'a été effectué. Vous pouvez réessayer ou confirmer vos précommandes par WhatsApp.</p>
        <NuxtLink to="/compte" class="inline-block mt-6 bg-[#ff2a2a] hover:bg-red-600 text-white text-xs font-bold font-mono px-6 py-3 rounded-xl transition-all">Retour à mes précommandes</NuxtLink>
      </div>

      <!-- Failed -->
      <div v-else-if="result && result.status === 'FAILED'" class="py-8">
        <div class="w-14 h-14 mx-auto rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 text-2xl">✕</div>
        <h1 class="mt-4 text-lg font-extrabold text-white font-mono uppercase">Paiement échoué</h1>
        <p class="mt-2 text-sm text-zinc-400 font-mono">Le paiement n'a pas abouti. Aucun montant n'a été débité — vous pouvez réessayer.</p>
        <NuxtLink to="/compte" class="inline-block mt-6 bg-[#ff2a2a] hover:bg-red-600 text-white text-xs font-bold font-mono px-6 py-3 rounded-xl transition-all">Réessayer depuis mon espace</NuxtLink>
      </div>

      <!-- Pending -->
      <div v-else-if="result && result.status === 'PENDING'" class="py-8">
        <div class="w-14 h-14 mx-auto rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 text-2xl">⏳</div>
        <h1 class="mt-4 text-lg font-extrabold text-white font-mono uppercase">Paiement en cours de confirmation</h1>
        <p class="mt-2 text-sm text-zinc-400 font-mono">Vérifiez la notification de débit sur votre téléphone. Actualisez cette page dans quelques instants.</p>
        <button @click="reloadPage" class="inline-block mt-6 bg-[#ff2a2a] hover:bg-red-600 text-white text-xs font-bold font-mono px-6 py-3 rounded-xl transition-all">Actualiser</button>
      </div>

      <!-- Success -->
      <div v-else class="py-8">
        <div class="w-14 h-14 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-2xl">✓</div>
        <h1 class="mt-4 text-lg font-extrabold text-white font-mono uppercase">Paiement confirmé !</h1>
        <p class="mt-2 text-sm text-zinc-400 font-mono">
          Votre commande est payée et enregistrée.
          <span v-if="result?.payment?.amountXof">Montant : <b class="text-emerald-400">{{ format(result.payment.amountXof) }}</b>.</span>
        </p>
        <NuxtLink to="/compte" class="inline-block mt-6 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold font-mono px-6 py-3 rounded-xl transition-all">Suivre ma commande</NuxtLink>
      </div>
    </div>
  </div>
</template>
