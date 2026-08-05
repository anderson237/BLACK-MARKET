import { requireAuth } from '~~/server/utils/auth'
import { loadKpiSettings, saveKpiSettings } from '~~/server/utils/storage'
import { normalizeKpiSettings, DEFAULT_KPI_SETTINGS } from '~~/server/utils/accounting'

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  if (!['admin', 'editor', 'publisher'].includes(String(session.role || ''))) {
    throw createError({ statusCode: 403, statusMessage: 'Accès réservé à la gestion.' })
  }
  const body = await readBody(event).catch(() => ({}))
  const current = normalizeKpiSettings(await loadKpiSettings())
  const next = normalizeKpiSettings({ ...current, ...body })
  await saveKpiSettings(next)
  return { success: true, settings: next, defaults: DEFAULT_KPI_SETTINGS }
})
