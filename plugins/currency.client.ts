// Loads the active display currency once on the client (localStorage override
// wins; otherwise the site default from /api/settings). Uses a non-blocking
// async setup so prices can still render with XOF on first paint.
export default defineNuxtPlugin(() => {
  if (import.meta.client) {
    useCurrency().load()
  }
})
