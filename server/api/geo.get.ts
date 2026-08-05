import { requireAuth } from '~~/server/utils/auth'
import { getSocial, loadAccounts, loadOrders } from '~~/server/utils/storage'
import { countryByCode, countryByName } from '~~/data/countries'

function clean(s: unknown): string {
  return String(s || '').trim().replace(/\s+/g, ' ')
}

interface CountryAgg {
  code: string
  name: string
  flag: string
  lat?: number
  lng?: number
  visitors: number
  customers: number
  orders: number
  visits: number
}

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  if (!['admin', 'editor', 'publisher'].includes(String(session.role || ''))) {
    throw createError({ statusCode: 403, statusMessage: 'Accès réservé à la gestion.' })
  }

  const [social, accounts, orders] = await Promise.all([getSocial(), loadAccounts(), loadOrders()])
  const events = Array.isArray(social.events) ? social.events : []

  const byCode = new Map<string, CountryAgg>()
  const visitorsByCountry = new Map<string, Set<string>>()
  const cityAgg = new Map<string, { city: string; count: number }>()

  function ensureCountry(code: string, name?: string): CountryAgg {
    const info = countryByCode(code)
    const key = info ? info.code : code || clean(name) || 'unknown'
    let agg = byCode.get(key)
    if (!agg) {
      agg = {
        code,
        name: clean(name) || info?.name || code || 'Inconnu',
        flag: info?.flag || '🏳️',
        lat: info?.lat,
        lng: info?.lng,
        visitors: 0,
        customers: 0,
        orders: 0,
        visits: 0,
      }
      byCode.set(key, agg)
    }
    if (info) {
      agg.code = info.code
      agg.name = info.name
      agg.flag = info.flag
      agg.lat = info.lat
      agg.lng = info.lng
    } else if (clean(name)) {
      agg.name = clean(name)
    }
    return agg
  }

  // Visitors + visits from the event log (geo attached client-side or via CDN).
  for (const e of events) {
    const code = clean(e.countryCode).toUpperCase()
    const name = clean(e.country)
    if (code || name) {
      const agg = ensureCountry(code, name)
      agg.visits++
      const uid = clean(e.userId || e.ip)
      if (uid) {
        const key = code || name
        if (!visitorsByCountry.has(key)) visitorsByCountry.set(key, new Set())
        visitorsByCountry.get(key)!.add(uid)
      }
    }
    const city = clean(e.city)
    if (city) {
      const k = city.toLowerCase()
      const cur = cityAgg.get(k)
      if (cur) cur.count++
      else cityAgg.set(k, { city, count: 1 })
    }
  }
  for (const [key, set] of visitorsByCountry) {
    const agg = byCode.get(key)
    if (agg) agg.visitors = set.size
  }

  // Customers: registered accounts grouped by their declared country.
  for (const a of accounts) {
    const name = clean(a.country)
    if (!name) continue
    const info = countryByName(name) || countryByCode(name)
    ensureCountry(info?.code || '', name).customers++
  }

  // Orders: customerLocation can hold either a country or a free-text city.
  for (const o of orders) {
    const loc = clean(o.customerLocation)
    if (!loc) continue
    const info = countryByName(loc) || countryByCode(loc)
    if (info) {
      ensureCountry(info.code, info.name).orders++
    } else if (loc !== '—') {
      const k = loc.toLowerCase()
      const cur = cityAgg.get(k)
      if (cur) cur.count++
      else cityAgg.set(k, { city: loc, count: 1 })
    }
  }

  const byCountry = [...byCode.values()]
    .map((x) => ({ ...x, total: x.visitors + x.customers + x.orders }))
    .sort((a, b) => b.total - a.total)
  const byCity = [...cityAgg.values()].sort((a, b) => b.count - a.count).slice(0, 50)

  const geoKeys = new Set<string>()
  for (const e of events) {
    if (e.countryCode || e.country || e.city) {
      const k = clean(e.userId || e.ip)
      if (k) geoKeys.add(k)
    }
  }

  const totals = {
    visitors: geoKeys.size,
    customers: accounts.reduce((n, a) => n + (clean(a.country) ? 1 : 0), 0),
    orders: orders.reduce((n, o) => n + (clean(o.customerLocation) ? 1 : 0), 0),
    countries: byCountry.length,
    cities: byCity.length,
    events: events.length,
  }

  return { byCountry, byCity, totals }
})
