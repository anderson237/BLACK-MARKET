import { loadProducts, loadOrders, saveOrders, pushEvent } from '~~/server/utils/storage'
import { rateLimit, clientIP } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  rateLimit(30, 60_000)(event)
  const body = await readBody(event)
  const productId = String(body?.productId || '')
  const quantity = Math.max(1, Number(body?.quantity) || 1)
  if (!productId) throw createError({ statusCode: 400, statusMessage: 'Identifiant produit manquant.' })

  const products = await loadProducts()
  const p = products.find((pp) => pp.id === productId)
  if (!p) throw createError({ statusCode: 404, statusMessage: 'Produit introuvable.' })

  // WhatsApp lead = one click, recorded in the SAME social event log that
  // powers every click counter (no parallel product.whatsappClicks anymore).
  await pushEvent({
    type: 'click',
    productId: p.id,
    productTitle: String(p.title || '').slice(0, 300),
    ts: Date.now(),
    userId: body?.userId ? String(body.userId) : undefined,
    ip: clientIP(event),
  })

  const order = {
    id: `ord_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    productId: p.id,
    productTitle: String(p.title || '').slice(0, 200),
    productImage: String(p.imageUrl || '').slice(0, 500),
    customerName: 'Nouveau lead WhatsApp',
    customerPhone: '',
    customerLocation: 'À confirmer',
    quantity,
    priceXof: Number(p.priceXof) || 0,
    priceEur: Number(p.priceEur) || 0,
    status: 'pending',
    createdAt: new Date().toISOString(),
  }
  const orders = await loadOrders()
  orders.unshift(order)
  await saveOrders(orders)
  return { success: true, order }
})