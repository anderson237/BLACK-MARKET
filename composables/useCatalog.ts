import type { Product } from '~/types'

/**
 * Resolves an absolute URL for server-side fetches (Node fetch requires an
 * absolute URL) and a relative URL on the client. On the server we use the
 * current request origin; in dev that's localhost, in prod the live domain.
 */
export function apiUrl(path: string): string {
  if (import.meta.server) {
    try {
      const reqURL = useRequestURL()
      return reqURL.origin.replace(/\/+$/, '') + path
    } catch {
      /* fall through */
    }
  }
  return path
}

export async function fetchCatalog(): Promise<Product[]> {
  const data = await $fetch('/catalog.json', { cache: 'no-store' })
  return Array.isArray(data) ? data : []
}

/**
 * Fetches a single product by id from the API.
 * Returns null when the product does not exist (renders 404).
 *
 * Uses `$fetch`/`useRequestFetch`: on the server this is handled locally
 * (in-process) by Nuxt instead of a real outgoing HTTP self-fetch, which can
 * fail transiently on serverless (Netlify) cold starts and could otherwise
 * produce a bogus 404.
 */
export async function fetchProduct(id: string): Promise<Product | null> {
  try {
    const json = await $fetch(`/api/products/${encodeURIComponent(id)}`, { headers: { Accept: 'application/json' } })
    return json?.product || json || null
  } catch (err: any) {
    // 404 -> product genuinely not found.
    if (err?.response?.status === 404) return null
    // Anything else (network hiccup): fall back to the public catalog so a
    // transient failure never turns a real product into "Produit introuvable".
    const all = await fetchCatalog()
    return all.find((p) => p.id === id) || null
  }
}

/** Formats a price in the configured currency. */
export function formatPriceXof(priceXof: number): string {
  return Number(priceXof || 0).toLocaleString('fr-FR') + ' F CFA'
}

export function formatPriceEur(priceEur: number): string {
  return Number(priceEur || 0) + ' €'
}

/** Pourcentage de réduction actif. 0 si aucune promo. */
export function promoPercent(p: { discountPercent?: number; discountEndsAt?: string }): number {
  const pct = Number(p?.discountPercent) || 0
  if (pct <= 0) return 0
  const endsAt = p?.discountEndsAt
  const end = endsAt ? new Date(endsAt).getTime() : NaN
  if (!Number.isNaN(end) && end <= Date.now()) return 0 // promo expirée
  return Math.min(100, Math.round(pct))
}

/** Prix barré (sans réduction). C'est simplement le prix enregistré. */
export function saleBasePrice(priceXof: number): number {
  return Number(priceXof || 0)
}

/** Prix après réduction (affiché). */
export function promoPrice(p: { priceXof?: number; discountPercent?: number; discountEndsAt?: string }): number {
  const base = Number(p?.priceXof) || 0
  const pct = promoPercent(p)
  if (pct <= 0) return base
  const discounted = Math.round(base * (1 - pct / 100) / 50) * 50
  return Math.max(0, discounted)
}

/** Countdown restant pour la promo ("3j 04h 12m 08s"). */
export function promoCountdown(endsAt?: string, now: number = Date.now()): string {
  const end = endsAt ? new Date(endsAt).getTime() : NaN
  if (Number.isNaN(end) || end <= now) return ''
  const s = Math.max(0, Math.floor((end - now) / 1000))
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return d > 0 ? `${d}j ${pad(h)}h ${pad(m)}m ${pad(sec)}s` : `${pad(h)}h ${pad(m)}m ${pad(sec)}s`
}

/** True si la promo est active (réduction + pas expirée). */
export function hasPromo(p: { discountPercent?: number; discountEndsAt?: string }): boolean {
  return promoPercent(p) > 0
}

/** Builds the WhatsApp preorder/order message. */
export function buildWaMessage(product: Product, priceStr: string, productUrl: string): string {
  const isStock = product.stockStatus === 'in_stock'
  const header = isStock
    ? 'Je souhaite passer une COMMANDE pour le produit suivant :'
    : 'Je souhaite passer une PRÉCOMMANDE pour le produit suivant :'
  const lines: string[] = [
    'Bonjour DEEP ROOTS, 👋',
    '',
    header,
    '',
    '  📦 PRODUIT : ' + String(product.title || '').toUpperCase(),
    '  💰 PRIX : ' + priceStr,
  ]
  if (Number(product.moq) > 0) {
    lines.push('  📌 MOQ : ' + Number(product.moq) + ' unité(s) minimum')
  }
  if (Number(product.stockQuantity) > 0) {
    lines.push('  🏷️ DISPONIBLE : ' + Number(product.stockQuantity) + ' unité(s) en stock')
  }
  lines.push('  🔗 FICHE PRODUIT : ' + productUrl + '\n')
  lines.push(isStock
    ? 'Merci de me confirmer la disponibilité, le délai de livraison et les modalités de paiement.'
    : 'Merci de me confirmer la disponibilité, le délai de livraison et les modalités de paiement.')
  lines.push('', "Dans l'attente de votre retour, je vous prie d'agréer mes salutations distinguées.")
  return lines.join('\n')
}

