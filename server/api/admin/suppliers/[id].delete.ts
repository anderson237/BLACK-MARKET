import { deleteSupplier } from '~~/server/utils/storage'
import { requireAuth } from '~~/server/utils/auth'

// Admin: permanently delete a supplier (ST-019). The supplier disappears from
// the list; the associated products keep their seller/supplierContact data
// (a re-import of the same seller will re-create the supplier via upsert).
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  if (session.role !== 'admin') throw createError({ statusCode: 403, statusMessage: 'Accès administrateur requis.' })
  const id = String(getRouterParam(event, 'id') || '')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Identifiant manquant.' })

  const removed = await deleteSupplier(id)
  if (!removed) throw createError({ statusCode: 404, statusMessage: 'Fournisseur introuvable.' })
  return { success: true, removed }
})