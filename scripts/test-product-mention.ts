// ---------------------------------------------------------------------------
// ST-018 — Preuve : la mention produit « Neuf / Occasion / Gros » est persistée
// via sanitizeProduct (allowlist stricte), reste backward-compatible pour les
// produits anciens sans mention, et la suggestion auto à l'import (suggestMention
// dans server/utils/draftBuilder.ts) mappe correctement les signaux sources
// (1688 → gros, 二手/旧 → occasion, 全新 → neuf) vers une valeur normalisée FR.
//
// Le test valide le CONTRAT du pipeline :
//   - server/utils/product.ts        : sanitizeProduct(body).mention (allowlist)
//   - server/api/admin/import/publish.post.ts : body.mention du draft → produit
//     (reproduit ici par buildPublishProduct, même patterned que le test ST-017)
//   - server/utils/draftBuilder.ts   : suggestMention({ platform, condition,
//     sourceTitle, sourceDesc }) → 'neuf' | 'occasion' | 'gros' | undefined
//
// ⚠️ Le champ `condition` (texte brut source, ex. itemStatusStr goofish) reste
// DISTINCT de `mention` (valeur normalisée FR) : le test vérifie l'absence de
// collision entre les deux.
//
// Usage : npx tsx --tsconfig .nuxt/tsconfig.json scripts/test-product-mention.ts
// ---------------------------------------------------------------------------

import { sanitizeProduct } from '../server/utils/product'
import { suggestMention } from '../server/utils/draftBuilder'

let failures = 0
function check(label: string, ok: boolean, detail?: string): void {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures += 1
}

