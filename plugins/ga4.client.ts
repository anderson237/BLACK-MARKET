// Google Analytics 4 (GA4) loader. Reads the configured Measurement ID from the
// backend settings (admin-configurable, persisted in blobs) and injects gtag.
// Page views + tracked interactions (see useTrack) are reported to GA4 when the
// ID is set; otherwise gtag simply never loads (zero overhead).
export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  const router = useRouter()
  let gaId = ''

  async function load() {
    try {
      const res = await fetch('/api/settings', { headers: { Accept: 'application/json' } })
      if (res.ok) {
        const data = await res.json()
        gaId = String(data?.settings?.ga4Id || config.public.ga4Id || '').trim()
      }
    } catch {
      gaId = String(config.public.ga4Id || '').trim()
    }
    if (!gaId || typeof window === 'undefined') return

    const w = window as any
    w.dataLayer = w.dataLayer || []
    w.gtag = function () {
      w.dataLayer.push(arguments)
    }
    const script = document.createElement('script')
    script.async = true
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`
    document.head.appendChild(script)
    w.gtag('js', new Date())
    w.gtag('config', gaId, { send_page_view: false })
    w.gtag('event', 'page_view', { page_path: window.location.pathname })
    router.afterEach((to) => {
      w.gtag?.('event', 'page_view', { page_path: to.fullPath })
    })
  }

  if (import.meta.client) load()
})
