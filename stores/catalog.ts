import { defineStore } from 'pinia'
import type { Product } from '~/types'
import { fetchCatalog as _fetchCatalog } from '~/composables/useCatalog'

const PAGE_SIZE = 12

export const useCatalogStore = defineStore('catalog', () => {
  const all = ref<Product[]>([])
  const items = ref<Product[]>([])
  const loading = ref(false)
  const done = ref(false)
  const activeCategory = ref('Tous')

  const categories = computed(() => ['Tous', ...new Set(all.value.map((p) => p.category).filter(Boolean))])
  const total = computed(() => all.value.length)

  function masterIndex(id: string) {
    return all.value.findIndex((p) => p.id === id)
  }

  async function init() {
    if (all.value.length) return
    loading.value = true
    try {
      all.value = await _fetchCatalog()
      resetAndSlice()
    } finally {
      loading.value = false
    }
  }

  function resetAndSlice() {
    done.value = false
    items.value = all.value.slice(0, PAGE_SIZE)
    if (items.value.length >= all.value.length) done.value = true
  }

  function setCategory(cat: string) {
    activeCategory.value = cat
    resetAndSlice()
  }

  function loadMore() {
    if (done.value || loading.value) return
    loading.value = true
    const next = items.value.length + PAGE_SIZE
    items.value = all.value.slice(0, next)
    if (items.value.length >= all.value.length) done.value = true
    loading.value = false
  }

  /** Refresh the whole catalog in place (keeps scroll position). */
  async function refresh() {
    try {
      const data = await _fetchCatalog()
      all.value = data
      // Trim/expand the visible slice without losing pagination state.
      const trimmed = items.value.filter((p) => data.some((d) => d.id === p.id))
      items.value = trimmed
      if (items.value.length < data.length) items.value = data.slice(0, Math.max(items.value.length, PAGE_SIZE))
      if (items.value.length >= data.length) done.value = true
    } catch {
      // Keep current data on network hiccups.
    }
  }

  return { all, items, loading, done, activeCategory, categories, total, masterIndex, init, setCategory, loadMore, refresh }
})
