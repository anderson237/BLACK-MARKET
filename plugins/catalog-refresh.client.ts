export default defineNuxtPlugin(() => {
  // Auto-refresh the live catalog so admin edits appear without reloading.
  if (import.meta.client) {
    const store = useCatalogStore()
    setInterval(() => {
      store.refresh()
    }, 15000)
    // Snappier re-sync when the visitor comes back to the tab.
    let t: ReturnType<typeof setTimeout> | null = null
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      if (t) clearTimeout(t)
      t = setTimeout(() => store.refresh(), 300)
    }
    window.addEventListener('focus', onVisible)
    document.addEventListener('visibilitychange', onVisible)
  }
})
