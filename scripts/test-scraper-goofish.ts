// ---------------------------------------------------------------------------
// BL-007 — Test local du scraper headless goofish (ST-017).
// Usage : npx tsx scripts/test-scraper-goofish.ts [sourceId]
//
// Ouvre le lien réel goofish via scrapeGoofishDetail() (MTOP intercepté puis
// fallback DOM) et vérifie le format normalisé identique au flattener
// JustOneAPI (JoDetail) : titre, prix CNY, images alicdn, description,
// vendeur.
// ---------------------------------------------------------------------------

import { scrapeGoofishDetail } from '../server/utils/scraperGoofish'

const SOURCE_ID = process.argv[2] || '1072126350734' // iPhone 16 Pro Max (Lab)

function check(label: string, ok: boolean, detail?: string): void {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) process.exitCode = 1
}

async function main(): Promise<void> {
  const t0 = Date.now()
  console.log(`[test] scrapeGoofishDetail('${SOURCE_ID}') …`)
  const detail = await scrapeGoofishDetail(SOURCE_ID)

  console.log('\n=== Résultat normalisé (format JoDetail / flattenXianyuDetail) ===')
  console.log(JSON.stringify(
    {
      platform: detail.platform,
      sourceId: detail.sourceId,
      title: detail.title,
      desc: (detail.desc || '').slice(0, 160),
      images: detail.images,
      imageCount: detail.images?.length,
      price: detail.price,
      currency: detail.currency,
      condition: detail.condition,
      features: detail.features,
      seller: detail.seller,
      wantCnt: detail.wantCnt,
      browseCnt: detail.browseCnt,
      favorCnt: detail.favorCnt,
    },
    null,
    2,
  ))

  console.log(`\n=== Validation (durée ${((Date.now() - t0) / 1000).toFixed(1)} s) ===`)
  check('platform === "xianyu"', detail.platform === 'xianyu', String(detail.platform))
  check('sourceId présent', Boolean(detail.sourceId), String(detail.sourceId))
  check('titre non vide', Boolean(detail.title), detail.title)
  check('prix CNY > 0', detail.price > 0, `${detail.price} ${detail.currency}`)
  check('devise CNY', detail.currency === 'CNY', detail.currency)
  check('images alicdn (> 0)', (detail.images || []).length > 0, `${detail.images?.length} image(s)`)
  check('images sur CDN alicdn', (detail.images || []).every((u) => u.includes('alicdn')))
  check('description non vide', Boolean(detail.desc), (detail.desc || '').slice(0, 60))
  if (detail.seller) {
    check('vendeur nick présent', Boolean(detail.seller.nick), detail.seller.nick)
    check('vendeur ville présent', Boolean(detail.seller.city), detail.seller.city)
  } else {
    check('vendeur présent', false, 'seller absent')
  }

  console.log('\n[test] ' + (process.exitCode ? 'ÉCHEC' : 'SUCCÈS'))
}

main().catch((err) => {
  console.error('\n[test] ERREUR:', err?.message || err)
  process.exit(1)
})
