// ---------------------------------------------------------------------------
// ST-020 — Test route Extension Chrome scraper (validation + auth + draft).
//
// Usage :
//   npx tsx --tsconfig .nuxt/tsconfig.json scripts/test-extension-import.ts
//
// La route `server/api/admin/import/extension.post.ts` est un wrapper fin :
//   - auth : `authorizeExtension`  (server/utils/extensionImport.ts)
//   - validation : `parseExtensionPayload` (mêmes fonctions, 400/401)
//   - draft : `buildDetailFromExtension` → `buildDraft` (pipeline existant)
// Ce test exerce donc EXACTEMENT les fonctions utilisées par la route, hors
// runtime Nitro (même pattern que scripts/test-suppliers.ts).
//
// Scénarios :
//   1. DRAFT COMPLET pour un payload Taobao simulé → assertions sur le titre,
//      le prix converti (priceXof via rates), les images, le transport, la
//      catégorie auto et la mention suggérée.
//   2. AUTH 401/403 : sans clé, mauvaise clé, clé correcte (dev fallback),
//      production sans EXTENSION_IMPORT_KEY configurée, Bearer admin OK,
//      Bearer non-admin refusé.
//   3. PAYLOAD INVALIDE (400) : body vide, prix ≤ 0, devise inconnue, plus de
//      5 images, plateforme inconnue, URL d'hôte non autorisé.
// ---------------------------------------------------------------------------
import fs from 'node:fs'
import path from 'node:path'
import { loadRates } from '../server/utils/rates'
import { buildDraft } from '../server/utils/draftBuilder'
import { signToken } from '../server/utils/auth'
import {
  authorizeExtension,
  buildDetailFromExtension,
  EXTENSION_KEY_FALLBACK,
  ExtensionImportError,
  parseExtensionPayload,
  EXTENSION_PLATFORMS,
} from '../server/utils/extensionImport'

const RESULTS = { passed: 0, failed: 0 }

