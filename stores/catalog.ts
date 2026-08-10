import { defineStore } from 'pinia'
import { PRODUCT_MENTIONS, type Product } from '~/types'
import { fetchCatalog as _fetchCatalog } from '~/composables/useCatalog'

const PAGE_SIZE = 12

export const useCatalogStore = defineStore('catalog', () => {
  const all = ref<Product[]>([])
  const items = ref<Product[]>([])
  const loading = ref(false)
  const done = ref(false)
  const activeCategory = ref('Tous')
  // Mention active (ST-018) : 'Tous' = aucune mention sélectionnée, sinon un
  // libellé FR ('Neuf' | 'Occasion' | 'Gros') ∈ `mentions`.
  const activeMention = ref('Tous')
  const searchQuery = ref('')

  const categories = computed(() => ['Tous', ...new Set(all.value.map((p) => p.category).filter(Boolean))])
  // Filtres vitrine mentions : « Tous / Neuf / Occasion / Gros » (libellés FR).
  const mentions = computed(() => ['Tous', ...PRODUCT_MENTIONS.map((m) => m.label)])
  const total = computed(() => all.value.length)

  function masterIndex(id: string) {
    return all.value.findIndex((p) => p.id === id)
  }

  /**
   * Products filtered by category ('' = Tous) × mention (ST-018) × search.
   * Mention : `activeMention` est un libellé FR ('Neuf'…) converti en valeur
   * normalisée ('neuf') via PRODUCT_MENTIONS. Les produits sans mention sont
   * visiblement inclus quand aucune mention n'est sélectionnée (backward compat).
   */
  function filtered() {
    const q = searchQuery.value.trim().toLowerCase()
    // Valeur normalisée de la mention active (undefined si 'Tous').
    const mentionValue =
      activeMention.value === 'Tous'
        ? undefined
        : PRODUCT_MENTIONS.find((m) => m.label === activeMention.value)?.value
    let list = all.value.filter((p) => {
      const catOk = activeCategory.value === 'Tous' || (p.category || '') === activeCategory.value
      const mentionOk = !mentionValue || p.mention === mentionValue
      return catOk && mentionOk
    })
    if (mentionValue === undefined && activeMention.value !== 'Tous') {
      // Défensif : mention inconnue → aucun résultat (ne doit pas arriver).
      list = []
    }
    if (q) {
      list = list.filter(
        (p) =>
          (p.title || '').toLowerCase().includes(q) ||
          (p.chineseTitle || '').toLowerCase().includes(q) ||
          (p.description || '').toLowerCase().includes(q) ||
          (p.category || '').toLowerCase().includes(q),
      )
    }
    return list
  }

  function setSearch(q: string) {
    searchQuery.value = String(q || '')
    resetAndSlice()
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
    const list = filtered()
    items.value = list.slice(0, PAGE_SIZE)
    if (items.value.length >= list.length) done.value = true
  }

  function setCategory(cat: string) {
    activeCategory.value = cat
    resetAndSlice()
  }

  /** Active un filtre mention vitrine (« Tous / Neuf / Occasion / Gros »). */
  function setMention(mention: string) {
    activeMention.value = mention
    resetAndSlice()
  }

  function loadMore() {
    if (done.value || loading.value) return
    loading.value = true
    const list = filtered()
    const next = items.value.length + PAGE_SIZE
    items.value = list.slice(0, next)
    if (items.value.length >= list.length) done.value = true
    loading.value = false
  }

  /** Refresh the whole catalog in place (keeps scroll position). */
  async function refresh() {
    try {
      const data = await _fetchCatalog()
      all.value = data
      // Trim/expand the visible slice without losing pagination state.
      const list = filtered()
      const trimmed = items.value.filter((p) => data.some((d) => d.id === p.id))
      items.value = trimmed
      if (items.value.length < list.length) items.value = list.slice(0, Math.max(items.value.length, PAGE_SIZE))
      if (items.value.length >= list.length) done.value = true
    } catch {
      // Keep current data on network hiccups.
    }
  }

  return { all, items, loading, done, activeCategory, activeMention, searchQuery, categories, mentions, total, masterIndex, init, setCategory, setMention, setSearch, loadMore, refresh }
})
