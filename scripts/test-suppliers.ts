// ---------------------------------------------------------------------------
// ST-019 — Preuve : gestionnaire de fournisseurs (dashboard admin).
//
// Le test valide le CONTRAT de storage.ts (server/utils/storage.ts) :
//   - upsertSupplierFromProduct(product)   : capture auto à l'import
//   - createSupplier(...) / updateSupplier / deleteSupplier : CRUD manuel
//   - normalizeSupplierName / mergeSupplierInfo : dedup + fusion
//
// 6 scénarios demandés :
//   1. Création upsert (produit avec seller + contact -> fournisseur auto)
//   2. Dédup : 2 produits du même vendeur -> 1 fournisseur, productCount=2
//   3. Fusion contact : nouvelles infos fusionnées sans écraser l'existant
//   4. Ajout manuel (manual:true, productCount:0)
//   5. Édition (PUT) persistée
//   6. Dédup case-insensitive ('SUPPLIER-A' == 'supplier-a')
//
// Le fichier data/suppliers.json (local dev) est sauvegardé puis restauré pour
// ne pas polluer les données réelles.
//
// Usage : npx tsx --tsconfig .nuxt/tsconfig.json scripts/test-suppliers.ts
// ---------------------------------------------------------------------------

import fs from 'node:fs'
import path from 'node:path'
import {
  upsertSupplierFromProduct,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  listSuppliers,
  normalizeSupplierName,
  mergeSupplierInfo,
} from '../server/utils/storage'

const SUPPLIERS_FILE = path.join(process.cwd(), 'data', 'suppliers.json')

let failures = 0
function check(label: string, ok: boolean, detail?: string): void {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures += 1
}

/** Produit "persisté" façon publish.post.ts (sanitizeProduct léger). */
function makeProduct(overrides: any): any {
  return {
    id: overrides.id,
    title: overrides.title || 'Produit de test',
    description: 'desc',
    category: overrides.category || 'Techwear',
    priceXof: 1000,
    platform: overrides.platform || 'xianyu',
    seller: overrides.seller || undefined,
    supplierContact: overrides.supplierContact || undefined,
    createdAt: new Date().toISOString(),
  }
}

