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

/**
 * Fetches the live catalog (served by the API from Netlify Blobs).
 * The API already sanitizes and serves data; client only renders.
 */
export async function fetchCatalog(): Promise<Product[]> {
  const res = await fetch(apiUrl('/catalog.json'), { cache: 'no-store' })
  if (!res.ok) throw new Error(`catalog: ${res.status}`)
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

/**
 * Fetches a single product by id from the API.
 * Returns null when the product does not exist (renders 404).
 */
export async function fetchProduct(id: string): Promise<Product | null> {
  try {
    const res = await fetch(apiUrl(`/api/products/${encodeURIComponent(id)}`), { headers: { Accept: 'application/json' } })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`product: ${res.status}`)
    const json = await res.json()
    return json?.product || json || null
  } catch {
    // Fallback: the /api/products route is admin-only; read the public catalog
    // and match by id when the direct call is not authorized.
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

/** Builds the WhatsApp preorder message. */
export function buildWaMessage(product: Product, priceStr: string, productUrl: string): string {
  return (
    'Bonjour BLACK MARKET, 👋\n\n' +
    'Je souhaite passer une PRÉCOMMANDE pour le produit suivant :\n\n' +
    '  📦 PRODUIT : ' + String(product.title || '').toUpperCase() + '\n' +
    '  💰 PRIX : ' + priceStr + '\n' +
    '  🔗 FICHE PRODUIT : ' + productUrl + '\n\n' +
    'Merci de me confirmer la disponibilité, le délai de livraison et les modalités de paiement.\n\n' +
    "Dans l'attente de votre retour, je vous prie d'agréer mes salutations distinguées."
  )
}
