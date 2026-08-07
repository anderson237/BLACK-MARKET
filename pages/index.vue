<script setup lang="ts">
import { useCatalogStore } from '~/stores/catalog'

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

onMounted(() => {
  const obs = new IntersectionObserver(onIntersect, { rootMargin: '600px' })
  if (sentinel.value) obs.observe(sentinel.value)
  onBeforeUnmount(() => obs.disconnect())
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

      <!-- Category tabs -->
      <div class="flex flex-wrap gap-2 pb-4">
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
    </section>

    <!-- Masonry catalog -->
    <main class="max-w-[1400px] mx-auto px-4 pb-16">
      <div v-if="store.loading && store.items.length === 0" class="masonry">
        <div v-for="n in 8" :key="n" class="skeleton rounded-2xl" :style="{ height: (180 + (n % 3) * 90) + 'px' }" />
      </div>

      <div v-else-if="store.items.length === 0" class="py-24 text-center text-zinc-500 font-mono text-xs">
        AUCUN DROP POUR LE MOMENT
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
