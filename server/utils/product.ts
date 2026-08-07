export function sanitizeProduct(body: any): any {
  const clean = (v: unknown) => String(v ?? '').slice(0, 4000)
  const id = clean(body?.id)
  const safeId = /^[a-zA-Z0-9_-]+$/.test(id) ? id : ''
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
  }
}