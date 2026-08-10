import { joDetail, importRemoteImage, priceToXof, type JoPlatform, type JoDetail } from '~~/server/utils/justone'
import { findLocalPrice, estimateTransport, getSupplierContact } from '~~/server/utils/storage'
import { detectCategory } from '~~/server/utils/category'
import type { ProductMention } from '~~/types'
import { Type } from '@google/genai'
import { getAI, geminiModel, geminiFallbackModel, generateContentWithRetry } from '~~/server/utils/ai'

// ---------------------------------------------------------------------------
// Shared draft builder (ST-017): fetch a product detail from any supported
// platform, download its gallery locally, convert prices to XOF and assemble
// the ready-to-edit draft payload. Used by BOTH the search-result click
// (/api/admin/import/draft) and the paste-a-link flow (/api/admin/import/from-url).
//
// ST-017 v3 : traduction FR AUTOMATIQUE à l'import. Quand le titre/la
// description source contiennent des caractères CJK (chinois), on appelle
// Gemini (generateContentWithRetry) pour traduire titre + description en
// français. Comportement DÉGRADÉ OBLIGATOIRE : tout échec (pas de clé,
// timeout, erreur) conserve la description source + un warning — l'import ne
// bloque jamais à cause de la traduction.
// ---------------------------------------------------------------------------

// Blocs CJK principaux (idéogrammes + ponctuation chinoise/japonaise).
const CJK_RE = /[\u3000-\u9FFF\u3400-\u4DBF\u3040-\u30FF\uF900-\uFAFF]/

/** Détecte la présence de caractères CJK (chinois / japonais) dans un texte. */
export function hasCjk(text: unknown): boolean {
  return CJK_RE.test(String(text ?? ''))
}

/**
 * Suggestion AUTO de mention produit vitrine (ST-018) à l'import.
 * Mappe les signaux SOURCE (bruts, non normalisés) vers une valeur normalisée FR :
 *   - plateforme 1688 (gros / B2B wholesale) → `gros`
 *   - texte (condition goofish itemStatusStr + titre + description) contenant
 *     二手 / 旧 → `occasion` ; 全新 → `neuf` ; variantes EN `used` / `new` ;
 *     signaux gros `批发` / `wholesale` → `gros`
 *   - sinon → `undefined` (pas de suggestion, l'admin choisit librement).
 * ⚠️ Ne modifie JAMAIS le champ `condition` (texte brut source) : la mention est
 * un champ DISTINCT, normalisé FR. La suggestion reste éditable côté UI avant
 * publication.
 */
export function suggestMention(opts: {
  platform?: string
  condition?: string
  sourceTitle?: string
  sourceDesc?: string
}): ProductMention | undefined {
  const platform = String(opts.platform || '')
  // La nature B2B/wholesale de 1688 prime sur le texte (offre en gros).
  if (platform === '1688') return 'gros'
  const text = `${opts.condition || ''} ${opts.sourceTitle || ''} ${opts.sourceDesc || ''}`
  if (/二手|旧/.test(text)) return 'occasion'
  if (/全新/.test(text)) return 'neuf'
  if (/\bused\b/i.test(text)) return 'occasion'
  if (/\bnew\b/i.test(text)) return 'neuf'
  if (/批发|wholesale/i.test(text)) return 'gros'
  return undefined
}

interface TranslateResult {
  title: string
  description: string
}

/**
 * Traduit titre + description d'un draft en français via Gemini.
 * Retourne `null` en cas d'échec (aucune exception ne remonte) :
 *   - pas de GEMINI_API_KEY → warning + null
 *   - erreur / timeout / réponse invalide → warning + null
 * `titleFr` déjà fourni par l'utilisateur → le titre n'est PAS re-traduit
 * (il est passé au modèle comme "titre final" à conserver), seule la
 * description est traduite.
 */
