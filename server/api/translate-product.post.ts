import { Type } from '@google/genai'
import { getAI, geminiModel, geminiFallbackModel, generateContentWithRetry } from '~~/server/utils/ai'
import { rateLimit } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  rateLimit(10, 60_000)(event)
  const ai = getAI()
  if (!ai) {
    throw createError({
      statusCode: 503,
      statusMessage: "Le service d'IA n'est pas configuré. Veuillez ajouter votre clé API GEMINI_API_KEY dans le fichier .env / Secrets.",
    })
  }
  const body = await readBody(event)
  const { chineseDescription, imageBase64, imageMimeType, customMarkup, basePriceRmb } = body
  if (!chineseDescription && !imageBase64) {
    throw createError({ statusCode: 400, statusMessage: 'Veuillez fournir une description en chinois ou une image de produit.' })
  }

  const contents: any[] = []
  if (imageBase64) contents.push({ inlineData: { mimeType: imageMimeType || 'image/jpeg', data: String(imageBase64) } })
  const markup = Number(customMarkup) > 0 ? Number(customMarkup) : 60
  const rmb = Number(basePriceRmb) > 0 ? Number(basePriceRmb) : null

  let textPrompt = 'Analyse ce produit chinois.'
  if (chineseDescription) textPrompt += ` Voici la description textuelle fournie : "${String(chineseDescription)}".`
  textPrompt += `
Tu es un copywriter d'élite et expert en sourcing de produits en Chine.
Fais le travail suivant :
1. Extrais et traduis tout texte écrit sur l'image (le cas échéant) et traduis la description de chinois à français de manière claire et précise.
2. Crée un Titre produit accrocheur en français, adapté au marché francophone.
3. Rédige un Argumentaire de vente premium en français (Copywriting captivant, orienté bénéfices clients, ton enthousiaste mais crédible).
4. Extrais 3 à 5 caractéristiques techniques ou points forts clés (Features).
5. Suggère un prix de vente en EUR et XOF. ${rmb ? `Prix d'achat de base en RMB fourni : ${rmb} yuan. Convertis-le (taux 1 RMB ≈ 85 XOF ≈ 0.13 EUR) et applique un multiplicateur d'importation réaliste (marge de ${markup}% + frais d'envoi 5-10€ / 3000-6000 XOF).` : 'Aucun prix d\'achat fourni : estime un prix de détail réaliste pour ce produit importé sur le marché francophone/africain.'}
Tu dois impérativement renvoyer la réponse au format JSON conforme au schéma demandé.
`
  contents.push({ text: textPrompt })

  const response = await generateContentWithRetry(
    ai,
    {
      model: geminiModel,
      contents,
      config: {
        systemInstruction:
          "Tu es un assistant de commerce international No-Code spécialisé dans le sourcing de produits en Chine (Taobao, 1688, WeChat) et le copywriting e-commerce de précommande.",
        temperature: 0.7,
        responseMimeType: 'application/json',
        responseSchema: translateSchema(),
      },
    },
    geminiFallbackModel,
  )

  const resultText = response.text || '{}'
  let resultJson: any
  try {
    resultJson = JSON.parse(resultText)
  } catch {
    throw createError({ statusCode: 502, statusMessage: "Réponse de l'IA au format invalide. Veuillez réessayer." })
  }
  const data = {
    ...resultJson,
    translatedTitle: String(resultJson.translatedTitle || '').slice(0, 200),
    translatedDescription: String(resultJson.translatedDescription || ''),
    salesPitch: String(resultJson.salesPitch || ''),
    features: Array.isArray(resultJson.features) ? resultJson.features.slice(0, 8).map((f: unknown) => String(f)) : [],
    priceEur: Number(resultJson.priceEur) || 0,
    priceXof: Number(resultJson.priceXof) || 0,
    priceExplanation: String(resultJson.priceExplanation || ''),
  }
  return { success: true, data }
})

function translateSchema() {
  return {
    type: Type.OBJECT,
    properties: {
      translatedTitle: { type: Type.STRING, description: 'Titre commercial accrocheur et élégant en Français.' },
      translatedDescription: { type: Type.STRING, description: 'Traduction claire et fidèle des détails/spécificités d\'origine en Français.' },
      salesPitch: { type: Type.STRING, description: 'Argumentaire de vente captivant et structuré en Français (Copywriting e-commerce).' },
      features: { type: Type.ARRAY, items: { type: Type.STRING }, description: '3 à 5 caractéristiques clés ou bénéfices majeurs du produit.' },
      priceEur: { type: Type.NUMBER, description: 'Prix de vente public suggéré en Euros (EUR).' },
      priceXof: { type: Type.NUMBER, description: 'Prix de vente public suggéré en Francs CFA (XOF).' },
      priceExplanation: { type: Type.STRING, description: "Explication courte du calcul de prix (conversion, marge, frais d'envoi)." },
    },
    required: ['translatedTitle', 'translatedDescription', 'salesPitch', 'features', 'priceEur', 'priceXof'],
  }
}