function check(label: string, ok: boolean, detail?: string): void {
  if (ok) {
    RESULTS.passed++
    console.log(`  ✅ ${label}${detail ? ` — ${detail}` : ''}`)
  } else {
    RESULTS.failed++
    console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

function eventWith(headers: Record<string, string> = {}): any {
  return { node: { req: { headers } } }
}

/** Payload Taobao simulé (ce que content-isolated.js enverrait). */
function simulatedTaobaoPayload(): any {
  return {
    platform: 'taobao',
    sourceId: '724000123456',
    url: 'https://item.taobao.com/item.htm?id=724000123456',
    title: 'Casque Bluetooth sans fil 5.3 HiFi',
    chineseTitle: '无线蓝牙耳机 5.3 高保真',
    description: 'Casque sans fil avec réduction de bruit, autonomie 30h, Bluetooth 5.3.',
    price: 129,
    currency: 'CNY',
    images: [
      // URLs volontairement non joignables : importRemoteImage retombe dessus
      // (dégradé documenté) sans dépendre du réseau dans le test.
      'https://127.0.0.1:1/img-1.jpg',
      'https://127.0.0.1:1/img-2.jpg',
    ],
    seller: { nick: 'foshan-audio', city: 'Foshan' },
    condition: '全新',
    category: 'Écouteurs',
  }
}

// ---------------------------------------------------------------------------
// SCÉNARIO 1 — Draft complet (payload simulé)
// ---------------------------------------------------------------------------
async function scenarioDraftComplet(): Promise<void> {
  console.log('\n=== SCÉNARIO 1 — DRAFT COMPLET (payload Taobao simulé) ===')
  const payload = parseExtensionPayload(simulatedTaobaoPayload())

  check('payload validé (parseExtensionPayload)', Boolean(payload.platform === 'taobao'))
  check('sourceId normalisé', payload.sourceId === '724000123456')
  check('title conservé', payload.title === 'Casque Bluetooth sans fil 5.3 HiFi')

  const detail = buildDetailFromExtension(payload)
  check('detail.title = chineseTitle (source brute conservée)', detail.title === '无线蓝牙耳机 5.3 高保真')
  check('detail.desc = description', detail.desc === 'Casque sans fil avec réduction de bruit, autonomie 30h, Bluetooth 5.3.')
  check('detail.price/currency', detail.price === 129 && detail.currency === 'CNY')
  check('detail.images (≤5)', Array.isArray(detail.images) && detail.images.length === 2)

  const draft = await buildDraft({
    platform: payload.platform,
    sourceId: payload.sourceId,
    titleFr: payload.title, // titre FR fourni → non retraduit
    category: payload.category || '',
    detail,
    detailSource: 'extension',
  })

  check('draft.titre FR', draft.title === 'Casque Bluetooth sans fil 5.3 HiFi', String(draft.title))
  check('draft.chineseTitle tracé', draft.chineseTitle === '无线蓝牙耳机 5.3 高保真', String(draft.chineseTitle))
  check('draft.description FR', draft.description === 'Casque sans fil avec réduction de bruit, autonomie 30h, Bluetooth 5.3.')
  check('draft.platform/sourceId', draft.platform === 'taobao' && draft.sourceId === '724000123456')
  check('draft.prix source', draft.price === 129 && draft.currency === 'CNY', `¥${draft.price}`)

  const rates = await loadRates()
  const expectedXof = Math.round(129 * rates.cnyToXof)
  check('draft.prix converti (priceXof = 129 × taux CNY)', draft.priceXof === expectedXof, `${draft.priceXof} FCFA`)

  check('draft.gallery = 2 images (fallback URL conservé)', Array.isArray(draft.gallery) && draft.gallery.length === 2)
  check('draft.imageUrl = première image', draft.imageUrl === 'https://127.0.0.1:1/img-1.jpg')
  check(
    'gallery : URLs ou /api/img/ (aucune url vide)',
    (draft.gallery || []).every((u: string) => String(u).startsWith('http://') || String(u).startsWith('https://') || String(u).startsWith('/api/img/')),
  )
  check('draft.transport présent (Écouteurs, emballage inclus)', Boolean(draft.transport && draft.transport.airXof > 0))
  check('draft.transport.weightKg = 0.3 (Écouteurs)', draft.transport?.weightKg === 0.3, String(draft.transport?.weightKg))
  check('draft.catégorie auto = Écouteurs (détection CJK 耳机)', draft.suggestedCategory === 'Écouteurs', String(draft.suggestedCategory))
  check('draft.mention suggérée = neuf (condition 全新)', draft.suggestedMention === 'neuf', String(draft.suggestedMention))
  check('draft.seller nick conservé', draft.seller?.nick === 'foshan-audio')
  check('draft.supplierContact (optionnel)', draft.supplierContact === undefined || typeof draft.supplierContact === 'object')
  check('draft.date ISO', typeof draft.date === 'string' && !Number.isNaN(Date.parse(draft.date)))

  // Mention explicite envoyée par l'extension (champ distinct de suggestedMention).
  const withMention = parseExtensionPayload({ ...simulatedTaobaoPayload(), platform: '1688', url: 'https://detail.1688.com/offer/987654.html', sourceId: '987654', mention: 'gros' })
  check('mention explicite acceptée (1688 → gros)', withMention.mention === 'gros')

  // Mention AUTO pour 1688 (nature B2B/wholesale) même sans champ `mention`.
  const d1688 = await buildDraft({
    platform: '1688',
    sourceId: '987654',
    titleFr: 'Lot officiel',
    detail: buildDetailFromExtension({
      ...withMention,
      images: [],
    }),
    detailSource: 'extension',
  })
  check('draft 1688 : suggestion mention = gros (auto B2B)', d1688.suggestedMention === 'gros', String(d1688.suggestedMention))
}

// ---------------------------------------------------------------------------
// SCÉNARIO 2 — Auth (401 / 403)
// ---------------------------------------------------------------------------
async function scenarioAuth(): Promise<void> {
  console.log('\n=== SCÉNARIO 2 — AUTH x-ext-key / Bearer admin (401/403) ===')
  // Environnement contrôlé : pas de EXTENSION_IMPORT_KEY → fallback dev actif.
  delete process.env.EXTENSION_IMPORT_KEY

  const noKey = await authorizeExtension(eventWith({}))
  check('401 : clé ABSENTE → denied(401)', noKey.kind === 'denied' && noKey.statusCode === 401)

  const wrongKey = await authorizeExtension(eventWith({ 'x-ext-key': 'mauvaise-cle' }))
  check('401 : clé INCORRECTE → denied(401)', wrongKey.kind === 'denied' && wrongKey.statusCode === 401)

  const okKey = await authorizeExtension(eventWith({ 'x-ext-key': EXTENSION_KEY_FALLBACK }))
  check('clé dev fallback CORRECTE → kind ext', okKey.kind === 'ext')

  // Prod SANS EXTENSION_IMPORT_KEY : rejet même avec le fallback dev.
  const prodNoEnv = await authorizeExtension(eventWith({ 'x-ext-key': EXTENSION_KEY_FALLBACK }), { prod: true })
  check('401 : production sans EXTENSION_IMPORT_KEY → refusé', prodNoEnv.kind === 'denied' && prodNoEnv.statusCode === 401)

  // Prod AVEC clé configurée.
  process.env.EXTENSION_IMPORT_KEY = 'bm-ext-import-prod-key'
  const prodOk = await authorizeExtension(eventWith({ 'x-ext-key': 'bm-ext-import-prod-key' }), { prod: true })
  check('prod : clé configurée correcte → kind ext', prodOk.kind === 'ext')
  const prodBad = await authorizeExtension(eventWith({ 'x-ext-key': 'bm-ext-import-dev-key' }), { prod: true })
  check('401 : prod avec MAUVAISE clé → refusé', prodBad.kind === 'denied' && prodBad.statusCode === 401)
  delete process.env.EXTENSION_IMPORT_KEY

  // Bearer admin (vrai token signé localement) — happy path.
  const token = await signToken({ email: 'admin@test.local', name: 'Admin Test', role: 'admin', userId: 'test-admin' })
  const adminOk = await authorizeExtension(eventWith({ authorization: `Bearer ${token}` }))
  check('Bearer admin valide → kind admin', adminOk.kind === 'admin')

  // Bearer non-admin → 403.
  const userToken = await signToken({ email: 'user@test.local', name: 'User Test', role: 'user', userId: 'test-user' })
  const roleRefused = await authorizeExtension(eventWith({ authorization: `Bearer ${userToken}` }))
  check('403 : Bearer non-admin → refusé', roleRefused.kind === 'denied' && roleRefused.statusCode === 403)

  // Sans clé NI bearer → refusé (message générique).
  const none = await authorizeExtension(eventWith({}))
  check('401 : aucun credential → refusé', none.kind === 'denied' && none.statusCode === 401)
}

// ---------------------------------------------------------------------------
// SCÉNARIO 3 — Payload invalide (400)
// ---------------------------------------------------------------------------
function scenarioPayloadInvalide(): void {
  console.log('\n=== SCÉNARIO 3 — PAYLOAD INVALIDE (400) ===')

  const validBase = simulatedTaobaoPayload()

  const expect400 = (label: string, body: any): void => {
    try {
      parseExtensionPayload(body)
      check(`${label} → 400`, false, 'aucune erreur levée')
    } catch (err) {
      check(`${label} → 400`, err instanceof ExtensionImportError && err.statusCode === 400, err instanceof ExtensionImportError ? String(err.message).slice(0, 80) : String(err))
    }
  }

  expect400('body vide', {})
  expect400('body non-objet (null)', null)
  expect400('plateforme inconnue', { ...validBase, platform: 'etsy' })
  expect400('sourceId manquant', { ...validBase, sourceId: '' })
  expect400('title manquant', { ...validBase, title: '' })
  expect400('url manquante', { ...validBase, url: '' })
  expect400('url non-http', { ...validBase, url: 'ftp://item.taobao.com/x' })
  expect400('url hôte non autorisé (site tiers)', { ...validBase, url: 'https://evil.example/x' })
  expect400('prix manquant', { ...validBase, price: 0 })
  expect400('prix négatif', { ...validBase, price: -5 })
  expect400('prix non numérique', { ...validBase, price: 'gratuit' })
  expect400('devise inconnue', { ...validBase, currency: 'XOF' })
  expect400('6 images (> 5)', { ...validBase, images: Array.from({ length: 6 }, (_, i) => `https://127.0.0.1:1/x${i}.jpg`) })
  expect400('image non-URL', { ...validBase, images: ['pas-une-url'] })
  expect400('mention invalide', { ...validBase, mention: 'neufs' })
  expect400('seller non-objet', { ...validBase, seller: 'foshan-audio' })

  // Bonus : le payload valide de base passe TOUJOURS (6 plateformes, hôtes type).
  const sampleUrl: Record<string, string> = {
    xianyu: 'https://www.goofish.com/item?id=1071',
    1688: 'https://detail.1688.com/offer/987654.html',
    taobao: 'https://item.taobao.com/item.htm?id=724000123456',
    'tiktok-shop': 'https://shop.tiktok.com/view/product/123',
    amazon: 'https://www.amazon.fr/dp/B0TEST',
    'douyin-ec': 'https://haohuo.jinritemai.com/views/product/item2?id=123',
  }
  for (const p of EXTENSION_PLATFORMS) {
    const ok = parseExtensionPayload({ ...validBase, platform: p, url: sampleUrl[p], sourceId: 'sample' })
    check(`allowlist accepte ${p}`, ok.platform === p && ok.url === sampleUrl[p])
  }

  // ST-020 v2 : infos RICHES acceptées (attributs, variantes, emballage, moq…).
  const rich = parseExtensionPayload({
    ...validBase,
    platform: '1688',
    url: 'https://detail.1688.com/offer/987654.html',
    sourceId: '987654',
    attributes: [
      { name: '面料名称', value: '棉' },
      { name: '厚薄', value: '普通' },
      { name: '袖长', value: '短袖' },
    ],
    colors: ['白色', '黑色', '藏青色'],
    sizes: ['S', 'M', 'L', 'XL'],
    packaging: { unit: '白色 S', lengthCm: 40, widthCm: 28, heightCm: 0.5, volumeCm3: 560, weightGrams: 320 },
    moq: 2,
    shipFrom: '浙江金华',
    sales: { goodReviews: 50, addedToCart: 300 },
  })
  check('rich : attributs (3 paires)', rich.attributes?.length === 3 && rich.attributes![0].name === '面料名称')
  check('rich : couleurs (3) / tailles (4)', rich.colors?.length === 3 && rich.sizes?.length === 4)
  check('rich : emballage 40×28×0.5 · 560cm³ · 320g', rich.packaging?.lengthCm === 40 && rich.packaging?.weightGrams === 320 && rich.packaging?.volumeCm3 === 560)
  check('rich : moq=2 / shipFrom / sales', rich.moq === 2 && rich.shipFrom === '浙江金华' && rich.sales?.addedToCart === 300)

  expect400('31 attributs (>30)', { ...validBase, attributes: Array.from({ length: 31 }, (_, i) => ({ name: `a${i}`, value: 'v' })) })
  expect400('attribut sans name', { ...validBase, attributes: [{ value: 'v' }] })
  expect400('attribut non-objet', { ...validBase, attributes: ['棉'] })
  expect400('moq = 0', { ...validBase, moq: 0 })
  expect400('moq non entier', { ...validBase, moq: 2.5 })
  expect400('packaging non-objet', { ...validBase, packaging: 'carton' })
  expect400('sales non-objet', { ...validBase, sales: 50 })
  check('31 couleurs trop (>60) → ok si ≥', (() => { const p = parseExtensionPayload({ ...validBase, colors: Array.from({ length: 80 }, (_, i) => `c${i}`) }); return (p.colors || []).length <= 60 })())

  // ST-020 v2 : vidéo produit (valide acceptée, invalides rejetées).
  const withVideo = parseExtensionPayload({ ...validBase, videoUrl: 'https://cloud.video.taobao.com/play/u/p/1/1.mp4' })
  check('videoUrl valide acceptée', withVideo.videoUrl === 'https://cloud.video.taobao.com/play/u/p/1/1.mp4')
  expect400('videoUrl non-URL', { ...validBase, videoUrl: 'pas-une-url' })
  expect400('videoUrl ftp://', { ...validBase, videoUrl: 'ftp://x/y.mp4' })
  expect400('videoUrl blob:', { ...validBase, videoUrl: 'blob:https://detail.1688.com/abc' })
}

// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  // Environnement contrôlé : aucune .env chargée, on supprime les variables
  // qui pourraient déclencher un appel Gemini / une clé d'extension réelle.
  const saved: Record<string, string | undefined> = {}
  for (const k of ['EXTENSION_IMPORT_KEY', 'GEMINI_API_KEY']) {
    saved[k] = process.env[k]
    delete process.env[k]
  }
  const sessionSecretPath = path.join(process.cwd(), 'data', 'session-secret')
  const hadSessionSecret = fs.existsSync(sessionSecretPath)

  try {
    await scenarioDraftComplet()
    await scenarioAuth()
    scenarioPayloadInvalide()

    console.log(`\n[test] Assertions passées : ${RESULTS.passed}/${RESULTS.passed + RESULTS.failed}`)
    if (RESULTS.failed > 0) {
      console.log(`[test] ${RESULTS.failed} assertion(s) ÉCHOUÉE(S)`)
      process.exitCode = 1
    } else {
      console.log('[test] SUCCÈS')
    }
  } finally {
    // Restauration de l'environnement + artefacts de test.
    for (const k of Object.keys(saved)) {
      if (saved[k] === undefined) delete process.env[k]
      else process.env[k] = saved[k]
    }
    if (!hadSessionSecret) {
      try {
        fs.rmSync(sessionSecretPath, { force: true })
      } catch {
        /* best-effort */
      }
    }
  }
}

main().catch((err) => {
  console.error('\n[test] ERREUR:', err?.message || err)
  process.exit(1)
})