import crypto from 'node:crypto'
import { Type } from '@google/genai'
import { requireAuth } from '~~/server/utils/auth'
import { loadProducts, saveProducts, upsertSupplierFromProduct } from '~~/server/utils/storage'
import { sanitizeProduct } from '~~/server/utils/product'
import { publishSiteUpdate } from '~~/server/utils/realtime'
import { getAI, geminiModel, geminiFallbackModel, generateContentWithRetry } from '~~/server/utils/ai'
import { hasCjk } from '~~/server/utils/draftBuilder'
import { priceToXof, type JoPlatform } from '~~/server/utils/justone'

// Admin import pipeline (ST-017) — publish step.
// Body: {
//   platform, sourceId, title, description, chineseDescription, price?, currency?,
//   imageUrl, gallery[], features[] (strings), category?
//   mention?                     // mention normalisée FR (ST-018) : neuf|occasion|gros
//   url?, seller?          // provenance scraping (sourceUrl + seller persistés)
//   supplierContact?       // contact fournisseur éditable (persisté)
// }
// Optional AI enrichment (translate + sales pitch + price) runs when
// `aiEnrich: true` and GEMINI_API_KEY is configured. Otherwise the payload
// is published as-is (admin already typed the FR copy).
const VALID_PLATFORMS = new Set<JoPlatform>(['xianyu', '1688', 'taobao', 'tiktok-shop', 'amazon', 'douyin-ec'])

