export default defineNuxtPlugin(() => {
  // Auto-refresh the live catalog so admin edits appear without reloading.
  if (import.meta.client) {
    const store = useCatalogStore()
    setInterval(() => {
      store.refresh()
    }, 15000)
  }
})
