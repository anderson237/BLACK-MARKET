// ---------------------------------------------------------------------------
// Import via Extension Chrome scraper fournisseurs (ST-020).
//
// L'extension tourne dans le navigateur CONNECTÉ de l'admin (session + cookies
// réels) pour les plateformes non scrappables côté serveur (Taobao / 1688 /
// Amazon anti-bot / Goofish…). Le service worker de l'extension envoie le
// payload extrait (JSON capturé ou DOM) ici :
//   Body : { platform, sourceId, url, title, chineseTitle?, description?,
//            chineseDescription?, price (number), currency,
//            images: string[] (≤5), seller?, condition?, category?, mention? }
//
// Auth : header `x-ext-key` OU Bearer admin (`requireAuth`). La clé d'extension
//        `EXTENSION_IMPORT_KEY` (env) est comparée en TEMPS CONSTANT ; fallback
//        DEV documenté `bm-ext-import-dev-key` (local uniquement — en
//        production, clé absente ⇒ 401 explicite). Rate-limit par IP.
//
// Réutilise `buildDraft` / `DraftSource` (server/utils/draftBuilder.ts) pour
// TOUTE la logique existante : conversion prix (priceToXof/rates), transport,
// catégorie auto, contact fournisseur (getSupplierContact), mention suggérée.
// Retour : { success, source: { platform, sourceId, engine, url }, draft, draftId }
// — format identique à /api/admin/import/from-url (UI import inchangée).
//
// Pas de publication directe : l'admin valide via l'aperçu import existant
// (publish.post.ts reste INCHANGÉ).
//
// ST-020 : le draft est PERSISTÉ côté serveur (blob bm-extension-drafts) pour
// qu'il apparaisse dans la page Import (« Imports via extension ») — le popup
// reçoit `draftId` et ouvre `/admin/import?ext=<draftId>` qui pré-remplit
// l'aperçu sans ressaisie. Best-effort : un échec de persistance ne bloque pas
// l'import (le draft reste disponible dans le popup).
// ---------------------------------------------------------------------------

import crypto from 'node:crypto'
import { buildDraft, hasCjk, type DraftSource } from '~~/server/utils/draftBuilder'
import { rateLimit } from '~~/server/utils/auth'
import type { JoPlatform } from '~~/server/utils/justone'
import { upsertExtensionDraft } from '~~/server/utils/storage'
import {
  authorizeExtension,
  buildDetailFromExtension,
  ExtensionImportError,
  parseExtensionPayload,
} from '~~/server/utils/extensionImport'

export default defineEventHandler(async (event) => {
  // Gate 8 : rate-limit (par IP) sur l'import extension.
  rateLimit(60, 60_000)(event)

  // Auth : x-ext-key (temps constant) OU Bearer admin.
  const auth = await authorizeExtension(event)
  if (auth.kind === 'denied') {
    throw createError({ statusCode: auth.statusCode, statusMessage: auth.reason })
  }

  const body = await readBody(event)

  // Validation stricte du payload (allowlist plateformes, prix, devise,
  // images ≤ 5 URLs http(s), hôtes autorisés, longueurs bornées).
  let payload
  try {
    payload = parseExtensionPayload(body)
  } catch (err) {
    if (err instanceof ExtensionImportError) {
      throw createError({ statusCode: err.statusCode, statusMessage: err.message })
    }
    throw err
  }

  // Mapping payload → JoDetail (contrat identique au pipeline existant) puis
  // buildDraft : conversion XOF, transport, catégorie auto, contact, mention.
  const detail = buildDetailFromExtension(payload)
  // `title` FR fourni par l'extension → conservé tel quel (non re-traduit).
  // `chineseTitle`/`chineseDescription` restent tracés dans le draft.
  const draftSource: DraftSource = {
    platform: payload.platform as JoPlatform,
    sourceId: payload.sourceId,
    titleFr: hasCjk(payload.title) ? '' : payload.title,
    category: payload.category || '',
    // Amazon : région déduite du TLD de la page capturée (sinon US).
    region:
      payload.platform === 'amazon' && /\.amazon\.(fr|de|it|es|nl|se|pl|co\.uk)$/i.test(payload.url) ? 'FR' : 'US',
    detail,
    detailSource: 'extension',
  }

  const draft = await buildDraft(draftSource)
  // URL RÉELLE de la page capturée (pas l'URL canonique reconstruite) + mention
  // explicite envoyée par l'extension (champ distinct de `suggestedMention`).
  draft.url = payload.url
  if (payload.mention) draft.mention = payload.mention

  // ST-020 : persistance du draft pour la page Import (« Imports via
  // extension »). Best-effort : ne bloque jamais l'import.
  const draftId = `ext_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`
  try {
    await upsertExtensionDraft({
      id: draftId,
      platform: payload.platform,
      sourceId: payload.sourceId,
      draft,
      createdAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[extension-import] persistance du draft échouée (import OK) :', err)
  }

  console.log(
    `[extension-import] ${payload.platform} ${payload.sourceId} → draft (${payload.price} ${payload.currency} → ${draft.priceXof} FCFA, ${payload.images.length} image(s)) via ${auth.kind === 'ext' ? 'x-ext-key' : 'admin'}`,
  )

  return {
    success: true,
    source: {
      platform: payload.platform,
      sourceId: payload.sourceId,
      engine: 'extension',
      url: payload.url,
    },
    draft,
    draftId,
  }
})