function platformLabel(p: string): string {
  switch (p) {
    case 'xianyu': return 'Xianyu (Goofish)'
    case '1688': return '1688 (gros)'
    case 'taobao': return 'Taobao / Tmall'
    case 'tiktok-shop': return 'TikTok Shop'
    case 'amazon': return 'Amazon'
    case 'douyin-ec': return 'Douyin E-commerce'
    default: return p
  }
}

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  if (session.role !== 'admin') throw createError({ statusCode: 403, statusMessage: 'Accès administrateur requis.' })
  const body = await readBody(event)

  const sourceId = String(body?.sourceId || '').trim()
  const rawPlatform = String(body?.platform || 'xianyu')
  const platform: JoPlatform = VALID_PLATFORMS.has(rawPlatform as JoPlatform) ? (rawPlatform as JoPlatform) : 'xianyu'
  let title = String(body?.title || '').trim()
  let description = String(body?.description || '').trim()
  const chineseDescription = String(body?.chineseDescription || '').trim()
  const chineseTitle = String(body?.chineseTitle || '').trim()
  const imageUrl = String(body?.imageUrl || '').trim()
  const gallery = Array.isArray(body?.gallery)
    ? (body.gallery as unknown[]).map((u) => String(u).trim()).filter(Boolean).slice(0, 12)
    : []
  const features = Array.isArray(body?.features)
    ? (body.features as unknown[]).map((f) => String(f).trim()).filter(Boolean).slice(0, 12)
    : []
  const category = String(body?.category || '').trim()
  // Mention produit normalisée FR (ST-018) : valeur libre du draft import,
  // validée par l'allowlist de sanitizeProduct (sinon undefined → backward compat).
  const mention = String(body?.mention || '').trim()
  const price = Number(body?.price) || 0
  const currencyRaw = String(body?.currency || 'CNY').toUpperCase()
  const currency = currencyRaw === 'EUR' ? 'EUR' : currencyRaw === 'USD' ? 'USD' : 'CNY'
  const aiEnrich = body?.aiEnrich === true
  const moq = Number(body?.moq)
  const priceTiers = Array.isArray(body?.priceTiers) ? body.priceTiers.slice(0, 6) : undefined
  const stock = Number(body?.stock)
  // Provenance scraping (ST-017) : URL source + seller du draft d'import.
  // `url` est le champ du draftBuilder ; `sourceUrl` est accepté en alias pour
  // compatibilité. Le seller brut est nettoyé par sanitizeProduct.
  const sourceUrl = String(body?.url || body?.sourceUrl || '').trim()
  const seller = body?.seller && typeof body.seller === 'object' ? body.seller : undefined
  // ST-020 v2 : infos riches capturées par l'extension (1688…) — attributs,
  // variantes, emballage, expédition. Persistées sur le produit (sanitizeProduct
  // conserve les champs supplémentaires via son spread `...body`).
  const attributes = Array.isArray(body?.attributes)
    ? body.attributes
        .slice(0, 30)
        .map((a: any) => ({
          name: String(a?.name || '').trim().slice(0, 60),
          value: String(a?.value || '').trim().slice(0, 600),
        }))
        .filter((a: any) => a.name && a.value)
    : undefined
  const colors = Array.isArray(body?.colors)
    ? body.colors.map((c: any) => String(c).trim().slice(0, 60)).filter(Boolean).slice(0, 60)
    : undefined
  const sizes = Array.isArray(body?.sizes)
    ? body.sizes.map((s: any) => String(s).trim().slice(0, 20)).filter(Boolean).slice(0, 20)
    : undefined
  const pkgNum = (k: string): number | undefined => {
    const n = Number((body?.packaging || {})[k])
    return Number.isFinite(n) && n >= 0 && n < 1_000_000 ? n : undefined
  }
  const packaging =
    body?.packaging && typeof body.packaging === 'object' && !Array.isArray(body.packaging)
      ? {
          unit: String(body.packaging.unit || '').trim().slice(0, 30) || undefined,
          lengthCm: pkgNum('lengthCm'),
          widthCm: pkgNum('widthCm'),
          heightCm: pkgNum('heightCm'),
          volumeCm3: pkgNum('volumeCm3'),
          weightGrams: pkgNum('weightGrams'),
        }
      : undefined
  const shipFrom = String(body?.shipFrom || '').trim().slice(0, 200) || undefined
  const scRaw = body?.supplierContact || {}
  const supplierContact =
    scRaw && typeof scRaw === 'object' && (scRaw.wechat || scRaw.email || scRaw.whatsapp || scRaw.phone || scRaw.website || scRaw.note)
      ? {
          wechat: String(scRaw.wechat || '').trim() || undefined,
          email: String(scRaw.email || '').trim() || undefined,
          whatsapp: String(scRaw.whatsapp || '').trim() || undefined,
          phone: String(scRaw.phone || '').trim() || undefined,
          website: String(scRaw.website || '').trim() || undefined,
          note: String(scRaw.note || '').trim() || undefined,
        }
      : undefined

  if (!sourceId || !title) throw createError({ statusCode: 400, statusMessage: 'Identifiant source et titre requis.' })
  if (!imageUrl && gallery.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Au moins une image est requise.' })
  }

  // Optional AI enrichment: translate to FR, craft a sales pitch and a
  // suggested price. Runs only when explicitly requested + key configured.
  // ST-017 v3 : le draft d'import est déjà traduit en FR automatiquement
  // (description sans CJK) → on l'indique au modèle pour éviter une double
  // traduction : il affine/polish la copie FR au lieu de retraduire depuis
  // le chinois. Le chinois original reste fourni en contexte de fidélité.
  let enriched: any = null
  if (aiEnrich) {
    const ai = getAI()
    if (!ai) throw createError({ statusCode: 503, statusMessage: "Le service d'IA n'est pas configuré (GEMINI_API_KEY manquante)." })
    const alreadyFrenchTitle = Boolean(title) && !hasCjk(title)
    const alreadyFrenchDesc = Boolean(description) && !hasCjk(description)
    const prompt = `
Produit importé de ${platformLabel(platform)} — titre source : "${chineseTitle || title}".
Description source : "${chineseDescription || description}".
Prix d'achat : ${price || 'inconnu'} ${currency}.
${alreadyFrenchDesc ? '1. La description fournie est DÉJÀ en français (traduction auto à l\'import). NE LA RETRADUIS PAS depuis le chinois : garde-la telle quelle, ou améliore-la légèrement si le style le mérite.' : '1. Traduis/adapte la description en français de manière claire et fidèle.'}
${alreadyFrenchTitle ? '2. Le titre fourni est DÉJÀ en français : conserve-le tel quel (améliorations de style mineures acceptées).' : '2. Traduis le titre en français (titre commercial accrocheur, marché francophone/africain).'}
3. Rédige un argumentaire de vente premium en français (bénéfices clients, crédible).
4. Extrais 3 à 5 caractéristiques techniques clés.
5. Suggère un prix de vente EUR et XOF. Convertis le prix d'achat (1 RMB ≈ 95 XOF, 1 EUR = 655.957 XOF, 1 USD ≈ 700 XOF) et applique une marge d'importation réaliste (frais d'envoi 5-10 € / 3000-6000 XOF inclus).
Réponds strictement en JSON au schéma demandé.
`
    const response = await generateContentWithRetry(
      ai,
      {
        model: geminiModel,
        contents: [{ text: prompt }],
        config: {
          systemInstruction:
            "Tu es un assistant de commerce international expert en sourcing (Taobao, 1688, Xianyu, TikTok Shop, Amazon, Douyin) et en copywriting e-commerce de précommande.",
          temperature: 0.7,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: 'Titre commercial accrocheur en français.' },
              description: { type: Type.STRING, description: 'Traduction claire et fidèle en français.' },
              salesPitch: { type: Type.STRING, description: 'Argumentaire de vente premium en français.' },
              features: { type: Type.ARRAY, items: { type: Type.STRING }, description: '3 à 5 caractéristiques clés.' },
              priceEur: { type: Type.NUMBER },
              priceXof: { type: Type.NUMBER },
            },
            required: ['title', 'description', 'salesPitch', 'features', 'priceEur', 'priceXof'],
          },
        },
      },
      geminiFallbackModel,
    )
    try {
      enriched = JSON.parse(response.text || '{}')
    } catch {
      /* keep raw draft on AI parse failure */
    }
  }

  const safeId = `xy_${sourceId}`.replace(/[^a-zA-Z0-9_-]/g, '')
  const baseId = /^[a-zA-Z0-9_-]+$/.test(safeId) ? safeId : `xy_${crypto.randomBytes(4).toString('hex')}`
  const products = await loadProducts()
  let finalId = baseId
  if (products.some((p) => p.id === finalId)) {
    finalId = `${baseId}_${crypto.randomBytes(3).toString('hex')}`
  }

  // Margin: if the admin kept the machine-computed price (priceToXof applies
  // the source-currency conversion), the final display price keeps that value.
  const computedXof = await priceToXof({ price, currency })
  const aiXof = Number(enriched?.priceXof) || 0

  const product = sanitizeProduct({
    id: finalId,
    title: String(enriched?.title || title).slice(0, 300),
    description: String(enriched?.description || description).slice(0, 4000),
    originalDescription: String(description).slice(0, 4000),
    chineseDescription: chineseDescription.slice(0, 4000),
    chineseTitle: chineseTitle.slice(0, 400),
    imageUrl,
    gallery,
    videoUrl: undefined,
    category,
    mention: mention || undefined,
    features: Array.isArray(enriched?.features) && enriched.features.length ? enriched.features : features,
    priceEur: Math.round(Number(enriched?.priceEur) || (computedXof / 655.957) * 100) / 100,
    priceXof: Math.round(aiXof || computedXof),
    sourceRmb: price || undefined,
    moq: Number.isFinite(moq) && moq > 0 ? moq : undefined,
    sourcePriceTiers: priceTiers?.length ? priceTiers : undefined,
    sourceStock: Number.isFinite(stock) && stock > 0 ? stock : undefined,
    supplierContact,
    sourceUrl: sourceUrl || undefined,
    seller,
    // ST-020 v2 : infos riches capturées par l'extension (persistées telles quelles).
    attributes: attributes?.length ? attributes : undefined,
    colors: colors?.length ? colors : undefined,
    sizes: sizes?.length ? sizes : undefined,
    packaging: packaging && Object.values(packaging).some(Boolean) ? packaging : undefined,
    shipFrom: shipFrom || undefined,
    createdAt: new Date().toISOString(),
  })

  products.unshift(product)
  await saveProducts(products)

  // ST-019 — capture auto du fournisseur (dédup par nom + fusion contacts).
  // Strictement best-effort : ne doit JAMAIS bloquer la publication du produit
  // (une erreur du blob fournisseurs ne remonte pas à l'admin).
  if (product.seller || product.supplierContact) {
    try {
      await upsertSupplierFromProduct(product)
    } catch (err) {
      console.error('[SUPPLIERS] upsert from publish failed (publication ok) :', err)
    }
  }

  publishSiteUpdate('catalog')
  return { success: true, id: product.id }
})