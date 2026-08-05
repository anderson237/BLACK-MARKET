import { requireAuth } from '~~/server/utils/auth'
import { loadSettings, saveSettings, normalizeSettings } from '~~/server/utils/storage'

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  if (!['admin', 'editor', 'publisher'].includes(String(session.role || ''))) {
    throw createError({ statusCode: 403, statusMessage: 'Accès réservé à la gestion.' })
  }
  const body = await readBody(event).catch(() => ({}))
  const next = normalizeSettings({ ...(await loadSettings()), ...body })
  await saveSettings(next)
  return { success: true, settings: next }
})
