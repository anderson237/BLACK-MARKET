import type { JoDetail, JoPlatform } from './justone'
import { joDetail } from './justone'
import { scrapeGoofishDetail } from './scraperGoofish'
import { resolveDesiredEngine, HEADLESS_SUPPORTED_PLATFORMS } from './sources'

// ---------------------------------------------------------------------------
// Sélection de moteur de détail produit (BL-007 v2 / ST-017).
//
// Consulte le toggle admin (blob bm-sources, server/utils/sources.ts) et
// retourne le JoDetail + le moteur EFFECTIVEMENT utilisé :
//   - xianyu + toggle 'headless' : scraper goofish gratuit (MTOP intercepté)
//     en premier, FALLBACK AUTOMATIQUE JustOneAPI si le headless échoue
//     (timeout / anti-bot RGV587 / navigateur indisponible) — jamais d'échec
//     silencieux : chaque bascule est journalisée.
//   - xianyu + toggle 'justone' : JustOneAPI directement.
//   - autres plateformes : JustOneAPI (le headless n'est implémenté que pour
//     goofish — resolveDesiredEngine le ramène à 'justone').
//
// Le CONTRAT DE SORTIE est une JoDetail identique au flattener JustOneAPI :
// draftBuilder.ts et l'UI restent inchangés.
// ---------------------------------------------------------------------------

export interface EngineResult {
  detail: JoDetail
  /** Moteur ayant produit `detail` — remplit `source.engine` de la réponse. */
  engine: 'headless' | 'justone'
}

/**
 * Récupère le détail d'un produit avec le moteur sélectionné par le toggle.
 * @throws comme joDetail() (les erreurs JustOneAPI remontent verbatim pour
 *         que l'admin voie "solde insuffisant / quota", etc.)
 */
export async function fetchProductDetail(
  platform: JoPlatform,
  sourceId: string,
  region: string = 'US',
): Promise<EngineResult> {
  const desired = await resolveDesiredEngine(platform)
  const headlessPossible = desired === 'headless' && HEADLESS_SUPPORTED_PLATFORMS.includes(platform)

  if (headlessPossible) {
    try {
      const detail = await scrapeGoofishDetail(sourceId)
      console.log(`[engine] ${platform} ${sourceId} : détail via HEADLESS (goofish gratuit)`)
      return { detail, engine: 'headless' }
    } catch (err: any) {
      // Fallback automatique JustOneAPI — le headless n'est jamais un échec
      // silencieux : l'avertissement est toujours journalisé.
      console.warn(
        `[engine] headless goofish indisponible pour ${platform} ${sourceId}, fallback JustOneAPI : ${String(err?.message || err).slice(0, 180)}`,
      )
    }
  }

  const detail = await joDetail(platform, sourceId, region)
  return { detail, engine: 'justone' }
}
