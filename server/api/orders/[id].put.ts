import { mutateOrders } from '~~/server/utils/storage'
import { requireAuth, rateLimit } from '~~/server/utils/auth'
import { publishSiteUpdate } from '~~/server/utils/realtime'

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  if (session.role !== 'admin') throw createError({ statusCode: 403, statusMessage: 'Accès administrateur requis.' })
  rateLimit(30, 60_000)(event)
  const id = getRouterParam(event, 'id')
  const body = await readBody(event).catch(() => ({}))

  let updatedOrder: any = null
  await mutateOrders((orders) => {
    const idx = orders.findIndex((o) => o.id === id)
    if (idx < 0) return { next: null, value: undefined }
    const next = { ...orders[idx] }
    if (body?.status && ['pending', 'processing', 'completed', 'shipped', 'cancelled'].includes(body.status)) next.status = body.status
    if (body?.customerName) next.customerName = String(body.customerName).slice(0, 120)
    if (body?.customerPhone) next.customerPhone = String(body.customerPhone).slice(0, 40)
    if (body?.customerLocation) next.customerLocation = String(body.customerLocation).slice(0, 120)
    if (body?.quantity) next.quantity = Math.max(1, Number(body.quantity) || 1)
    orders[idx] = next
    updatedOrder = next
    return { next: orders, value: undefined }
  })

  if (!updatedOrder) throw createError({ statusCode: 404, statusMessage: 'Commande introuvable.' })
  publishSiteUpdate('orders')
  return { success: true, order: updatedOrder }
})
