import { loadOrders, saveOrders } from '~~/server/utils/storage'
import { requireAuth } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const id = getRouterParam(event, 'id')
  const orders = await loadOrders()
  const next = orders.filter((o) => o.id !== id)
  if (next.length === orders.length) throw createError({ statusCode: 404, statusMessage: 'Commande introuvable.' })
  await saveOrders(next)
  return { success: true }
})