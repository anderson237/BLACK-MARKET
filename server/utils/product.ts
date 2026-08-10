export function sanitizeProduct(body: any): any {
  const clean = (v: unknown) => String(v ?? '').slice(0, 4000)
  // Champs courts du seller scrapé (nick, ville, taux) — pas d'objets géants.
  const cleanShort = (v: unknown) => String(v ?? '').trim().slice(0, 200)
  // Mention produit normalisée FR (ST-018) : allowlist stricte, sinon undefined.
  // Les produits anciens sans mention restent valides (champ optionnel partout).
  const VALID_MENTIONS = new Set<string>(['neuf', 'occasion', 'gros'])
  const rawMention = String(body?.mention ?? '').trim()
  const mention = VALID_MENTIONS.has(rawMention) ? (rawMention as 'neuf' | 'occasion' | 'gros') : undefined
  const id = clean(body?.id)
  const safeId = /^[a-zA-Z0-9_-]+$/.test(id) ? id : ''
  // Seller scrapé (import ST-017) : objet court limité aux champs utiles,
  // nettoyé. undefined si absent ou si aucun champ exploitable.
  const rawSeller = body?.seller && typeof body.seller === 'object' ? body.seller : undefined
  const seller = rawSeller
    ? {
        nick: cleanShort(rawSeller.nick) || undefined,
        city: cleanShort(rawSeller.city) || undefined,
        soldCount: Number(rawSeller.soldCount) > 0 ? Math.round(Number(rawSeller.soldCount)) : undefined,
        replyRatio24h: cleanShort(rawSeller.replyRatio24h) || undefined,
        newGoodRatioRate: cleanShort(rawSeller.newGoodRatioRate) || undefined,
        zhimaVerified: rawSeller.zhimaVerified === true,
      }
    : undefined
  const sellerHasInfo = !!seller && Object.values(seller).some((v) => (typeof v === 'boolean' ? v : Boolean(v)))
  return {
    ...body,
    id: safeId,
    title: clean(body?.title),
    description: clean(body?.description),
    originalDescription: clean(body?.originalDescription),
    chineseDescription: clean(body?.chineseDescription),
    chineseTitle: clean(body?.chineseTitle),
    imageUrl: clean(body?.imageUrl),
    gallery: Array.isArray(body?.gallery)
      ? body.gallery.slice(0, 12).map((u: unknown) => clean(u)).filter(Boolean)
      : [],
    videoUrl: body?.videoUrl ? clean(body.videoUrl) : undefined,
    category: clean(body?.category),
    // Mention normalisée FR (ST-018) — undefined si absente ou valeur invalide.
    mention,
    features: Array.isArray(body?.features)
      ? body.features.slice(0, 12).map((f: unknown) => clean(f))
      : [],
    priceEur: Number(body?.priceEur) || 0,
    priceXof: Number(body?.priceXof) || 0,
    discountPercent: Math.max(0, Math.min(100, Number(body?.discountPercent) || 0)),
    discountEndsAt: body?.discountEndsAt ? String(body.discountEndsAt).slice(0, 40) : undefined,
    sourceRmb: body?.sourceRmb ? Number(body.sourceRmb) : undefined,
    whatsappClicks: Number(body?.whatsappClicks) || 0,
    waNumber: body?.waNumber ? String(body.waNumber).replace(/[^0-9]/g, '').slice(0, 20) : undefined,
    deleted: body?.deleted === true,
    deletedAt: body?.deleted ? clean(body?.deletedAt) || new Date().toISOString() : undefined,
    createdAt: clean(body?.createdAt) || new Date().toISOString(),
    // URL source du produit importé (ex. Goofish) — undefined si vide.
    sourceUrl: clean(body?.sourceUrl) || undefined,
    // Seller scrapé à l'import — lecture seule, jamais un objet géant.
    seller: sellerHasInfo ? seller : undefined,
  }
}