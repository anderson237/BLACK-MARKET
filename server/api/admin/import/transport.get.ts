import { requireAuth } from '~~/server/utils/auth'
import { loadTransportConfig, estimateTransport } from '~~/server/utils/storage'

// Admin transport estimate (ST-017): return the transitaire config + a per
// category estimate (air: 10 000 CFA/kg, sea: 320 000 CFA/m³ by default).
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  if (session.role !== 'admin') throw createError({ statusCode: 403, statusMessage: 'Accès administrateur requis.' })
  const cfg = await loadTransportConfig()
  const estimates: Record<string, any> = {}
  for (const key of Object.keys(cfg.categories)) {
    estimates[key] = await estimateTransport(key)
  }
  return { success: true, config: cfg, estimates }
})
