// ---------------------------------------------------------------------------
// ST-017 — Preuve : la publication d'un draft import persiste bien `sourceUrl`
// (URL source) + `seller` (infos vendeur scrapées), sans casser les produits
// anciens/manuels qui n'ont pas ces champs.
//
// Le test valide le CONTRAT du pipeline publish (server/api/admin/import/publish.post.ts) :
//   body.url  -> sourceUrl (nettoyé, undefined si vide)
//   body.seller -> seller (objet court { nick, city, soldCount, replyRatio24h,
//                                     newGoodRatioRate, zhimaVerified } uniquement)
// à travers sanitizeProduct (server/utils/product.ts).
//
// Usage : npx tsx --tsconfig .nuxt/tsconfig.json scripts/test-publish-source-seller.ts
// ---------------------------------------------------------------------------

import { sanitizeProduct } from '../server/utils/product'

let failures = 0
function check(label: string, ok: boolean, detail?: string): void {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures += 1
}

/** Reproduit la construction du produit dans publish.post.ts (sourceUrl + seller). */
function buildPublishProduct(body: any): any {
  const sourceUrl = String(body?.url || body?.sourceUrl || '').trim()
  const seller = body?.seller && typeof body.seller === 'object' ? body.seller : undefined
  return sanitizeProduct({
    id: `xy_${body?.sourceId || ''}`,
    title: body?.title,
    description: body?.description,
    imageUrl: body?.imageUrl,
    category: body?.category,
    priceEur: Number(body?.priceEur) || 0,
    priceXof: Number(body?.priceXof) || 0,
    sourceRmb: Number(body?.price) || undefined,
    supplierContact: body?.supplierContact,
    sourceUrl: sourceUrl || undefined,
    seller,
    createdAt: body?.createdAt || new Date().toISOString(),
  })
}

function main() {
  console.log('[ST-017] 1) Publish avec url + seller (draft Goofish complet)')
  const draft = {
    platform: 'xianyu',
    sourceId: '1072126350734',
    url: 'https://www.goofish.com/item?id=1072126350734',
    title: 'Veste Techwear Cyberpunk',
    description: '<p>Veste imperméable.</p>',
    imageUrl: 'https://img.alicdn.com/imgextra/i4/xxx.jpg',
    category: 'Techwear',
    price: 288,
    currency: 'CNY',
    seller: {
      nick: '赛博配件店',
      city: '深圳',
      soldCount: 842,
      goodRemarkCnt: 1532, // champs non persistés → doivent être retirés
      badRemarkCnt: 7,
      replyRatio24h: '99%',
      newGoodRatioRate: '98.6%',
      zhimaVerified: true,
      itemCount: 320,
    },
    supplierContact: { wechat: 'wb_2026', note: 'à contacter avant commande' },
  }
  const published = buildPublishProduct(draft)

  check('sourceUrl persisté', published.sourceUrl === 'https://www.goofish.com/item?id=1072126350734', published.sourceUrl)
  check('seller persisté', typeof published.seller === 'object' && published.seller !== null)
  check('seller.nick', published.seller?.nick === '赛博配件店', published.seller?.nick)
  check('seller.city', published.seller?.city === '深圳', published.seller?.city)
  check('seller.soldCount (nombre)', published.seller?.soldCount === 842, String(published.seller?.soldCount))
  check('seller.replyRatio24h', published.seller?.replyRatio24h === '99%', published.seller?.replyRatio24h)
  check('seller.newGoodRatioRate', published.seller?.newGoodRatioRate === '98.6%', published.seller?.newGoodRatioRate)
  check('seller.zhimaVerified (booléen)', published.seller?.zhimaVerified === true, String(published.seller?.zhimaVerified))

  const allowed = ['nick', 'city', 'soldCount', 'replyRatio24h', 'newGoodRatioRate', 'zhimaVerified']
  const extra = published.seller ? Object.keys(published.seller).filter((k) => !allowed.includes(k)) : ['__missing__']
  check('seller limité aux 6 champs propres (pas d\'objets géants)', extra.length === 0, `extra: ${extra.join(',') || 'aucun'}`)

  check('supplierContact toujours persisté', published.supplierContact?.wechat === 'wb_2026', published.supplierContact?.wechat)
  check('champs produit existants intacts', published.title === draft.title && published.priceXof === 0 && published.category === 'Techwear')

  console.log('\n[ST-017] 2) Publish SANS url/seller (produit manuel / ancien)')
  const legacy = buildPublishProduct({
    sourceId: 'manual-42',
    title: 'Produit créé à la main',
    description: 'Pas de scraping.',
    imageUrl: 'https://cdn.example.com/img.jpg',
    priceEur: 20,
    priceXof: 13119,
  })
  check('aucun crash, id valide', typeof legacy.id === 'string' && /^[a-zA-Z0-9_-]+$/.test(legacy.id), legacy.id)
  check('sourceUrl absent → undefined', legacy.sourceUrl === undefined, String(legacy.sourceUrl))
  check('seller absent → undefined', legacy.seller === undefined)
  check('titres/prix conservés', legacy.title === 'Produit créé à la main' && legacy.priceXof === 13119)

  console.log('\n[ST-017] 3) Publish avec sourceUrl vide / seller malformé (robustesse)')
  const dirty = buildPublishProduct({
    sourceId: 'dirty-7',
    title: 'Test robustesse',
    imageUrl: 'https://cdn.example.com/dirty.jpg',
    url: '   ',
    seller: { nick: '  ', city: null, soldCount: -5, zhimaVerified: false, replyRatio24h: '', newGoodRatioRate: '  ', garbage: { big: 'object' } },
  })
  check('sourceUrl vide → undefined', dirty.sourceUrl === undefined, String(dirty.sourceUrl))
  check('seller sans info exploitable → undefined', dirty.seller === undefined, String(JSON.stringify(dirty.seller)))
  check('id généré correctement', dirty.id === 'xy_dirty-7', dirty.id)

  console.log('\n[ST-017] 4) Idempotence (re-sanitize d\'un produit déjà persisté)')
  const twice = sanitizeProduct(published)
  check('sourceUrl identique après re-sanitize', twice.sourceUrl === published.sourceUrl)
  check('seller identique après re-sanitize', JSON.stringify(twice.seller) === JSON.stringify(published.seller))

  console.log('\n' + (failures === 0 ? '✅ TOUS LES TESTS PASSENT' : `❌ ${failures} ÉCHEC(S)`))
  process.exitCode = failures === 0 ? 0 : 1
}

main()
