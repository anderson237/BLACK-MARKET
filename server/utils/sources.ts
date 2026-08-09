import { getStore } from '@netlify/blobs'
import fs from 'node:fs'
import path from 'node:path'
import { isNetlifyRuntime, withBlobLock, withLock } from './storage'
import type { JoPlatform } from './justone'

// ---------------------------------------------------------------------------
// Toggle de source d'import par plateforme (BL-007 v2 / ST-017).
//
// L'utilisateur choisit le moteur de détail produit par plateforme :
//   - 'headless' : scraper gratuit goofish (scraperGoofish.ts, interception
//     MTOP) — PRIORITAIRE pour Xianyu/Goofish, fonctionne même quand le solde
//     JustOneAPI est à zéro (code 601).
//   - 'justone'  : Just One API (moteur historique, chemin intact).
//
// Persistance : blob `bm-sources` / `sources.json` (Netlify) ou
// `data/sources.json` (dev local). En prod, les écritures passent par
// `withBlobLock` (create-if-not-exists) pour une consistance FORTE entre
// plusieurs instances serverless — la lecture utilise `consistency: 'strong'`.
//
// IMPORTANT : le headless n'est implémenté QUE pour xianyu (goofish). Les
// autres plateformes utilisent toujours JustOneAPI ; si le toggle est réglé
// sur 'headless' pour elles, `resolveDesiredEngine` le ramène à 'justone' en
// journalisant un avertissement (jamais d'échec silencieux).
// ---------------------------------------------------------------------------

export type SourceEngine = 'headless' | 'justone'

/** Plateformes exposées dans le toggle admin (mêmes clés que JoPlatform). */
export const SOURCE_PLATFORMS: JoPlatform[] = ['xianyu', '1688', 'taobao', 'tiktok-shop', 'amazon', 'douyin-ec']

/** Seule plateforme pour laquelle le scraping headless est implémenté/testé. */
export const HEADLESS_SUPPORTED_PLATFORMS: JoPlatform[] = ['xianyu']

export const DEFAULT_SOURCES: Record<JoPlatform, SourceEngine> = {
  xianyu: 'headless', // décision produit : headless prioritaire pour goofish
  '1688': 'justone',
  taobao: 'justone',
  'tiktok-shop': 'justone',
  amazon: 'justone',
  'douyin-ec': 'justone',
}

const SOURCES_FILE = path.join(process.cwd(), 'data', 'sources.json')

export function normalizeSources(raw: any): Record<JoPlatform, SourceEngine> {
  const out: Record<JoPlatform, SourceEngine> = { ...DEFAULT_SOURCES }
  if (raw && typeof raw === 'object') {
    for (const p of SOURCE_PLATFORMS) {
      const v = raw[p]
      if (v === 'headless' || v === 'justone') out[p] = v
    }
  }
  return out
}

/** Lire le toggle complet (défauts mergés si le blob/fichier est absent). */
export async function loadSources(): Promise<Record<JoPlatform, SourceEngine>> {
  if (isNetlifyRuntime()) {
    try {
      const s = getStore({ name: 'bm-sources' })
      const raw = await s.get('sources.json', { type: 'text', consistency: 'strong' } as any)
      if (raw != null) return normalizeSources(JSON.parse(String(raw)))
    } catch (err) {
      console.error('[BLOBS] sources read failed:', err)
    }
    return { ...DEFAULT_SOURCES }
  }
  try {
    const raw = await fs.promises.readFile(SOURCES_FILE, 'utf-8')
    return normalizeSources(JSON.parse(raw.replace(/^\uFEFF/, '')))
  } catch {
    return { ...DEFAULT_SOURCES }
  }
}

/** Merge + persist un patch partiel, retourne l'état complet normalisé. */
export async function saveSources(patch: Partial<Record<JoPlatform, SourceEngine>>): Promise<Record<JoPlatform, SourceEngine>> {
  const write = (sources: Record<JoPlatform, SourceEngine>) => {
    if (isNetlifyRuntime()) {
      const s = getStore({ name: 'bm-sources' })
      return s.set('sources.json', JSON.stringify(sources, null, 2))
    }
    return fs.promises.mkdir(path.dirname(SOURCES_FILE), { recursive: true }).then(() =>
      fs.promises.writeFile(SOURCES_FILE, JSON.stringify(sources, null, 2), 'utf-8'),
    )
  }
  if (isNetlifyRuntime()) {
    // Consistance forte entre instances : verrou distribué create-if-not-exists.
    return withBlobLock('bm-sources', 'sources.json', async () => {
      const current = await loadSources()
      const merged = normalizeSources({ ...current, ...patch })
      await write(merged)
      return merged
    })
  }
  // Dev local : mutex in-process (même pattern que mutateSocial).
  return withLock('sources', async () => {
    const current = await loadSources()
    const merged = normalizeSources({ ...current, ...patch })
    await write(merged)
    return merged
  })
}

/**
 * Moteur EFFECTIVEMENT utilisé pour une plateforme, en tenant compte du fait
 * que le headless n'existe que pour xianyu. Ne lance jamais : ramène toujours
 * un moteur valide.
 */
export async function resolveDesiredEngine(platform: JoPlatform): Promise<SourceEngine> {
  const sources = await loadSources()
  const configured = sources[platform] || DEFAULT_SOURCES[platform] || 'justone'
  if (configured === 'headless' && !HEADLESS_SUPPORTED_PLATFORMS.includes(platform)) {
    console.warn(
      `[sources] headless n'est implémenté que pour xianyu (goofish) — ${platform} utilisera JustOneAPI.`,
    )
    return 'justone'
  }
  return configured
}