async function translateDraftToFrench(opts: {
  platform: string
  sourceId: string
  sourceTitle: string
  sourceDesc: string
  titleFr?: string
}): Promise<TranslateResult | null> {
  const ai = getAI()
  if (!ai) {
    console.warn(
      `[draftBuilder] Traduction FR ignorée (GEMINI_API_KEY absente) pour ${opts.platform} ${opts.sourceId} — description source conservée.`,
    )
    return null
  }
  const keepTitle = Boolean(String(opts.titleFr || '').trim())
  const titleInstruction = keepTitle
    ? `Le titre commercial final a déjà été choisi par l'utilisateur : "${opts.titleFr}". Renvoie-le tel quel dans "title" (ne le modifie pas).`
    : 'Traduis le titre en français : titre commercial accrocheur et clair, adapté au marché francophone/africain, en conservant les marques et modèles.'
  const prompt = `
Produit e-commerce importé de ${opts.platform} (identifiant source : ${opts.sourceId}).
Titre source (chinois) : "${opts.sourceTitle}"
Description source (chinoise) : "${opts.sourceDesc}"
Travail :
1. ${titleInstruction}
2. Traduis la description en français : traduction fidèle, claire et naturelle, ton neutre commercial, en conservant les marques, modèles, tailles, matériaux, quantités, prix et unités. N'invente aucune information.
Réponds strictement en JSON : { "title": "...", "description": "..." }
`
  try {
    const response = await generateContentWithRetry(
      ai,
      {
        model: geminiModel,
        contents: [{ text: prompt }],
        config: {
          systemInstruction:
            "Tu es un traducteur professionnel chinois→français spécialisé en e-commerce (Taobao, 1688, Xianyu/Goofish, TikTok Shop). Tu traduis fidèlement et naturellement, avec un ton commercial neutre.",
          temperature: 0.4,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: 'Titre du produit en français.' },
              description: { type: Type.STRING, description: 'Description du produit traduite en français.' },
            },
            required: ['title', 'description'],
          },
        },
      },
      geminiFallbackModel,
    )
    const parsed = JSON.parse(response.text || '{}')
    const title = String(parsed.title || '').trim()
    const description = String(parsed.description || '').trim()
    if (!title && !description) return null
    return {
      title: title || String(opts.sourceTitle || ''),
      description: description || String(opts.sourceDesc || ''),
    }
  } catch (err: any) {
    console.warn(
      `[draftBuilder] Traduction FR échouée pour ${opts.platform} ${opts.sourceId} : ${String(err?.message || err).slice(0, 160)} — description source conservée.`,
    )
    return null
  }
}

export interface DraftSource {
  platform: JoPlatform
  sourceId: string
  titleFr?: string
  keyword?: string
  category?: string
  region?: 'US' | 'FR'
  moq?: number
  priceTiers?: any[]
  stock?: number
  /**
   * Détail déjà extrait (BL-007 headless goofish). Quand présent, buildDraft
   * l'utilise TEL QUEL au lieu d'appeler joDetail() → le chemin JustOneAPI
   * (défaut) reste byte-identical. `detail` doit être une JoDetail au format
   * identique au flattener (scraperGoofish.ts le garantit).
   */
  detail?: JoDetail
  /** Moteur ayant produit `detail` — journalisation / réponse API. */
  detailSource?: 'justone' | 'headless' | 'extension'
}

function sourceUrlFor(platform: JoPlatform, sourceId: string): string {
  switch (platform) {
    case 'xianyu':
      return `https://www.goofish.com/item?id=${sourceId}`
    case '1688':
      return `https://detail.1688.com/offer/${sourceId}.html`
    case 'taobao':
      return `https://item.taobao.com/item.htm?id=${sourceId}`
    case 'tiktok-shop':
      return `https://shop.tiktok.com/view/product/${sourceId}`
    case 'amazon':
      return `https://www.amazon.fr/dp/${sourceId}`
    case 'douyin-ec':
      return `https://haohuo.jinritemai.com/views/product/item2?id=${sourceId}`
    default:
      return ''
  }
}

