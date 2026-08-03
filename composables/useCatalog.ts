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
