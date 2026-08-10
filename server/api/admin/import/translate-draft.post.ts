// ---------------------------------------------------------------------------
// ST-020 v3 : traduction FR À LA DEMANDE d'un draft extension (backfill).
//
// Les drafts capturés SANS clé IA (ex. anciens drafts, serveur local sans
// GEMINI_API_KEY au moment de la capture) gardent titre/description/attributs
// chinois. Ce endpoint les traduit (en deux appels Gemini SÉPARÉS pour la
// robustesse) et PERSISTE le résultat sur le draft stocké (ordre préservé),
// pour que l'aperçu admin affiche déjà la traduction avant l'envoi vers le
// catalogue — sans aucune perte de données ni de caractéristiques.
//
//   Body : { draftId?, title?, description?, attributes?: {name,value}[] }
//   Retour : { translated, reason?, title?, description?, attributes? }
// ---------------------------------------------------------------------------

import { Type } from '@google/genai'
import { requireAuth } from '~~/server/utils/auth'
import { getAI, geminiModel, geminiFallbackModel, generateContentWithRetry } from '~~/server/utils/ai'
import { translateAttributes, googleGtxTranslate, translateTextsGoogle } from '~~/server/utils/draftBuilder'
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
  // ST-020 v2 : couleurs + unité d'emballage (chinois bruts) → traduites aussi
  // pour que la fiche produit n'affiche pas de chinois brut.
  const rawColors = Array.isArray(body?.colors)
    ? body.colors.map((c: any) => String(c).trim().slice(0, 60)).filter(Boolean).slice(0, 60)
    : undefined
  const rawPkgUnit = typeof body?.packaging === 'object' && body.packaging ? String(body.packaging.unit || '').trim().slice(0, 30) : undefined

  if (!rawTitle && !rawDescription && !rawAttributes?.length && !rawColors?.length && !rawPkgUnit) {
    throw createError({ statusCode: 400, statusMessage: 'Rien à traduire.' })
  }

  const ai = getAI()

  // --- 1/2 Attributs : réutilise translateAttributes (Gemini puis repli gtx) ---
  let attributes: { name: string; value: string }[] | undefined
  if (rawAttributes?.length) {
    attributes = (await translateAttributes(rawAttributes)) || undefined
  }

  // --- 2/2 Titre + description : appel léger séparé (schéma 2 champs) ---
  let title: string | undefined
  let description: string | undefined
  if (rawTitle || rawDescription) {
    if (ai) {
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
      const prompt = `
Produit de e-commerce chinois (source) :
${rawTitle ? `Titre : "${rawTitle}"` : ''}
${rawDescription ? `Description : "${rawDescription}"` : ''}
Traduis en français, de manière fidèle et technique :
1. Le titre (titre commercial accrocheur pour un marché francophone/africain).
2. La description : traduction complète, claire, SANS perte d'information (conserve marques, modèles, tailles, matières, quantités, prix, unités).
Réponds strictement en JSON au schéma demandé.
`
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
        const out = JSON.parse(response.text || '{}')
        title = rawTitle ? String(out?.title || '').trim().slice(0, 300) || undefined : undefined
        description = rawDescription ? String(out?.description || '').trim().slice(0, 4000) || undefined : undefined
      } catch (err) {
        console.error('[translate-draft] échec titre/description Gemini :', String((err as any)?.message || err).slice(0, 200))
      }
    }
    // Repli gratuit sans clé : Google gtx (quota Gemini dépassé / clé absente).
    if (!title && rawTitle) {
      const t = await googleGtxTranslate(rawTitle)
      if (t) title = t.slice(0, 300)
    }
    if (!description && rawDescription) {
      const d = await googleGtxTranslate(rawDescription)
      if (d) description = d.slice(0, 4000)
    }
  }

  // --- 3/3 Couleurs + unité d'emballage : gtx (gratuit, batch en 1 requête) ---
  let colorsTranslated: string[] | undefined
  if (rawColors?.length) {
    colorsTranslated = (await translateTextsGoogle(rawColors)) || undefined
  }
  let pkgUnitTranslated: string | undefined
  if (rawPkgUnit) {
    const t = await translateTextsGoogle([rawPkgUnit])
    if (t?.[0]) pkgUnitTranslated = t[0].slice(0, 30)
  }

  const hasResult = Boolean(title) || Boolean(description) || Boolean(attributes?.length) || Boolean(colorsTranslated?.length) || Boolean(pkgUnitTranslated)
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
        if (colorsTranslated?.length) drafts[idx].draft.colorsTranslated = colorsTranslated
        if (pkgUnitTranslated) {
          drafts[idx].draft.packaging = { ...(drafts[idx].draft.packaging || {}), unitTranslated: pkgUnitTranslated }
        }
        if (title || description) drafts[idx].draft.translationStatus = 'translated'
        await saveExtensionDrafts(drafts)
      }
    } catch (err) {
      console.error('[translate-draft] persistance backfill échouée :', String((err as any)?.message || err).slice(0, 160))
    }
  }

  return { translated: true, title, description, attributes, colorsTranslated, pkgUnitTranslated }
})
