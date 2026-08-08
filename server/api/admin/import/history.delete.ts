import { requireAuth } from '~~/server/utils/auth'
import { clearImportHistory, deleteImportSearch } from '~~/server/utils/storage'

// Admin import history clearing (ST-017): wipe all cached searches, or remove a
// single entry when a body { key } is provided (individual delete button).
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  if (session.role !== 'admin') throw createError({ statusCode: 403, statusMessage: 'Accès administrateur requis.' })
  const body = await readBody(event).catch(() => ({}))
  const key = String(body?.key || '').trim()
  if (key) {
    await deleteImportSearch(key)
  } else {
    await clearImportHistory()
  }
  return { success: true }
})
