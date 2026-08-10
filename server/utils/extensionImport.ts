// ---------------------------------------------------------------------------
// Extension Chrome scraper (ST-020) — validation + auth + mapping vers JoDetail.
//
// Logique PARTAGÉE entre la route `server/api/admin/import/extension.post.ts`
// et le test tsx `scripts/test-extension-import.ts`. Volontairement SANS
// dépendance aux globals Nitro (`defineEventHandler`, `readBody`, `createError`)
// pour être testable hors runtime via `npx tsx`.
//   - `parseExtensionPayload(body)` : validation STRICTE du body de l'extension
//     (allowlist plateformes, prix, devise, images ≤ 5, URLs, hôtes autorisés).
//     Toute donnée invalide lève `ExtensionImportError` (400).
//   - `buildDetailFromExtension(payload)` : mapping payload → `JoDetail`
//     (même contrat de sortie que le pipeline JustOneAPI / headless) pour
//     réutiliser `buildDraft` SANS dupliquer la logique (conversion XOF,
//     transport, catégorie auto, contact fournisseur, mention suggérée).
//   - `authorizeExtension(event)` : `x-ext-key` comparée en temps constant
//     (`safeEqual`) + fallback Bearer admin (`requireAuth`, rôle admin).
//     En production, si `EXTENSION_IMPORT_KEY` n'est PAS configurée → rejet 401
//     même si le fallback de dev est fourni. Fallback dev DOCUMENTÉ :
//     `bm-ext-import-dev-key` (local uniquement).
// ---------------------------------------------------------------------------

import type { JoCurrency, JoDetail, JoPlatform } from './justone'
import type { ProductMention } from '~~/types'
import { safeEqual, requireAuth } from './auth'

/** Clé de repli DEV UNIQUEMENT — documentée dans .env.example. En production la
 *  variable `EXTENSION_IMPORT_KEY` DOIT être définie (sinon rejet 401). */
export const EXTENSION_KEY_FALLBACK = 'bm-ext-import-dev-key'

/** Allowlist des plateformes acceptées (mêmes clés que JoPlatform). */
export const EXTENSION_PLATFORMS: JoPlatform[] = ['xianyu', '1688', 'taobao', 'tiktok-shop', 'amazon', 'douyin-ec']

/** Devises acceptées (mêmes que le pipeline JustOneAPI). */
const EXTENSION_CURRENCIES: JoCurrency[] = ['CNY', 'EUR', 'USD']

const MENTION_VALUES: ProductMention[] = ['neuf', 'occasion', 'gros']

const MAX_TITLE = 500
const MAX_DESC = 10_000
const MAX_SOURCE_ID = 120
const MAX_IMAGES = 5
const MAX_IMAGE_URL = 2000

/** Hôtes autorisés par plateforme (garde-fou : une URL d'une autre plateforme
 *  ou d'un domaine arbitraire ne peut pas être injectée comme source). */
const PLATFORM_HOSTS: Record<JoPlatform, RegExp[]> = {
  xianyu: [/(^|\.)goofish\.com$/i],
  1688: [/(^|\.)1688\.com$/i],
  taobao: [/(^|\.)taobao\.com$/i, /(^|\.)tmall\.com$/i],
  'tiktok-shop': [/(^|\.)tiktok\.com$/i],
  amazon: [/(^|\.)amazon\./i],
  'douyin-ec': [/(^|\.)douyin\.com$/i, /(^|\.)jinritemai\.com$/i],
}

/** Erreur métier portable (statusCode utilisable par la route/le test). */
export class ExtensionImportError extends Error {
  statusCode: number
  constructor(statusCode: number, message: string) {
    super(message)
    this.name = 'ExtensionImportError'
    this.statusCode = statusCode
  }
}

function fail(message: string): never {
  throw new ExtensionImportError(400, message)
}

function str(v: unknown, max = 500): string {
  return String(v ?? '').trim().slice(0, max)
}

