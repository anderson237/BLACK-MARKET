import { useRuntimeConfig } from '#app'

export interface TrackEvent {
  type: 'view' | 'click' | 'like' | 'unlike' | 'share' | 'copy' | 'comment'
  productId?: string
  productTitle?: string
  url: string
  ts: number
  userId?: string
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
  function track(ev: Partial<TrackEvent>) {
    const event: TrackEvent = {
      type: 'view',
      ...ev,
      url: ev.url || window.location.pathname,
      ts: Date.now(),
    }
    const q = readQueue()
    q.push(event)
    writeQueue(q)

    // Instant UI feedback: dispatch a window event (Vue listeners can react live)
    window.dispatchEvent(
      new CustomEvent('bm:track', { detail: event }),
    )

    // Best-effort push to backend (fire and forget)
    if (import.meta.client) {
      fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
        keepalive: true,
      }).catch(() => {})
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
