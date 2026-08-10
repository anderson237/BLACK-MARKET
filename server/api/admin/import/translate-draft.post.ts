// ---------------------------------------------------------------------------
// ST-020 v3 : traduction FR À LA DEMANDE d'un draft extension (backfill).
//
// Les drafts capturés SANS clé IA (ex. anciens drafts, serveur local sans
// GEMINI_API_KEY au moment de la capture) gardent titre/description/attributs
// chinois. Ce endpoint les traduit en un seul appel Gemini et PERSISTE le
// résultat sur le draft stocké (ordre de la liste préservé), pour que l'aperçu
// admin affiche déjà la traduction avant l'envoi vers le catalogue — sans
// aucune perte de données ni de caractéristiques.
//
//   Body : { draftId?, title?, description?, attributes?: {name,value}[] }
//   Retour : { translated: boolean, reason?, title?, description?, attributes? }
// ---------------------------------------------------------------------------

import { Type } from '@google/genai'
import { requireAuth } from '~~/server/utils/auth'
import { getAI, geminiModel, geminiFallbackModel, generateContentWithRetry } from '~~/server/utils/ai'
import { loadExtensionDrafts, saveExtensionDrafts } from '~~/server/utils/storage'

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  if (session.role !== 'admin') throw createError({ statusCode: 403, statusMessage: 'Accès administrateur requis.' })
  const body = await readBody(event)

  const draftId = String(body?.draftId || '').trim()
  const rawTitle = String(body?.title || '').trim()
  const rawDescription = String(body?.description || '').trim()
  const rawAttributes = Array.isArray(body?.attributes)
    ? body.attributes
        .slice(0, 30)
        .map((a: any) => ({
          name: String(a?.name || '').trim().slice(0, 60),
          value: String(a?.value || '').trim().slice(0, 600),
        }))
        .filter((a: any) => a.name && a.value)
    : undefined

  if (!rawTitle && !rawDescription && !rawAttributes?.length) {
    throw createError({ statusCode: 400, statusMessage: 'Rien à traduire.' })
  }

  const ai = getAI()
  if (!ai) {
    throw createError({ statusCode: 503, statusMessage: "Le service d'IA n'est pas configuré (GEMINI_API_KEY manquante)." })
  }

  const properties: any = {}
  const required: string[] = []
  if (rawTitle) {
    properties.title = { type: Type.STRING, description: 'Titre du produit traduit en français.' }
    required.push('title')
  }
  if (rawDescription) {
    properties.description = { type: Type.STRING, description: 'Traduction complète et fidèle de la description en français.' }
    required.push('description')
  }
  if (rawAttributes?.length) {
    properties.attributes = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: 'Nom de la propriété en français.' },
          value: { type: Type.STRING, description: 'Valeur technique en français.' },
        },
        required: ['name', 'value'],
      },
      description: 'Attributs techniques traduits en français, sans aucune perte ni propriété modifiée.',
    }
    required.push('attributes')
  }

  const prompt = `
Produit de e-commerce chinois (source) :
${rawTitle ? `Titre : "${rawTitle}"` : ''}
${rawDescription ? `Description : "${rawDescription}"` : ''}
${rawAttributes?.length ? `Attributs (nom : valeur) :
${rawAttributes.map((a) => `${a.name} : ${a.value}`).join('\n')}` : ''}
Traduis en français, de manière fidèle et technique :
1. Le titre (titre commercial accrocheur pour un marché francophone/africain).
2. La description : traduction complète, claire, SANS perte d'information (conserve marques, modèles, tailles, matières, quantités, prix, unités).
3. Les attributs : chaque {name, value} traduit en français — ne perds AUCUNE propriété, conserve les valeurs techniques, chiffres, matières, tailles et unités.
Réponds strictement en JSON au schéma demandé.
`

  let out: any = {}
  try {
    const response = await generateContentWithRetry(
      ai,
      {
        model: geminiModel,
        contents: [{ text: prompt }],
        config: {
          systemInstruction:
            'Tu es un expert en sourcing (1688, Taobao, Goofish) et en traduction e-commerce chinois → français, traduction technique exacte et complète.',
          temperature: 0.3,
          responseMimeType: 'application/json',
          responseSchema: { type: Type.OBJECT, properties, required },
        },
      },
      geminiFallbackModel,
    )
    out = JSON.parse(response.text || '{}')
  } catch (err) {
    console.error('[translate-draft] échec traduction :', String((err as any)?.message || err).slice(0, 200))
  }

  const title = rawTitle ? String(out?.title || '').trim().slice(0, 300) || undefined : undefined
  const description = rawDescription ? String(out?.description || '').trim().slice(0, 4000) || undefined : undefined
  const attributes = rawAttributes?.length
    ? (Array.isArray(out?.attributes) ? out.attributes : [])
        .map((a: any) => ({
          name: String(a?.name || '').trim().slice(0, 60),
          value: String(a?.value || '').trim().slice(0, 600),
        }))
        .filter((a: any) => a.name && a.value)
        .slice(0, 30)
    : undefined

  const hasResult = Boolean(title) || Boolean(description) || Boolean(attributes?.length)
  if (!hasResult) {
    return { translated: false, reason: 'Traduction indisponible (échec IA).' }
  }

  // Backfill : persiste la traduction sur le draft stocké (ordre préservé).
  if (draftId) {
    try {
      const drafts = await loadExtensionDrafts()
      const idx = drafts.findIndex((e) => e.id === draftId)
      if (idx >= 0) {
        if (title) drafts[idx].draft.title = title
        if (description) drafts[idx].draft.description = description
        if (attributes?.length) drafts[idx].draft.attributesTranslated = attributes
        if (title || description) drafts[idx].draft.translationStatus = 'translated'
        await saveExtensionDrafts(drafts)
      }
    } catch (err) {
      console.error('[translate-draft] persistance backfill échouée :', String((err as any)?.message || err).slice(0, 160))
    }
  }

  return { translated: true, title, description, attributes }
})