/** Reproduit la construction du produit dans publish.post.ts (mention incluse). */
function buildPublishProduct(body: any): any {
  const sourceUrl = String(body?.url || body?.sourceUrl || '').trim()
  const seller = body?.seller && typeof body.seller === 'object' ? body.seller : undefined
  const mention = String(body?.mention || '').trim()
  return sanitizeProduct({
    id: `xy_${body?.sourceId || ''}`,
    title: body?.title,
    description: body?.description,
    imageUrl: body?.imageUrl,
    category: body?.category,
    mention: mention || undefined,
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
  console.log('[ST-018] 1) Publish avec mention valide (draft import 1688 → Gros)')
  const draftOk = {
    platform: '1688',
    sourceId: '684375821012',
    title: 'Lot de t-shirts streetwear en gros',
    description: '<p>Vente en gros, prix dégressifs.</p>',
    imageUrl: 'https://img.alicdn.com/imgextra/i4/xxx.jpg',
    category: 'Streetwear',
    mention: 'gros',
    price: 12,
  }
  const published = buildPublishProduct(draftOk)
  check('mention valide persistée', published.mention === 'gros', String(published.mention))
  check('autres champs inchangés', published.title === draftOk.title && published.category === 'Streetwear' && published.priceXof === 0, '')
  // NOTE : `condition` (texte brut source) n'est PAS persisté sur le produit
  // publié (c'est une donnée de DRAFT / aperçu) — la séparation condition vs
  // mention normalisée FR est vérifiée au scénario 5 sur suggestMention.

  console.log('\n[ST-018] 2) Mention invalide / hors allowlist → rejetée (undefined)')
  const draftBad = buildPublishProduct({ ...draftOk, mention: 'gratté' })
  check('mention "gratté" → undefined', draftBad.mention === undefined, String(draftBad.mention))
  const draftBad2 = buildPublishProduct({ ...draftOk, mention: 'NEUF' })
  check('mention non normalisée "NEUF" → undefined (allowlist stricte)', draftBad2.mention === undefined, String(draftBad2.mention))
  const draftBad3 = buildPublishProduct({ ...draftOk, mention: 'occasions' })
  check('mention hors liste "occasions" → undefined', draftBad3.mention === undefined, String(draftBad3.mention))
  const draftTrim = buildPublishProduct({ ...draftOk, mention: ' occasion ' })
  check('mention nettoyable " occasion " → occasion (trim tolérant)', draftTrim.mention === 'occasion', String(draftTrim.mention))

  console.log('\n[ST-018] 3) Produit sans mention (manuel / ancien → backward compat)')
  const legacy = buildPublishProduct({
    sourceId: 'manual-42',
    title: 'Produit créé à la main',
    description: 'Pas de mention renseignée.',
    imageUrl: 'https://cdn.example.com/img.jpg',
    priceEur: 20,
    priceXof: 13119,
  })
  check('aucun crash, id valide', typeof legacy.id === 'string' && /^[a-zA-Z0-9_-]+$/.test(legacy.id), legacy.id)
  check('mention absente → undefined', legacy.mention === undefined, String(legacy.mention))
  check('titres/prix conservés', legacy.title === 'Produit créé à la main' && legacy.priceXof === 13119, '')

  console.log('\n[ST-018] 4) Idempotence (re-sanitize d\'un produit déjà persisté)')
  const twice = sanitizeProduct(published)
  check('mention identique après re-sanitize', twice.mention === published.mention, String(twice.mention))

  console.log('\n[ST-018] 5) Suggestion auto à l\'import (suggestMention)')
  check('1688 (nature B2B/wholesale) → gros', suggestMention({ platform: '1688', condition: '', sourceTitle: '' }) === 'gros', String(suggestMention({ platform: '1688' })))
  check('goofish condition "二手" → occasion', suggestMention({ platform: 'xianyu', condition: '二手', sourceTitle: '苹果手机' }) === 'occasion', String(suggestMention({ platform: 'xianyu', condition: '二手', sourceTitle: '苹果手机' })))
  check('goofish condition "95新旧" → occasion (旧)', suggestMention({ platform: 'xianyu', condition: '95新旧', sourceTitle: '' }) === 'occasion', String(suggestMention({ platform: 'xianyu', condition: '95新旧' })))
  check('condition "全新" → neuf', suggestMention({ platform: 'xianyu', condition: '全新', sourceTitle: '' }) === 'neuf', String(suggestMention({ platform: 'xianyu', condition: '全新' })))
  check('titre EN "used" → occasion', suggestMention({ platform: 'xianyu', condition: '', sourceTitle: 'iPhone used condition' }) === 'occasion', String(suggestMention({ platform: 'xianyu', condition: '', sourceTitle: 'iPhone used condition' })))
  check('titre EN "brand new" → neuf', suggestMention({ platform: 'xianyu', condition: '', sourceTitle: 'brand new shoes' }) === 'neuf', String(suggestMention({ platform: 'xianyu', condition: '', sourceTitle: 'brand new shoes' })))
  check('gros hors 1688 (批发) → gros', suggestMention({ platform: 'taobao', condition: '', sourceTitle: '批发女装' }) === 'gros', String(suggestMention({ platform: 'taobao', condition: '', sourceTitle: '批发女装' })))
  check('aucun signal → undefined (admin choisit)', suggestMention({ platform: 'xianyu', condition: '在线', sourceTitle: 'Veste' }) === undefined, String(suggestMention({ platform: 'xianyu', condition: '在线', sourceTitle: 'Veste' })))
  // Séparation des champs : `condition` (texte brut source) reste distinct de
  // la mention normalisée FR — la suggestion ne modifie jamais la source.
  {
    const rawCondition = '二手'
    const suggested = suggestMention({ platform: 'xianyu', condition: rawCondition })
    check('mention normalisée ≠ source brute (condition "二手" préservée)', suggested === 'occasion' && rawCondition === '二手', `mention=${String(suggested)} / condition=${rawCondition}`)
  }

  console.log('\n' + (failures === 0 ? '✅ TOUS LES TESTS PASSENT' : `❌ ${failures} ÉCHEC(S)`))
  process.exitCode = failures === 0 ? 0 : 1
}

main()