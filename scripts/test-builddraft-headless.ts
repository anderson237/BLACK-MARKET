// BL-007 — Preuve bout-en-bout TEMPORAIRE : scraper headless goofish → buildDraft
// (le même pipeline que la route /api/admin/import/from-url, sans auth).
// Usage : npx tsx --tsconfig .nuxt/tsconfig.json scripts/test-builddraft-headless.ts
import { scrapeGoofishDetail } from '../server/utils/scraperGoofish'
import { buildDraft } from '../server/utils/draftBuilder'

async function main() {
  const sourceId = '1072126350734'
  console.log(`[e2e] 1) scrapeGoofishDetail('${sourceId}')`)
  const detail = await scrapeGoofishDetail(sourceId)

  console.log(`[e2e] 2) buildDraft({ platform: 'xianyu', sourceId, detail, detailSource: 'headless' })`)
  const draft = await buildDraft({
    platform: 'xianyu',
    sourceId,
    detail,
    detailSource: 'headless',
    region: 'US',
  })

  const summary = {
    platform: draft.platform,
    sourceId: draft.sourceId,
    url: draft.url,
    title: draft.title,
    chineseTitle: draft.chineseTitle,
    description: (draft.description || '').slice(0, 80),
    price: draft.price,
    currency: draft.currency,
    priceXof: draft.priceXof,
    imageUrl: draft.imageUrl,
    galleryCount: (draft.gallery || []).length,
    gallery: (draft.gallery || []).slice(0, 3),
    condition: draft.condition,
    seller: draft.seller,
    metrics: draft.metrics,
    suggestedCategory: draft.suggestedCategory,
    transport: draft.transport,
    date: draft.date,
  }
  console.log('\n=== DRAFT (brouillon import) ===')
  console.log(JSON.stringify(summary, null, 2))

  const ok =
    draft.title && draft.price === 5300 && draft.currency === 'CNY' &&
    draft.priceXof > 0 && (draft.gallery || []).length > 0 && draft.seller?.nick
  console.log(ok ? '\n[e2e] SUCCÈS — brouillon complet sans appel JustOneAPI' : '\n[e2e] ÉCHEC')
  process.exit(ok ? 0 : 1)
}

main().catch((e) => { console.error('\n[e2e] ERREUR:', e?.message || e); process.exit(1) })
