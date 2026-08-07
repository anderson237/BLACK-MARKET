import { loadOrders, saveOrders } from '~~/server/utils/storage'
import { requireAuth } from '~~/server/utils/auth'
import { publishSiteUpdate } from '~~/server/utils/realtime'

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const id = getRouterParam(event, 'id')
  const orders = await loadOrders()
  const next = orders.filter((o) => o.id !== id)
  if (next.length === orders.length) throw createError({ statusCode: 404, statusMessage: 'Commande introuvable.' })
  await saveOrders(next)
  publishSiteUpdate('orders')
  return { success: true }
})