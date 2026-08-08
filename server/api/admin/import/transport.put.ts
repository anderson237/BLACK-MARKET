import { requireAuth } from '~~/server/utils/auth'
import { loadTransportConfig, saveTransportConfig } from '~~/server/utils/storage'

// Admin transport estimate config (ST-017): update the transitaire rates
// (air per kg, sea per m³) and per-category weight/volume (emballage inclus).
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  if (session.role !== 'admin') throw createError({ statusCode: 403, statusMessage: 'Accès administrateur requis.' })
  const body = await readBody(event)
  const current = await loadTransportConfig()
  const cfg = {
    airXofPerKg: Number(body?.airXofPerKg) || current.airXofPerKg,
    seaXofPerCbm: Number(body?.seaXofPerCbm) || current.seaXofPerCbm,
    categories: { ...current.categories },
  }
  if (body?.categories && typeof body.categories === 'object') {
    for (const [k, v] of Object.entries<any>(body.categories)) {
      cfg.categories[k] = {
        weightKg: Number(v?.weightKg) || 0,
        volumeCbm: Number(v?.volumeCbm) || 0,
      }
    }
  }
  await saveTransportConfig(cfg)
  return { success: true, config: cfg }
})