export async function buildDraft(source: DraftSource): Promise<any> {
  const { platform, sourceId } = source
  const titleFr = String(source.titleFr || '').trim()
  const region = source.region || 'US'

  let detail
  if (source.detail) {
    // BL-007 : détail pré-extrait (headless goofish) — pas d'appel JustOneAPI.
    detail = source.detail
  } else {
    try {
      detail = await joDetail(platform, sourceId, region)
    } catch (err: any) {
      // Balance / quota errors surface verbatim so the admin can recharge.
      throw err
    }
  }

  // ---------------------------------------------------------------------
  // ST-017 v3 : traduction FR AUTOMATIQUE à l'import.
  // Détection CJK sur le titre + la description source. En cas de besoin,
  // Gemini traduit (dégradé : échec → source conservée, warning, non-bloquant).
  // `titleFr` fourni par l'utilisateur → titre non re-traduit.
  // ---------------------------------------------------------------------
  const sourceTitle = String(detail.title || '')
  const sourceDesc = String(detail.desc || '')
  const translateTitle = !titleFr && hasCjk(sourceTitle)
  const translateDesc = hasCjk(sourceDesc)
  let frTitle = ''
  let frDesc = ''
  let translationStatus: 'translated' | 'skipped' | 'failed' = 'skipped'
  if (translateTitle || translateDesc) {
    const res = await translateDraftToFrench({
      platform,
      sourceId,
      sourceTitle,
      sourceDesc,
      // Titre à CONSERVER tel quel quand on ne le traduit pas : soit le
      // titleFr choisi par l'utilisateur, soit le titre source (non-CJK).
      titleFr: translateTitle ? undefined : (titleFr || sourceTitle),
    })
    if (res) {
      frTitle = res.title
      frDesc = res.description
      translationStatus = 'translated'
    } else {
      translationStatus = 'failed'
    }
  }

  // Download up to 5 pictures locally (degraded: remote URL kept on failure).
  const gallery: string[] = []
  for (let i = 0; i < Math.min(5, detail.images.length); i++) {
    gallery.push(await importRemoteImage(detail.images[i], i))
  }
  const mainImage = gallery[0] || ''

  const priceXof = await priceToXof(detail)

  // Third price: local market approximation (only when a table entry matches).
  // Uses the FR title when available (the table matches French labels/keywords).
  const lp = await findLocalPrice(String(frTitle || titleFr || sourceTitle || ''), String(source.keyword || ''))

  // Transport estimate (emballage inclus).
  const transport = await estimateTransport(String(source.category || ''))

  // Automatic category suggestion (vitrine filter). La détection de catégorie
  // fonctionne sur le texte source (chinois) et traduit — pas de régression.
  const suggestedCategory = detectCategory(sourceTitle, sourceDesc)

  // Mention produit normalisée FR (ST-018) : suggestion auto depuis la source
  // (condition goofish 二手/全新, nature 1688, mots-clés wholesale). Champ
  // DISTINCT de `condition` (texte brut source) — modifiable avant publication.
  const suggestedMention = suggestMention({
    platform,
    condition: detail.condition,
    sourceTitle,
    sourceDesc,
  })

  // Previously captured supplier contact — pre-fill the draft.
  const sc = await getSupplierContact(platform, sourceId)

  return {
    platform,
    sourceId,
    url: sourceUrlFor(platform, sourceId),
    sourceTitle,
    title: titleFr || frTitle || sourceTitle,
    chineseTitle: sourceTitle,
    chineseDescription: sourceDesc,
    description: frDesc || sourceDesc,
    translationStatus,
    price: detail.price,
    currency: detail.currency,
    priceXof,
    localPriceXof: lp ? lp.priceXof : undefined,
    localPriceLabel: lp ? lp.label : undefined,
    transport,
    suggestedCategory,
    suggestedMention,
    imageUrl: mainImage,
    gallery,
    condition: detail.condition || undefined,
    features: detail.features || [],
    seller: detail.seller || undefined,
    metrics: {
      wantCnt: detail.wantCnt,
      browseCnt: detail.browseCnt,
      favorCnt: detail.favorCnt,
    },
    sales: detail.sales,
    rating: detail.rating,
    ratingCount: detail.ratingCount,
    moq: Number.isFinite(source.moq as any) && (source.moq as any) > 0 ? source.moq : detail.moq || undefined,
    priceTiers: source.priceTiers?.length ? source.priceTiers : detail.priceTiers || undefined,
    stock: Number.isFinite(source.stock as any) && (source.stock as any) > 0 ? source.stock : detail.stock || undefined,
    supplierContact: sc
      ? { wechat: sc.wechat, email: sc.email, whatsapp: sc.whatsapp, phone: sc.phone, website: sc.website, note: sc.note }
      : undefined,
    date: new Date().toISOString(),
  }
}