function isHttpUrl(v: unknown): boolean {
  try {
    const u = new URL(String(v || ''))
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}

function assertAllowedHost(url: string, platform: JoPlatform): void {
  try {
    const host = new URL(url).hostname
    const ok = (PLATFORM_HOSTS[platform] || []).some((re) => re.test(host))
    if (!ok) fail(`URL non autorisée pour la plateforme ${platform}: ${host}`)
  } catch {
    fail(`URL invalide: ${url}`)
  }
}

/** Payload normalisé après validation stricte (ce que la route consomme). */
export interface ExtensionPayload {
  platform: JoPlatform
  sourceId: string
  url: string
  title: string
  chineseTitle?: string
  description?: string
  chineseDescription?: string
  price: number
  currency: JoCurrency
  images: string[]
  seller?: { nick?: string; city?: string; soldCount?: number }
  condition?: string
  category?: string
  mention?: ProductMention
}

/** Validation STRICTE du body de l'extension. Lève `ExtensionImportError` (400)
 *  sur toute donnée invalide. Cap explicite sur les longueurs pour éviter les
 *  payloads abusifs. */
export function parseExtensionPayload(body: any): ExtensionPayload {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    fail('Body JSON invalide (objet attendu).')
  }

  // --- platform (allowlist) ---
  const platformRaw = String(body.platform || '')
  const platform = EXTENSION_PLATFORMS.find((p) => p === platformRaw)
  if (!platform) {
    fail(`Plateforme non supportée: "${platformRaw}" (attendu: ${EXTENSION_PLATFORMS.join(', ')}).`)
  }

  // --- sourceId ---
  const sourceId = str(body.sourceId, MAX_SOURCE_ID)
  if (!sourceId) fail('sourceId manquant (identifiant produit sur la plateforme).')
  if (/[\u0000-\u001f]/.test(sourceId)) fail('sourceId invalide (caractères de contrôle).')

  // --- url (HTTPS + hôte autorisé pour la plateforme) ---
  const url = str(body.url, MAX_IMAGE_URL)
  if (!url || !isHttpUrl(url)) fail('url invalide (URL http(s) requise).')
  assertAllowedHost(url, platform)

  // --- titres / descriptions (longueurs bornées) ---
  const title = str(body.title, MAX_TITLE)
  if (!title) fail('title manquant (titre du produit).')
  const chineseTitle = body.chineseTitle == null ? undefined : str(body.chineseTitle, MAX_TITLE) || undefined
  const description = body.description == null ? undefined : str(body.description, MAX_DESC) || undefined
  const chineseDescription = body.chineseDescription == null ? undefined : str(body.chineseDescription, MAX_DESC) || undefined

  // --- prix + devise ---
  const price = Number(body.price)
  if (!Number.isFinite(price) || price <= 0 || price >= 1_000_000_000) {
    fail('price invalide (nombre strictement positif requis).')
  }
  const currency = EXTENSION_CURRENCIES.includes(body.currency) ? (body.currency as JoCurrency) : null
  if (!currency) {
    fail(`currency invalide: "${String(body.currency || '')}" (attendu: CNY, EUR ou USD).`)
  }

  // --- images (max 5, URLs http(s)) ---
  const rawImages = Array.isArray(body.images) ? body.images : []
  if (rawImages.length > MAX_IMAGES) fail(`images: au maximum ${MAX_IMAGES} URLs (reçu ${rawImages.length}).`)
  const images: string[] = []
  for (const img of rawImages) {
    const u = str(img, MAX_IMAGE_URL)
    if (!u || !isHttpUrl(u)) {
      fail('images: chaque entrée doit être une URL http(s) valide.')
    }
    images.push(u)
  }

  // --- seller (objet optionnel, champs connus uniquement) ---
  let seller: ExtensionPayload['seller'] = undefined
  if (body.seller != null) {
    if (typeof body.seller !== 'object' || Array.isArray(body.seller)) {
      fail('seller: objet optionnel attendu (nick, city, soldCount).')
    }
    const nick = str(body.seller.nick, 200)
    const city = str(body.seller.city, 200)
    const soldCount = Number(body.seller.soldCount)
    if (nick || city) {
      seller = {
        ...(nick ? { nick } : {}),
        ...(city ? { city } : {}),
        ...(Number.isFinite(soldCount) && soldCount > 0 ? { soldCount } : {}),
      }
    }
  }

  // --- condition / category / mention (taille bornée, mention normalisée) ---
  const condition = str(body.condition, 300) || undefined
  const category = str(body.category, 120) || undefined
  let mention: ProductMention | undefined
  if (body.mention != null) {
    const m = str(body.mention, 20).toLowerCase() as ProductMention
    if (!MENTION_VALUES.includes(m)) {
      fail(`mention invalide: "${String(body.mention || '')}" (attendu: neuf, occasion, gros).`)
    }
    mention = m
  }

  return {
    platform,
    sourceId,
    url,
    title,
    chineseTitle,
    description,
    chineseDescription,
    price,
    currency,
    images,
    seller,
    condition,
    category,
    mention,
  }
}

