export interface GeoInfo {
  country: string
  countryCode: string
  city: string
  region: string
}

const STORAGE_KEY = 'bm_geo_v1'

/**
 * Client-side geolocation (IP-based, best effort). Resolved once, cached in
 * localStorage, and attached to every tracked event so the admin audience map
 * can group visitors by country/city even for anonymous users.
 */
export function useGeo() {
  const geo = useState<GeoInfo>('bm-geo', () => ({ country: '', countryCode: '', city: '', region: '' }))
  const ready = useState<boolean>('bm-geo-ready', () => false)
  let started = false

  async function resolve(): Promise<GeoInfo> {
    if (started) return geo.value
    started = true
    if (!import.meta.client) return geo.value

    // Cached copy first — one network call per browser, then offline-friendly.
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const p = JSON.parse(raw)
        if (p && p.countryCode) {
          geo.value = { country: '', countryCode: '', city: '', region: '', ...p }
          ready.value = true
          return geo.value
        }
      }
    } catch {
      /* ignore */
    }

    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 4000)
    try {
      const res = await fetch('https://ipapi.co/json/', { signal: ctrl.signal })
      if (res.ok) {
        const d = await res.json()
        const info: GeoInfo = {
          country: String(d.country_name || ''),
          countryCode: String(d.country_code || d.country || '').toUpperCase(),
          city: String(d.city || ''),
          region: String(d.region || ''),
        }
        geo.value = info
        ready.value = true
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(info))
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* offline / blocked -> anonymous */
    } finally {
      clearTimeout(timer)
    }
    return geo.value
  }

  return { geo, ready, resolve }
}
