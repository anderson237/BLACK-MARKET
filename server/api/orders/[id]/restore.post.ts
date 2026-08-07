import { mutateOrders } from '~~/server/utils/storage'
import { requireAuth } from '~~/server/utils/auth'
import { publishSiteUpdate } from '~~/server/utils/realtime'

// Restore a trashed order back to the active list (stats count it again).
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  if (session.role !== 'admin') throw createError({ statusCode: 403, statusMessage: 'Accès administrateur requis.' })
  const id = getRouterParam(event, 'id')

  let outcome: 'ok' | 'not-found' | 'not-trashed' = 'not-found'
  await mutateOrders((orders) => {
    const order = orders.find((o) => o.id === id)
    if (!order) return { next: null, value: undefined }
    if (!order.deleted) {
      outcome = 'not-trashed'
      return { next: null, value: undefined }
    }
    delete order.deleted
    delete order.deletedAt
    outcome = 'ok'
    return { next: orders, value: undefined }
  })

  if (outcome === 'not-found') throw createError({ statusCode: 404, statusMessage: 'Commande introuvable.' })
  if (outcome === 'not-trashed') throw createError({ statusCode: 400, statusMessage: 'Cette commande n\'est pas dans la corbeille.' })
  publishSiteUpdate('orders')
  return { success: true, restored: true }
})
