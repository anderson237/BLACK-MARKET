import { mutateOrders, mutatePayments, loadPayments, loadAllOrders, loadCart, saveCart } from '~~/server/utils/storage'
import { publishSiteUpdate } from '~~/server/utils/realtime'
import { getPayunitCheckoutStatus } from '~~/server/utils/payunit'

/**
 * PayUnit notify webhook (notify_url set at checkout initialization).
 *
 * PayUnit does not document a signed payload, so we NEVER trust the body alone:
 * the only thing we accept from it is the checkout id / transaction id, then we
 * confirm the real status through PayUnit's status endpoint before marking the
 * covered orders as paid. The update is idempotent (already-paid stays paid).
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => ({}))
  const checkoutId = String(body?.checkout_id || body?.checkoutId || body?.data?.checkout_id || '')
  const transactionId = String(body?.transaction_id || body?.transactionId || '')
  if (!checkoutId && !transactionId) {
    // Not a recognizable notification — acknowledge to stop PayUnit retries.
    return { success: false, message: 'missing identifiers' }
  }

  const payments = await loadPayments()
  const rec = checkoutId
    ? payments.find((p) => p.checkoutId === checkoutId)
    : payments.find((p) => p.transactionId === transactionId)
  if (!rec) {
    console.warn('[payunit-webhook] unknown transaction:', checkoutId || transactionId)
    return { success: false, message: 'unknown transaction' }
  }

  const data = await getPayunitCheckoutStatus(rec.checkoutId).catch((e) => {
    console.error('[payunit-webhook] status check failed:', e.message)
    return null
  })
  const payStatus = String(data?.status || '').toUpperCase()

  if (payStatus === 'SUCCESS') {
    await mutateOrders((orders) => {
      for (const id of rec.orderIds) {
        const o = orders.find((x) => x.id === id && !x.deleted)
        if (o && o.payment?.status !== 'paid') {
          o.payment = { method: 'payunit', status: 'paid', paidAt: new Date().toISOString(), checkoutId: rec.checkoutId }
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
      const idx = payments.findIndex((p) => p.checkoutId === rec.checkoutId)
      if (idx >= 0) payments[idx] = { ...payments[idx], status: 'SUCCESS', updatedAt: new Date().toISOString() }
      return { next: payments, value: undefined }
    })
    publishSiteUpdate('orders')
    return { success: true, status: 'SUCCESS' }
  }

  if (payStatus === 'FAILED' || payStatus === 'CANCELLED') {
    await mutatePayments((payments) => {
      const idx = payments.findIndex((p) => p.checkoutId === rec.checkoutId)
      if (idx >= 0) payments[idx] = { ...payments[idx], status: payStatus, updatedAt: new Date().toISOString() }
      return { next: payments, value: undefined }
    })
    return { success: true, status: payStatus }
  }

  // PENDING / unknown: acknowledge without touching orders.
  return { success: true, status: payStatus || 'PENDING' }
})