/** Mapping payload validé → `JoDetail` (contrat de sortie identique au pipeline
 *  JustOneAPI/headless) pour que `buildDraft` réutilise TOUTE la logique
 *  existante (conversion prix, transport, catégorie, contact, mention). */
export function buildDetailFromExtension(p: ExtensionPayload): JoDetail {
  return {
    platform: p.platform,
    sourceId: p.sourceId,
    // On privilégie le titre/descriptif SOURCE (chinois) pour alimenter
    // `chineseTitle`/`chineseDescription` du draft ; le titre FR passe via
    // DraftSource.titleFr (non re-traduit par Gemini).
    title: p.chineseTitle || p.title,
    desc: p.chineseDescription || p.description || '',
    images: p.images.slice(0, MAX_IMAGES),
    price: p.price,
    currency: p.currency,
    condition: p.condition,
    features: [],
    seller: p.seller?.nick
      ? { nick: p.seller.nick, city: p.seller.city, soldCount: p.seller.soldCount }
      : undefined,
    extra: { source: 'extension' },
  }
}

export function isProdRuntime(): boolean {
  return (
    process.env.NODE_ENV === 'production' ||
    String(process.env.NETLIFY) === 'true' ||
    Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME)
  )
}

export type ExtensionAuthResult =
  | { kind: 'ext' }
  | { kind: 'admin'; session: any }
  | { kind: 'denied'; statusCode: number; reason: string }

/**
 * Authentification de la route extension :
 *   1. `x-ext-key` comparée en TEMPS CONSTANT (`safeEqual`) à
 *      `EXTENSION_IMPORT_KEY` (env) ; fallback DEV documenté `bm-ext-import-dev-key`.
 *      En production, la variable doit être positionnée, sinon rejet 401 même
 *      avec le fallback de dev.
 *   2. Sinon Bearer admin : réutilise `requireAuth` + rôle `admin`.
 * Retourne toujours un résultat (jamais de throw hors `requireAuth` interne).
 */
export async function authorizeExtension(
  event: any,
  opts: { prod?: boolean } = {},
): Promise<ExtensionAuthResult> {
  const prod = opts.prod ?? isProdRuntime()
  const configured = String(process.env.EXTENSION_IMPORT_KEY || '').trim()
  const expected = configured || EXTENSION_KEY_FALLBACK
  const provided = String(event?.node?.req?.headers?.['x-ext-key'] || '')

  if (provided) {
    if (prod && !configured) {
      // Production sans clé configurée : REFUS explicite (pas de fallback dev).
      return {
        kind: 'denied',
        statusCode: 401,
        reason: 'EXTENSION_IMPORT_KEY non configurée en production — import via extension refusé.',
      }
    }
    if (safeEqual(provided, expected)) return { kind: 'ext' }
  }

  const bearer = String(event?.node?.req?.headers?.authorization || '')
  if (bearer.startsWith('Bearer ')) {
    try {
      const session = await requireAuth(event)
      if (session.role === 'admin') return { kind: 'admin', session }
      return { kind: 'denied', statusCode: 403, reason: 'Rôle administrateur requis pour importer vers le catalogue.' }
    } catch {
      // session invalide/expirée → rejet générique en bas.
    }
  }

  return {
    kind: 'denied',
    statusCode: 401,
    reason: "Accès refusé : clé d'extension (x-ext-key) manquante/incorrecte ou session admin invalide.",
  }
}