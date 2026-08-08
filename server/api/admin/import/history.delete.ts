import { requireAuth } from '~~/server/utils/auth'
import { clearImportHistory } from '~~/server/utils/storage'

// Admin import history clearing (ST-017): wipe all cached searches.
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  if (session.role !== 'admin') throw createError({ statusCode: 403, statusMessage: 'Accès administrateur requis.' })
  await clearImportHistory()
  return { success: true }
})
