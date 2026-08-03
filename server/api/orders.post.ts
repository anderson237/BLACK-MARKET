import { loadOrders, saveOrders } from '~~/server/utils/storage'
import { requireAuth, rateLimit } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  rateLimit(30, 60_000)(event)
  const body = await readBody(event)
  const id = String(body.id || `ord_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`)
  const order = {
    id,
    productId: String(body.productId || ''),
    productTitle: String(body.productTitle || '').slice(0, 200),
    productImage: String(body.productImage || '').slice(0, 500),
    customerName: String(body.customerName || 'Client WhatsApp').slice(0, 120),
    customerPhone: String(body.customerPhone || '').slice(0, 40),
    customerLocation: String(body.customerLocation || '—').slice(0, 120),
    quantity: Math.max(1, Number(body.quantity) || 1),
    priceXof: Number(body.priceXof) || 0,
    priceEur: Number(body.priceEur) || 0,
    status: ['pending', 'processing', 'completed', 'shipped', 'cancelled'].includes(body.status) ? body.status : 'pending',
    createdAt: String(body.createdAt || new Date().toISOString()),
  }
  const orders = await loadOrders()
  const idx = orders.findIndex((o) => o.id === id)
  if (idx >= 0) orders[idx] = order
  else orders.unshift(order)
  await saveOrders(orders)
  return { success: true, order }
})