<script setup lang="ts">
import { useCatalogStore } from '~/stores/catalog'
import { useInteractionsStore } from '~/stores/interactions'
import { useCommentsStore } from '~/stores/comments'

definePageMeta({ layout: 'default' })

const store = useCatalogStore()
await store.init()

const config = useRuntimeConfig()
const siteUrl = config.public.siteUrl

useHead(() => {
  const products = store.items
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'DEEP ROOTS — Import-Export Global',
    itemListElement: products.slice(0, 30).map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${siteUrl}/p/${p.id}.html`,
      name: p.title,
    })),
  }
  return {
    title: 'DEEP ROOTS — Import-Export Global',
    meta: [
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: 'DEEP ROOTS' },
      { property: 'og:url', content: `${siteUrl}/` },
      { property: 'og:image', content: `${siteUrl}/og-image.png` },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'robots', content: 'index, follow, max-image-preview:large' },
    ],
    link: [{ rel: 'canonical', href: `${siteUrl}/` }],
    script: [{ type: 'application/ld+json', children: JSON.stringify(jsonLd) }],
  }
})

// Infinite scroll: load more products as the user scrolls near the bottom.
const sentinel = ref<HTMLElement | null>(null)
const loadingMore = ref(false)

const onIntersect = (entries: IntersectionObserverEntry[]) => {
  if (entries[0]?.isIntersecting && !store.done) {
    store.loadMore()
  }
}

// Site-wide real-time: refresh the catalogue instantly when the admin
// creates/updates/archives a product (SSE push), keeping the scroll position.
// A 30s poll is the fallback: Netlify's in-memory pub/sub is per-instance, so a
// push can be missed when the mutation lands on a different Lambda instance.
function onSiteEvent(e: Event) {
  const detail = (e as CustomEvent).detail
  if (detail?.kind === 'catalog') {
    store.refresh()
    // Like/unlike/comment pushes also arrive as kind 'catalog': refresh the
    // live interaction counters (heart count, comment count, glow state)
    // without waiting for the poll, exactly like the chat updates in real time.
    const inter = useInteractionsStore()
    const comments = useCommentsStore()
    for (const p of store.items) {
      inter.refreshCount(p.id).catch(() => {})
      comments.refresh(p.id).catch(() => {})
    }
  }
}

let catalogPoll: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  const obs = new IntersectionObserver(onIntersect, { rootMargin: '600px' })
  if (sentinel.value) obs.observe(sentinel.value)
  onBeforeUnmount(() => obs.disconnect())
  window.addEventListener('bm:site', onSiteEvent)
  catalogPoll = setInterval(() => store.refresh(), 30_000)
})

onBeforeUnmount(() => {
  window.removeEventListener('bm:site', onSiteEvent)
  if (catalogPoll) clearInterval(catalogPoll)
})
</script>

<template>
  <div class="min-h-screen">
    <!-- Hero / Filters -->
    <section class="max-w-[1400px] mx-auto px-4 pt-8 pb-2">
      <div class="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 class="text-xl sm:text-2xl font-extrabold text-white uppercase font-mono tracking-widest">
            Drops <span class="text-[#ff2a2a]">Exclusifs</span>
          </h1>
          <p class="text-[11px] text-zinc-500 font-mono mt-1">Deep Roots Logistics · Votre ancre mondiale pour le commerce international</p>
        </div>
        <span class="bg-[#ff2a2a]/10 text-[#ff2a2a] border border-[#ff2a2a]/25 text-[10px] px-2.5 py-0.5 rounded font-mono font-bold">
          {{ store.total }} DROPS DISPONIBLES
        </span>
      </div>

      <!-- Search bar -->
      <div class="relative mb-4">
        <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        </span>
        <input
          v-model="store.searchQuery"
          @input="store.setSearch(store.searchQuery)"
          type="search"
          placeholder="Rechercher un produit… (nom, catégorie)"
          class="w-full bg-[#15151e] border border-zinc-800 hover:border-zinc-700 focus:border-[#ff2a2a]/60 focus:outline-none rounded-full pl-10 pr-9 py-2.5 text-sm text-slate-100 placeholder:text-zinc-500 transition-colors"
        />
        <button
          v-if="store.searchQuery"
          @click="store.setSearch('')"
          class="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white text-sm px-1"
          aria-label="Effacer la recherche"
        >
          ✕
        </button>
      </div>

      <!-- Category tabs -->
      <div class="flex flex-wrap gap-2 pb-3">
        <button
          v-for="cat in store.categories"
          :key="cat"
          @click="store.setCategory(cat)"
          class="text-[10px] px-4 py-1.5 rounded-full font-extrabold font-mono transition-all uppercase tracking-widest border"
          :class="store.activeCategory === cat
            ? 'bg-[#ff2a2a] text-white border-[#ff2a2a]'
            : 'bg-[#15151e] text-zinc-400 border-zinc-800 hover:border-[#ff2a2a]/40 hover:text-slate-100'"
        >
          {{ cat }}
        </button>
      </div>

      <!-- Mention tabs (ST-018) : combinables avec catégorie + recherche -->
      <div class="flex flex-wrap gap-2 pb-4">
        <button
          v-for="m in store.mentions"
          :key="'mention-' + m"
          @click="store.setMention(m)"
          class="text-[9px] px-3 py-1 rounded-full font-extrabold font-mono transition-all uppercase tracking-widest border"
          :class="store.activeMention === m
            ? 'bg-violet-600 text-white border-violet-500'
            : 'bg-[#15151e] text-zinc-500 border-zinc-800 hover:border-violet-500/40 hover:text-slate-100'"
        >
          {{ m }}
        </button>
      </div>
    </section>

    <!-- Masonry catalog -->
    <main class="max-w-[1400px] mx-auto px-4 pb-16">
      <div v-if="store.loading && store.items.length === 0" class="masonry">
        <div v-for="n in 8" :key="n" class="skeleton rounded-2xl" :style="{ height: (180 + (n % 3) * 90) + 'px' }" />
      </div>

      <div v-else-if="store.items.length === 0" class="py-24 text-center text-zinc-500 font-mono text-xs">
        <template v-if="store.searchQuery.trim()">
          AUCUN RÉSULTAT POUR « {{ store.searchQuery.trim() }} »
        </template>
        <template v-else-if="store.activeCategory !== 'Tous' && store.activeMention !== 'Tous'">
          AUCUN DROP DANS « {{ store.activeCategory }} » EN « {{ store.activeMention }} »
        </template>
        <template v-else-if="store.activeCategory !== 'Tous'">
          AUCUN DROP DANS « {{ store.activeCategory }} »
        </template>
        <template v-else-if="store.activeMention !== 'Tous'">
          AUCUN DROP EN « {{ store.activeMention }} »
        </template>
        <template v-else>
          AUCUN DROP POUR LE MOMENT
        </template>
      </div>

      <div v-else class="masonry">
        <ProductCard
          v-for="(p, i) in store.items"
          :key="p.id"
          :product="p"
          :index="store.masterIndex(p.id)"
          class="bm-fade-in"
        />
      </div>

      <!-- Infinite scroll sentinel + loading indicator -->
      <div ref="sentinel" class="h-4" />
      <div v-if="!store.done" class="flex justify-center py-6">
        <div class="w-6 h-6 border-2 border-[#ff2a2a] border-t-transparent rounded-full animate-spin" />
      </div>
      <p v-else class="text-center text-zinc-600 font-mono text-[10px] py-6 uppercase tracking-widest">
        — Fin du catalogue —
      </p>
    </main>

    <Footer />
  </div>
</template>
