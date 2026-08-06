import { useRuntimeConfig } from '#app'
import { useAuthStore } from '~/stores/auth'
import { useGeo } from '~/composables/useGeo'

export interface TrackEvent {
  type: 'view' | 'click' | 'like' | 'unlike' | 'share' | 'copy' | 'comment'
  productId?: string
  productTitle?: string
  url: string
  ts: number
  userId?: string
  country?: string
  countryCode?: string
  city?: string
  region?: string
}

const GA_MAP: Record<string, string> = {
  view: 'view_item',
  click: 'generate_lead',
  like: 'like',
  unlike: 'like',
  share: 'share',
  copy: 'copy',
  comment: 'comment',
}

function gaEvent(name: string, params: Record<string, unknown> = {}) {
  const w = window as any
  if (typeof w.gtag === 'function') w.gtag('event', name, params)
}

/**
 * Central interaction/tracking engine (client-side).
 * Every user action fires a Vue `window` event that admin pages can subscribe
 * to for live updates, and is queued into a localStorage buffer that is
 * flushed to the backend (eventually an /api/events endpoint).
 *
 * This keeps interactions instant on the UI while stats accumulate server-side.
 */
export function useTrack() {
  const config = useRuntimeConfig()
  const storageKey = 'bm_events_v1'

  // ---- localStorage queue (instant, survives reload) ----
  function readQueue(): TrackEvent[] {
    try {
      const raw = localStorage.getItem(storageKey)
      const arr = raw ? JSON.parse(raw) : []
      return Array.isArray(arr) ? arr : []
    } catch {
      return []
    }
  }

  function writeQueue(q: TrackEvent[]) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(q.slice(-500)))
    } catch {
      /* storage full/unavailable -> ignore */
    }
  }

  // ---- fire an event: local queue + global Vue event + best-effort push ----
  async function track(ev: Partial<TrackEvent>) {
    const auth = useAuthStore()
    const geo = useGeo()
    const event: TrackEvent = {
      type: 'view',
      ...ev,
      userId: ev.userId || auth.user?.id,
      url: ev.url || window.location.pathname,
      ts: Date.now(),
      country: ev.country || geo.geo.value.country,
      countryCode: ev.countryCode || geo.geo.value.countryCode,
      city: ev.city || geo.geo.value.city,
      region: ev.region || geo.geo.value.region,
    }
    // Kick off IP geolocation (cached after the first success).
    geo.resolve()

    const q = readQueue()
    q.push(event)
    writeQueue(q)

    // Instant UI feedback: dispatch a window event (Vue listeners can react live)
    window.dispatchEvent(
      new CustomEvent('bm:track', { detail: event }),
    )

    // Google Analytics (GA4) custom events mirroring the tracked interactions.
    const gaName = GA_MAP[event.type]
    if (gaName) {
      gaEvent(gaName, {
        ...(event.productId ? { item_id: event.productId, product_id: event.productId } : {}),
        ...(event.productTitle ? { item_name: event.productTitle, item_title: event.productTitle } : {}),
        ...(event.city ? { city: event.city } : {}),
        ...(event.countryCode ? { country: event.countryCode } : {}),
        page_path: event.url,
        method: event.type === 'click' ? 'whatsapp' : undefined,
      })
    }

    // Best-effort push to backend. Views/clicks are fire-and-forget (losing one
    // is harmless), but likes/unlikes/comments mutate the server counters, so
    // those are retried with backoff — otherwise a concurrent-write failure
    // would silently drop the interaction and the count would reset on refresh.
    if (import.meta.client) {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (auth.token) headers.Authorization = `Bearer ${auth.token}`
      const critical = event.type === 'like' || event.type === 'unlike' || event.type === 'comment'
      const attempts = critical ? 4 : 1
      for (let i = 0; i < attempts; i++) {
        try {
          await fetch('/api/events', {
            method: 'POST',
            headers,
            body: JSON.stringify(event),
            keepalive: true,
          })
          break
        } catch {
          if (i === attempts - 1) break
          await new Promise((r) => setTimeout(r, 300 * (i + 1)))
        }
      }
    }
  }

  // ---- product-specific helpers ----
  function viewProduct(p: { id: string; title?: string }) {
    track({ type: 'view', productId: p.id, productTitle: p.title })
  }

  function clickPreorder(p: { id: string; title?: string }) {
    track({ type: 'click', productId: p.id, productTitle: p.title })
  }

  function like(p: { id: string; title?: string }, liked: boolean) {
    track({ type: liked ? 'like' : 'unlike', productId: p.id, productTitle: p.title })
  }

  function share(p: { id: string; title?: string }, method: 'wa' | 'x' | 'fb' | 'copy') {
    track({ type: 'share', productId: p.id, productTitle: p.title, url: `${config.public.siteUrl}/p/${p.id}.html` })
    if (method === 'copy') copyLink(p.id)
  }

  function copyLink(productId: string) {
    const url = `${config.public.siteUrl}/p/${productId}.html`
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url)
        .then(() => window.dispatchEvent(new CustomEvent('bm:copied', { detail: url })))
        .catch(() => {})
    }
  }

  return { track, viewProduct, clickPreorder, like, share, copyLink, readQueue }
}
