import crypto from 'node:crypto'
import { Type } from '@google/genai'
import { requireAuth } from '~~/server/utils/auth'
import { loadProducts, saveProducts } from '~~/server/utils/storage'
import { sanitizeProduct } from '~~/server/utils/product'
import { publishSiteUpdate } from '~~/server/utils/realtime'
import { getAI, geminiModel, geminiFallbackModel, generateContentWithRetry } from '~~/server/utils/ai'
import { cnyToXof } from '~~/server/utils/justone'

// Admin import pipeline (ST-017) — publish step.
// Body: {
//   platform, sourceId, title, description, chineseDescription, priceCny?,
//   imageUrl, gallery[], features[] (strings), category?
// }
// Optional AI enrichment (translate + sales pitch + price) runs when
// `aiEnrich: true` and GEMINI_API_KEY is configured. Otherwise the payload
// is published as-is (admin already typed the FR copy).
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  if (session.role !== 'admin') throw createError({ statusCode: 403, statusMessage: 'Accès administrateur requis.' })
  const body = await readBody(event)

  const sourceId = String(body?.sourceId || '').trim()
  const platform = body?.platform === '1688' ? '1688' : 'xianyu'
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
  const priceCny = Number(body?.priceCny) || 0
  const aiEnrich = body?.aiEnrich === true

  if (!sourceId || !title) throw createError({ statusCode: 400, statusMessage: 'Identifiant source et titre requis.' })
  if (!imageUrl && gallery.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Au moins une image est requise.' })
  }

  // Optional AI enrichment: translate to FR, craft a sales pitch and a
  // suggested price. Runs only when explicitly requested + key configured.
  let enriched: any = null
  if (aiEnrich) {
    const ai = getAI()
    if (!ai) throw createError({ statusCode: 503, statusMessage: "Le service d'IA n'est pas configuré (GEMINI_API_KEY manquante)." })
    const prompt = `
Produit importé de ${platform === 'xianyu' ? 'Xianyu (Goofish)' : '1688'} — titre chinois : "${chineseTitle || title}".
Description chinoise : "${chineseDescription || description}".
Prix d'achat en RMB : ${priceCny || 'inconnu'} yuan.
Fais le travail suivant :
1. Traduis le titre en français (titre commercial accrocheur, marché francophone/africain).
2. Traduis/adapte la description en français de manière claire et fidèle.
3. Rédige un argumentaire de vente premium en français (bénéfices clients, crédible).
4. Extrais 3 à 5 caractéristiques techniques clés.
5. Suggère un prix de vente EUR et XOF. Convertis le prix d'achat (1 RMB ≈ 95 XOF ≈ 0.14 EUR) et applique une marge d'importation réaliste (frais d'envoi 5-10 € / 3000-6000 XOF inclus).
Réponds strictement en JSON au schéma demandé.
`
    const response = await generateContentWithRetry(
      ai,
      {
        model: geminiModel,
        contents: [{ text: prompt }],
        config: {
          systemInstruction:
            "Tu es un assistant de commerce international expert en sourcing Chine (Taobao, 1688, Xianyu) et en copywriting e-commerce de précommande.",
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

  // Margin: if the admin kept the machine-computed price (cnyToXof applies the
  // fixed 1 CNY = 95 XOF rate), the final display price keeps that value.
  const computedXof = cnyToXof(priceCny)
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
    features: Array.isArray(enriched?.features) && enriched.features.length ? enriched.features : features,
    priceEur: Math.round(Number(enriched?.priceEur) || (computedXof / 655.957) * 100) / 100,
    priceXof: Math.round(aiXof || computedXof),
    sourceRmb: priceCny || undefined,
    createdAt: new Date().toISOString(),
  })

  products.unshift(product)
  await saveProducts(products)
  publishSiteUpdate('catalog')
  return { success: true, id: product.id }
})