/**
 * Traduction gratuite SANS clé via l'endpoint Google Translate `gtx`
 * (utilisé par de nombreux outils open-source). Repli quand Gemini est absent
 * ou quota dépassé (429). Dégradé : null en cas d'erreur.
 */
export async function googleGtxTranslate(text: string): Promise<string | null> {
  if (!text?.trim()) return null
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=zh-CN&tl=fr&dt=t&q=${encodeURIComponent(text)}`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    if (!Array.isArray(data) || !Array.isArray(data[0])) return null
    const out = (data[0] as any[]).map((seg: any) => (Array.isArray(seg) && seg[0] != null ? String(seg[0]) : '')).join('')
    return out || null
  } catch {
    return null
  }
}

/**
 * Traduit un lot d'attributs via Google `gtx` en une seule requête : les paires
 * nom/valeur sont aplaties et séparées par `|||` (séparateur conservé par le
 * traducteur) puis reconstruites par index. Renvoie null si l'alignement échoue
 * (le jeton source d'origine est alors conservé).
 */
export async function translateAttributesGoogle(
  attributes: { name: string; value: string }[],
): Promise<{ name: string; value: string }[] | null> {
  if (!attributes?.length) return null
  const tokens: string[] = []
  for (const a of attributes) {
    tokens.push(a.name, a.value)
  }
  const out = await googleGtxTranslate(tokens.join('|||'))
  if (!out) return null
  const parts = out.split(/\s*\|\|+\s*/).map((s) => s.trim())
  if (parts.length !== tokens.length) return null
  const result: { name: string; value: string }[] = []
  for (let i = 0; i < parts.length; i += 2) {
    result.push({
      name: (parts[i] || '').slice(0, 60),
      value: (parts[i + 1] || '').slice(0, 600),
    })
  }
  return result.length ? result : null
}

/**
 * ST-020 v3 : traduit les attributs techniques capturés par l'extension
 * (chinois bruts) en français. Appelée À L'IMPORT pour que l'aperçu admin et le
 * popup affichent DÉJÀ la traduction avant l'envoi vers le catalogue.
 * Dégradé OBLIGATOIRE : Gemini d'abord, puis Google `gtx` (gratuit, sans clé)
 * si Gemini est absent ou quota dépassé. Sinon null (source conservée).
 */
export async function translateAttributes(
  attributes: { name: string; value: string }[],
): Promise<{ name: string; value: string }[] | null> {
  if (!attributes?.length) return null
  const ai = getAI()
  if (ai) {
    const source = attributes.map((a) => `${a.name} : ${a.value}`).join('\n')
    try {
      const response = await generateContentWithRetry(
        ai,
        {
          model: geminiModel,
          contents: [
            {
              text: `Traduis en français les attributs techniques d'un produit e-commerce chinois (source :\n${source}\n). Traduction technique exacte : conserve les marques, chiffres, matières, tailles et unités ; ne perds aucune propriété. Réponds strictement en JSON : un tableau d'objets {"name": nom de la propriété en FR, "value": valeur en FR}.`,
            },
          ],
          config: {
            systemInstruction:
              'Tu es un assistant expert en sourcing (1688, Taobao) : tu traduis fidèlement les caractéristiques produit du chinois vers le français.',
            temperature: 0.2,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: 'Nom de la propriété en français.' },
                  value: { type: Type.STRING, description: 'Valeur technique en français.' },
                },
                required: ['name', 'value'],
              },
            },
          },
        },
        geminiFallbackModel,
      )
      const parsed = JSON.parse(response.text || '[]')
      if (Array.isArray(parsed)) {
        const out = parsed
          .map((a: any) => ({
            name: String(a?.name || '').trim().slice(0, 60),
            value: String(a?.value || '').trim().slice(0, 600),
          }))
          .filter((a: any) => a.name && a.value)
          .slice(0, 30)
        if (out.length) return out
      }
    } catch (err) {
      console.warn(`[draftBuilder] Traduction Gemini échouée → repli gtx : ${String((err as any)?.message || err).slice(0, 160)}`)
    }
  }
  // Repli gratuit (quota Gemini dépassé / clé absente).
  const google = await translateAttributesGoogle(attributes)
  if (google) return google
  return null
}
