import { mutateOrders, removeChatThreadForOrder } from '~~/server/utils/storage'
import { requireAuth } from '~~/server/utils/auth'
import { publishSiteUpdate } from '~~/server/utils/realtime'

// Soft-delete an order: it disappears from the whole site (stats, accounting,
// treasury, chat, client space) and lands in the admin trash, where it can be
// restored or permanently deleted. Its chat thread (ord:<id>) is removed.
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  if (session.role !== 'admin') throw createError({ statusCode: 403, statusMessage: 'Accès administrateur requis.' })
  const id = getRouterParam(event, 'id')

  let outcome: 'ok' | 'not-found' | 'already' = 'not-found'
  await mutateOrders((orders) => {
    const order = orders.find((o) => o.id === id)
    if (!order) return { next: null, value: undefined }
    if (order.deleted) {
      outcome = 'already'
      return { next: null, value: undefined }
    }
    order.deleted = true
    order.deletedAt = new Date().toISOString()
    outcome = 'ok'
    return { next: orders, value: undefined }
  })

  if (outcome === 'not-found') throw createError({ statusCode: 404, statusMessage: 'Commande introuvable.' })
  if (outcome === 'already') throw createError({ statusCode: 400, statusMessage: 'Commande déjà dans la corbeille.' })

  if (id) await removeChatThreadForOrder(id)
  publishSiteUpdate('orders')
  return { success: true, trashed: true }
})
