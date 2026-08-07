import { mutateOrders, removeChatThreadForOrder } from '~~/server/utils/storage'
import { requireAuth } from '~~/server/utils/auth'
import { publishSiteUpdate } from '~~/server/utils/realtime'

// Permanently delete an order (from the trash). Also purges its chat thread.
// This is irreversible.
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  if (session.role !== 'admin') throw createError({ statusCode: 403, statusMessage: 'Accès administrateur requis.' })
  const id = getRouterParam(event, 'id')

  let removed = false
  await mutateOrders((orders) => {
    const next = orders.filter((o) => o.id !== id)
    removed = next.length !== orders.length
    return removed ? { next, value: undefined } : { next: null, value: undefined }
  })

  if (!removed) throw createError({ statusCode: 404, statusMessage: 'Commande introuvable.' })
  await removeChatThreadForOrder(id)
  publishSiteUpdate('orders')
  return { success: true, permanentlyDeleted: id }
})
