<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

const toast = ref('')
let timer: ReturnType<typeof setTimeout> | null = null

const auth = useAuthStore()
onMounted(() => auth.hydrate())

function showToast(msg: string) {
  toast.value = msg
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => (toast.value = ''), 2400)
}

onMounted(() => {
  window.addEventListener('bm:copied', ((e: CustomEvent) => showToast(e.detail)) as EventListener)
})
onBeforeUnmount(() => {
  window.removeEventListener('bm:copied', ((e: CustomEvent) => showToast(e.detail)) as EventListener)
})

// Live-track agent: dispatch view events to admin console as user browses.
onMounted(() => {
  window.addEventListener('bm:track', ((e: CustomEvent) => {}) as EventListener)
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>

  <AuthModal />

  <Teleport to="body">
    <Transition name="toast">
      <div
        v-if="toast"
        class="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] bg-[#12121a] border border-[#ff2a2a]/40 text-slate-100 text-xs font-mono px-4 py-2.5 rounded-xl shadow-2xl shadow-black/60"
      >
        {{ toast }}
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.25s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 10px);
}
</style>