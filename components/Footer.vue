<script setup lang="ts">
const config = useRuntimeConfig()
const year = new Date().getFullYear()
</script>

<template>
  <footer class="border-t border-zinc-800/60 bg-[#0d0d14]/60">
    <div class="max-w-[1400px] mx-auto px-4 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
      <div class="flex items-center gap-2">
        <span class="w-6 h-6 rounded bg-[#ff2a2a] flex items-center justify-center text-white font-black text-xs">B</span>
        <span class="font-mono text-[10px] text-zinc-500 uppercase tracking-widest">Black Market © {{ year }} — Sourcing exclusif Chine</span>
      </div>
      <a :href="'https://wa.me/' + config.public.phoneNumber" target="_blank" rel="noopener noreferrer"
         class="text-[10px] font-mono text-zinc-400 hover:text-[#ff2a2a] border border-zinc-800 px-3 py-1.5 rounded-lg transition-all">
        SUPPORT WHATSAPP
      </a>
    </div>
  </footer>
</template>
