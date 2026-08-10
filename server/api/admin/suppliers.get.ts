import { listSuppliers } from '~~/server/utils/storage'
import { requireAuth } from '~~/server/utils/auth'

// Admin: list suppliers (ST-019). Optional ?auto=true|false filter: true = only
// auto-captured suppliers (manual:false), false = only manually created ones.
// Sorted by most recently updated first.
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  if (session.role !== 'admin') throw createError({ statusCode: 403, statusMessage: 'Accès administrateur requis.' })

  const query = getQuery(event)
  let suppliers = await listSuppliers()
  if (String(query.auto) === 'true') suppliers = suppliers.filter((s) => !s.manual)
  else if (String(query.auto) === 'false') suppliers = suppliers.filter((s) => s.manual)

  suppliers = [...suppliers].sort(
    (a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime(),
  )
  return { success: true, suppliers }
})