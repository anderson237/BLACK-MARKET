import { Type } from '@google/genai'
import { getAI, geminiModel, geminiFallbackModel, generateContentWithRetry } from '~~/server/utils/ai'
import { requireAuth, rateLimit } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  rateLimit(10, 60_000)(event)
  const ai = getAI()
  if (!ai) {
    throw createError({
      statusCode: 503,
      statusMessage: "Le service d'IA n'est pas configuré. Veuillez ajouter votre clé API GEMINI_API_KEY dans le fichier .env / Secrets.",
    })
  }
  const body = await readBody(event)
  const { field, title, category, currentText } = body || {}
  const target = field === 'technical' ? 'technical' : 'description'
  const cleanTitle = String(title || '').slice(0, 300)
  const cleanCategory = String(category || '').slice(0, 80)
  const cleanCurrent = String(currentText || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 4000)

  const instructions =
    target === 'description'
      ? `Tu es un copywriter d'élite pour la marque de précommande BLACK MARKET (import Chine, marché francophone).
Rédige ou optimise l'ARGUMENTAIRE DE VENTE du produit « ${cleanTitle} » (catégorie : ${cleanCategory || 'non précisée'}).
${cleanCurrent ? `Reprends les informations utiles de l'argumentaire actuel et optimise-le pour le rendre plus percutant, plus structuré et plus orienté bénéfices clients : "${cleanCurrent}".` : 'Crée un argumentaire de vente premium de toutes pièces.'}
Exigences :
- Utilise généreusement des émojis (🔥, ⚡, 👑, 💎, 🚚, 💯, ⭐...) pour dynamiser et scander le texte, avec des sections visuellement riches.
- 2 à 4 paragraphes courts et percutants, ton enthousiaste mais crédible.
- Une liste à puces de 3 à 5 bénéfices clients concrets (avec émojis d'accompagnement).
- Mise en avant de l'exclusivité, de la qualité d'import direct et du filigrane de marque.
- Un <h3> accrocheur en début de texte, des phrases courtes, un vocabulaire qui vend.
- Ne jamais inventer de caractéristiques techniques fausses. Reste général si l'info manque.
Renvoie du HTML propre : <h3>, <p>, <ul><li>. Sans balise <html>, <body> ni texte hors HTML.`
      : `Tu es un expert en fiches techniques e-commerce (import Chine, marché francophone).
Présente la FICHE TECHNIQUE du produit « ${cleanTitle} » (catégorie : ${cleanCategory || 'non précisée'}).
${cleanCurrent ? `Reprends les informations actuelles, réorganise-les, corrige-les et complète intelligemment : "${cleanCurrent}".` : 'Crée une fiche technique structurée à partir du nom du produit.'}
Exigences :
- Structure claire et riche : <h3> pour chaque bloc (par ex. "Caractéristiques", "Matériaux & Qualité", "Expédition & Livraison") avec émojis dans les titres (📦, 🔧, ⚙️, 📏, 🕐...).
- Liste à puces <ul><li> pour les caractéristiques, concrètes et numérotées quand c'est possible.
- Détaille : matière, dimensions/poids quand c'est logique, compatibilité, contenus du colis, délais d'expédition, retour/garantie.
- Qualité et quantité d'informations adaptées : détaillé mais jamais inventé. Indique clairement les points non confirmés.
Renvoie du HTML propre : <h3>, <p>, <ul><li>. Sans balise <html>, <body> ni texte hors HTML.`

  const response = await generateContentWithRetry(
    ai,
    {
      model: geminiModel,
      contents: [{ text: instructions }],
      config: {
        systemInstruction:
          'Tu génères exclusivement du contenu HTML propre (balises <p>, <h3>, <ul>, <li>) pour une interface d\'édition produit. Aucune balise <html>, <body> ni texte hors HTML.',
        temperature: 0.7,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            html: { type: Type.STRING, description: 'Contenu HTML final à insérer directement dans l\'éditeur.' },
          },
          required: ['html'],
        },
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
  return { success: true, html: String(resultJson.html || '').slice(0, 12000) }
})