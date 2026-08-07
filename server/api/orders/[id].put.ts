import { loadOrders, saveOrders } from '~~/server/utils/storage'
import { requireAuth, rateLimit } from '~~/server/utils/auth'
import { publishSiteUpdate } from '~~/server/utils/realtime'

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  rateLimit(30, 60_000)(event)
  const id = getRouterParam(event, 'id')
  const orders = await loadOrders()
  const idx = orders.findIndex((o) => o.id === id)
  if (idx < 0) throw createError({ statusCode: 404, statusMessage: 'Commande introuvable.' })
  const body = await readBody(event)
  const next = { ...orders[idx] }
  if (body?.status && ['pending', 'processing', 'completed', 'shipped', 'cancelled'].includes(body.status)) next.status = body.status
  if (body?.customerName) next.customerName = String(body.customerName).slice(0, 120)
  if (body?.customerPhone) next.customerPhone = String(body.customerPhone).slice(0, 40)
  if (body?.customerLocation) next.customerLocation = String(body.customerLocation).slice(0, 120)
  if (body?.quantity) next.quantity = Math.max(1, Number(body.quantity) || 1)
  orders[idx] = next
  await saveOrders(orders)
  publishSiteUpdate('orders')
  return { success: true, order: next }
})