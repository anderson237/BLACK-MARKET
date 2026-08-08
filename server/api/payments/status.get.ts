import { requireAuth } from '~~/server/utils/auth'
import { mutateOrders, mutatePayments, loadPayments, loadAllOrders, loadCart, saveCart } from '~~/server/utils/storage'
import { publishSiteUpdate } from '~~/server/utils/realtime'
import { getPayunitCheckoutStatus, payunitConfigured } from '~~/server/utils/payunit'

/**
 * Resolve a payment record from the return page query.
 * ?tx=<transactionId> is our internal id (the reliable one, PayUnit does not
 * add a query param on redirect). ?checkout_id= is accepted as a fallback.
 */
async function findPayment(query: Record<string, any>) {
  const payments = await loadPayments()
  const tx = String(query?.tx || '')
  const cid = String(query?.checkout_id || '')
  if (tx) return payments.find((p) => p.transactionId === tx) || null
  if (cid) return payments.find((p) => p.checkoutId === cid) || null
  return null
}

/**
 * Poll PayUnit for the checkout status and (on SUCCESS) mark the covered
 * orders as paid exactly once. Public read for the return page — ownership is
 * checked against the logged-in user.
 */
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  if (!payunitConfigured()) {
    throw createError({ statusCode: 503, statusMessage: 'Paiement en ligne indisponible.' })
  }
  const query = getQuery(event)
  const rec = await findPayment(query)
  if (!rec) {
    throw createError({ statusCode: 404, statusMessage: 'Transaction introuvable.' })
  }
  if (String(rec.userId || '') !== String(session.userId || '')) {
    throw createError({ statusCode: 403, statusMessage: 'Accès refusé.' })
  }

  const data = await getPayunitCheckoutStatus(rec.checkoutId)
  const payStatus: PaymentStatus = String(data?.status || 'PENDING').toUpperCase()
  const finalStatus = payStatus === 'SUCCESS' || payStatus === 'FAILED' || payStatus === 'CANCELLED' ? payStatus : 'PENDING'

  // Idempotent: only touch orders on the first confirmed SUCCESS.
  let markedPaid = false
  if (finalStatus === 'SUCCESS' && rec.status !== 'SUCCESS') {
    await mutateOrders((orders) => {
      for (const id of rec.orderIds) {
        const o = orders.find((x) => x.id === id && !x.deleted)
        if (o && o.payment?.status !== 'paid') {
          o.payment = { method: 'payunit', status: 'paid', paidAt: new Date().toISOString(), checkoutId: rec.checkoutId }
          markedPaid = true
        }
      }
      return { next: orders, value: undefined }
    })
    // Remove the paid products from the user's basket.
    const allOrders = await loadAllOrders()
    const paidProductIds = new Set(
      rec.orderIds
        .map((id) => allOrders.find((o) => o.id === id))
        .filter(Boolean)
        .map((o) => String(o.productId || '')),
    )
    if (paidProductIds.size) {
      const cart = await loadCart(String(rec.userId || ''))
      await saveCart(String(rec.userId || ''), cart.filter((c) => !paidProductIds.has(String(c.productId || ''))))
    }
    await mutatePayments((payments) => {
      const idx = payments.findIndex((p) => p.transactionId === rec.transactionId)
      if (idx >= 0) payments[idx] = { ...payments[idx], status: 'SUCCESS', updatedAt: new Date().toISOString() }
      return { next: payments, value: undefined }
    })
    if (markedPaid) publishSiteUpdate('orders')
  } else if (finalStatus !== 'PENDING') {
    // Persist terminal non-success states (FAILED/CANCELLED) for the admin log.
    await mutatePayments((payments) => {
      const idx = payments.findIndex((p) => p.transactionId === rec.transactionId)
      if (idx >= 0) payments[idx] = { ...payments[idx], status: finalStatus, updatedAt: new Date().toISOString() }
      return { next: payments, value: undefined }
    })
  }

  return {
    success: true,
    status: finalStatus,
    payment: { ...rec, status: rec.status === 'SUCCESS' || finalStatus === 'SUCCESS' ? 'SUCCESS' : finalStatus },
  }
})

type PaymentStatus = 'PENDING' | 'FAILED' | 'CANCELLED' | 'SUCCESS'