async function main() {
  console.log('[ST-019] Préparation : sauvegarde du data/suppliers.json (si présent)')
  const hadOriginal = fs.existsSync(SUPPLIERS_FILE)
  const originalRaw = hadOriginal ? fs.readFileSync(SUPPLIERS_FILE, 'utf-8') : null

  try {
    // ---- Scénario 1 : Création upsert ----
    console.log('\n[ST-019] 1) Création upsert (produit avec seller + contact)')
    const s1 = await upsertSupplierFromProduct(
      makeProduct({
        id: 'xy_p1',
        seller: { nick: 'supplier-a', city: '深圳' },
        supplierContact: { platform: 'xianyu', sourceId: 's1', wechat: 'wa_001' },
      }),
    )
    check('fournisseur créé', s1 !== null && s1 !== undefined, JSON.stringify(s1?.name))
    check('manual:false (auto)', s1?.manual === false, `manual=${s1?.manual}`)
    check('productCount:1', s1?.productCount === 1, `productCount=${s1?.productCount}`)
    check('productId associé', (s1?.productIds || []).includes('xy_p1'), JSON.stringify(s1?.productIds))
    check('contact wechat fusionné', s1?.wechat === 'wa_001', s1?.wechat)
    check('category suggérée du produit', s1?.category === 'Techwear', s1?.category)
    check('sourceId enregistré', (s1?.sourceIds || []).includes('s1'), JSON.stringify(s1?.sourceIds))
    check('stats.lastSeenAt posé', Boolean(s1?.stats?.lastSeenAt), s1?.stats?.lastSeenAt)

    // ---- Scénario 2 : Dédup productCount=2 ----
    console.log('\n[ST-019] 2) Dédup : 2 produits du même vendeur -> 1 fournisseur')
    const s2 = await upsertSupplierFromProduct(
      makeProduct({
        id: 'xy_p2',
        seller: { nick: 'supplier-a', soldCount: 842 },
        supplierContact: { platform: 'xianyu', sourceId: 's2', note: 'seconde commande' },
      }),
    )
    check('toujours 1 fournisseur (même id)', s2?.id === s1?.id, `id=${s2?.id}`)
    check('productCount:2', s2?.productCount === 2, `productCount=${s2?.productCount}`)
    check('2 productIds', (s2?.productIds || []).length === 2, JSON.stringify(s2?.productIds))
    check('wechat conservé du 1er contact', s2?.wechat === 'wa_001', s2?.wechat)
    check('note fusionnée depuis le 2e contact', s2?.note === 'seconde commande', s2?.note)
    check('stats.soldCount fusionné', s2?.stats?.soldCount === 842, String(s2?.stats?.soldCount))
    check('2 sourceIds', (s2?.sourceIds || []).length === 2, JSON.stringify(s2?.sourceIds))

    // ---- Scénario 3 : Fusion contact (ne doit pas écraser l'existant) ----
    console.log('\n[ST-019] 3) Fusion contact (email ajouté, wechat existant conservé)')
    const s3 = await upsertSupplierFromProduct(
      makeProduct({
        id: 'xy_p3',
        platform: '1688',
        category: 'Mode',
        seller: { nick: 'supplier-a' },
        supplierContact: { sourceId: 's3', email: 'contact@supplier-a.com', whatsapp: '+8613800000000' },
      }),
    )
    check('toujours 1 fournisseur (même id)', s3?.id === s1?.id)
    check('email fusionné', s3?.email === 'contact@supplier-a.com', s3?.email)
    check('whatsapp fusionné', s3?.whatsapp === '+8613800000000', s3?.whatsapp)
    check('wechat existant conservé (non écrasé)', s3?.wechat === 'wa_001', s3?.wechat)
    check('note existante conservée', s3?.note === 'seconde commande', s3?.note)
    check('platform 1688 ajoutée à la liste', (s3?.platforms || []).includes('1688'), JSON.stringify(s3?.platforms))
    check('platform xianyu conservée', (s3?.platforms || []).includes('xianyu'), JSON.stringify(s3?.platforms))
    check('productCount:3', s3?.productCount === 3, `productCount=${s3?.productCount}`)
    check('category initiale non écrasée (Techwear)', s3?.category === 'Techwear', s3?.category)

    // ---- Scénario 4 : Ajout manuel ----
    console.log('\n[ST-019] 4) Ajout manuel (createSupplier)')
    const manual = await createSupplier({ name: 'Fournisseur Manuel', country: 'France', wechat: 'fr_99', platforms: ['taobao'] })
    check('créé avec id slug', manual.id === 'fournisseur-manuel', manual.id)
    check('manual:true', manual.manual === true, `manual=${manual.manual}`)
    check('productCount:0', manual.productCount === 0, `productCount=${manual.productCount}`)
    check('country persisté', manual.country === 'France', manual.country)
    check('platforms persistées', JSON.stringify(manual.platforms) === JSON.stringify(['taobao']), JSON.stringify(manual.platforms))

    // Doublon manuel avec même nom normalisé -> doit échouer (409)
    let dupRejected = false
    try {
      await createSupplier({ name: '  fournisseur manuel ' })
    } catch {
      dupRejected = true
    }
    check('doublon manuel (même nom normalisé) rejeté', dupRejected)

    // ---- Scénario 5 : Édition (PUT) ----
    console.log('\n[ST-019] 5) Édition (updateSupplier)')
    const edited = await updateSupplier(manual.id, {
      name: 'Fournisseur Manuel Sarl',
      category: 'Mode',
      email: 'manuel@sarl.com',
      note: 'contact privilégié',
    })
    check('nom édité', edited?.name === 'Fournisseur Manuel Sarl', edited?.name)
    check('category édité', edited?.category === 'Mode', edited?.category)
    check('email édité', edited?.email === 'manuel@sarl.com', edited?.email)
    check('note éditée', edited?.note === 'contact privilégié', edited?.note)
    check('wechat existant conservé', edited?.wechat === 'fr_99', edited?.wechat)
    check('manual conservé à true', edited?.manual === true, `manual=${edited?.manual}`)
    check('updatedAt rafraîchi', edited && edited.updatedAt > manual.updatedAt)

    // Édition d'un fournisseur inconnu -> null (404 côté route)
    const missing = await updateSupplier('does-not-exist', { name: 'X' })
    check('édition fournisseur inconnu -> null', missing === null)

    // ---- Scénario 6 : Dédup case-insensitive ----
    console.log('\n[ST-019] 6) Dédup case-insensitive (" SUPPLIER-A " == "supplier-a")')
    const s4 = await upsertSupplierFromProduct(
      makeProduct({
        id: 'xy_p4',
        seller: { nick: '  SUPPLIER-A ' },
        supplierContact: { sourceId: 's4', email: 'case@sensitive.com' },
      }),
    )
    check('fusionné dans le MÊME fournisseur', s4?.id === s1?.id, `id=${s4?.id}`)
    check('1 seul fournisseur auto dans la liste', (await listSuppliers()).filter((s: any) => !s.manual).length === 1)
    check('productCount:4', s4?.productCount === 4, `productCount=${s4?.productCount}`)
    check('email fusionné aussi', s4?.email === 'contact@supplier-a.com', s4?.email)

    // ---- Lister + suppression ----
    console.log('\n[ST-019] 7) Liste + suppression (bonus)')
    const all = await listSuppliers()
    check('liste contient ≥ 2 fournisseurs', all.length >= 2, `n=${all.length}`)
    const removed = await deleteSupplier('fournisseur-manuel')
    check('suppression manuel effective', removed === true)
    check('suppression id inconnu -> false', (await deleteSupplier('nope')) === false)
    const after = await listSuppliers()
    check('liste reflète la suppression', after.some((s) => s.id === 'fournisseur-manuel') === false)

    // ---- Helper name normalization ----
    console.log('\n[ST-019] 8) Normalisation du nom (pure)')
    check('trim + lowercase + espaces', normalizeSupplierName('  Xiao  Nan TECH ') === 'xiao nan tech')
    const merged = mergeSupplierInfo(
      { id: 'x', name: 'Old', productCount: 1, productIds: ['a'], manual: false, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
      makeProduct({ id: 'b', seller: { nick: 'Old' }, supplierContact: { email: 'e@x.com' } }),
      '2026-08-09T00:00:00.000Z',
    )
    check('mergeSupplierInfo ajoute le productId', merged.productIds?.includes('b') === true && merged.productCount === 2)
    check('mergeSupplierInfo fusionne le contact', merged.email === 'e@x.com')
    check('mergeSupplierInfo conserve l\'existant', merged.name === 'Old' && merged.manual === false)
  } finally {
    console.log('\n[ST-019] Restauration du data/suppliers.json')
    if (hadOriginal) fs.writeFileSync(SUPPLIERS_FILE, originalRaw, 'utf-8')
    else if (fs.existsSync(SUPPLIERS_FILE)) fs.unlinkSync(SUPPLIERS_FILE)
  }

  console.log('\n' + (failures === 0 ? '✅ TOUS LES TESTS PASSENT' : `❌ ${failures} ÉCHEC(S)`))
  process.exitCode = failures === 0 ? 0 : 1
}

main()