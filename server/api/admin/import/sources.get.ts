import { requireAuth } from '~~/server/utils/auth'
import { loadSources, DEFAULT_SOURCES } from '~~/server/utils/sources'

// Admin: read the per-platform import source toggle (headless | justone).
// BL-007 v2 — blob bm-sources / sources.json, defaults merged when absent.
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  if (session.role !== 'admin') throw createError({ statusCode: 403, statusMessage: 'Accès administrateur requis.' })
  const sources = await loadSources()
  return { success: true, sources, defaults: DEFAULT_SOURCES }
})
