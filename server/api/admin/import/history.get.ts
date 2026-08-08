import { requireAuth } from '~~/server/utils/auth'
import { loadImportHistory } from '~~/server/utils/storage'

// Admin import history listing (ST-017). Returns the last 50 cached searches,
// newest first, so the admin can reload an old search without re-hitting the
// paid JustOne API.
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  if (session.role !== 'admin') throw createError({ statusCode: 403, statusMessage: 'Accès administrateur requis.' })
  const list = await loadImportHistory()
  return { success: true, history: list.slice(0, 50) }
})
