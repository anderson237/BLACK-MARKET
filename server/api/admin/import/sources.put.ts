import { requireAuth } from '~~/server/utils/auth'
import { saveSources, SOURCE_PLATFORMS, type SourceEngine } from '~~/server/utils/sources'

// Admin: update the per-platform import source toggle (headless | justone).
// Body: { sources?: Record<JoPlatform, 'headless'|'justone'> } — partial patch.
// Consistance forte : écriture sous verrou distribué (withBlobLock) en prod,
// mutex in-process en dev (voir server/utils/sources.ts).
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  if (session.role !== 'admin') throw createError({ statusCode: 403, statusMessage: 'Accès administrateur requis.' })
  const body = await readBody(event).catch(() => ({}))
  const input = body?.sources && typeof body.sources === 'object' ? body.sources : body || {}

  const patch: Partial<Record<string, SourceEngine>> = {}
  for (const platform of Object.keys(input)) {
    if (!(SOURCE_PLATFORMS as string[]).includes(platform)) continue
    const engine = String(input[platform])
    if (engine !== 'headless' && engine !== 'justone') {
      throw createError({ statusCode: 400, statusMessage: `Moteur invalide pour ${platform} (attendu 'headless' ou 'justone').` })
    }
    patch[platform] = engine
  }
  if (!Object.keys(patch).length) {
    throw createError({ statusCode: 400, statusMessage: 'Aucun réglage source fourni.' })
  }

  const sources = await saveSources(patch)
  return { success: true, sources }
})
