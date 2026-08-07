import { loadAllOrders } from '~~/server/utils/storage'
import { requireAuth } from '~~/server/utils/auth'

// Admin: active orders + trash (soft-deleted). loadAllOrders() so the trash
// can be restored / purged from the UI. Non-admin requests are rejected.
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  if (session.role !== 'admin') throw createError({ statusCode: 403, statusMessage: 'Accès administrateur requis.' })
  const all = await loadAllOrders()
  return {
    success: true,
    orders: all.filter((o: any) => !o.deleted),
    trash: all.filter((o: any) => o.deleted),
  }
})
