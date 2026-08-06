<script setup lang="ts">
const props = defineProps<{ role?: string }>()

const LABELS: Record<string, string> = {
  admin: 'ADMIN',
  editor: 'ÉDITEUR',
  publisher: 'PUBLIEUR',
}

const isStaff = computed(() => {
  const r = String(props.role || '')
  return r === 'admin' || r === 'editor' || r === 'publisher'
})
const label = computed(() => LABELS[String(props.role || '')] || String(props.role || '').toUpperCase())
</script>

<template>
  <span
    v-if="isStaff"
    class="inline-flex items-center shrink-0 px-1.5 py-0.5 rounded-md text-[9px] font-black font-mono tracking-wider uppercase border leading-none"
    :class="role === 'admin' ? 'bg-[#ff2a2a]/15 text-[#ff2a2a] border-[#ff2a2a]/40' : 'bg-sky-500/10 text-sky-400 border-sky-500/30'"
  >{{ label }}</span>
</template>
