import { requireAuth, rateLimit } from '~~/server/utils/auth'
import { mutateOrders, mutatePayments, loadProducts, loadAccounts } from '~~/server/utils/storage'
import { migratePreorderToOrder } from '~~/server/utils/chat'
import { publishSiteUpdate } from '~~/server/utils/realtime'
import { payunitConfigured, initPayunitCheckout, type PayUnitItem } from '~~/server/utils/payunit'
import { sendEmail } from '~~/server/utils/email'

function adminEmail(): string {
  const list = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || 'elomopatrick.pn@gmail.com')
    .toLowerCase()
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return list[0] || 'elomopatrick.pn@gmail.com'
}

function fmtXof(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(Number(n) || 0) + ' F CFA'
}

async function notifyAdminPaidOrder(orders: any[], totalXof: number) {
  const subject = `💳 Paiement reçu (PayUnit) — ${orders.length} commande${orders.length > 1 ? 's' : ''}`
  const lines = orders.map((o) => `• ${o.productTitle || 'Article'} × ${o.quantity || 1} — ${fmtXof((Number(o.priceXof) || 0) * (Number(o.quantity) || 1))}`).join('\n')
  const text = [
    `Bonjour Admin,`,
    ``,
    `Un paiement PayUnit vient d'\u00eatre confirm\u00e9 sur DEEP ROOTS :`,
    ``,
    lines,
    ``,
    `💰 TOTAL : ${fmtXof(totalXof)}`,
    `👤 Client : ${orders[0]?.customerName || '—'}`,
    `📱 Téléphone : ${orders[0]?.customerPhone || '—'}`,
    ``,
    `Réfs : ${orders.map((o) => o.id).join(', ')}`,
    ``,
    `Traitez les commandes dans votre console admin : ${process.env.SITE_URL || 'https://deeproots-importexport.netlify.app'}/admin/orders`,
  ].join('\n')
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#0b0b10;font-family:Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:24px">
    <div style="text-align:center;padding:18px 0">
      <span style="display:inline-block;background:#22c55e;color:#fff;font-weight:900;font-size:22px;width:44px;height:44px;line-height:44px;border-radius:10px">D</span>
      <p style="color:#fff;font-weight:800;letter-spacing:3px;font-size:13px;margin:10px 0 0">DEEP ROOTS</p>
      <p style="color:#9ca3af;font-size:11px;margin:2px 0 0">PAIEMENT CONFIRMÉ 💳</p>
    </div>
    <div style="background:#14141c;border:1px solid #26262f;border-radius:16px;padding:20px;color:#e5e7eb">
      <p style="margin:0 0 12px;font-size:13px">${orders.length} commande${orders.length > 1 ? 's' : ''} payée${orders.length > 1 ? 's' : ''} :</p>
      <p style="margin:0 0 10px;font-size:12px;color:#d1d5db;white-space:pre-line">${lines}</p>
      <p style="margin:0 0 6px;font-size:14px;color:#f3f4f6">💰 <b style="color:#22c55e">${fmtXof(totalXof)}</b></p>
      <p style="margin:0 0 6px;font-size:12px;color:#9ca3af">👤 ${orders[0]?.customerName || '—'} · ${orders[0]?.customerPhone || '—'}</p>
      <p style="margin:0 0 16px;font-size:12px;color:#9ca3af">📍 ${orders[0]?.customerLocation || '—'}</p>
      <a href="${process.env.SITE_URL || 'https://deeproots-importexport.netlify.app'}/admin/orders" style="display:block;background:#22c55e;color:#fff;text-align:center;font-weight:700;font-size:14px;padding:14px;border-radius:12px;text-decoration:none">TRAITER LES COMMANDES →</a>
      <p style="margin:14px 0 0;font-size:10px;color:#6b7280;font-family:monospace">${orders.map((o) => o.id).join(' · ')}</p>
    </div>
  </div></body></html>`
  return sendEmail(adminEmail(), subject, text, html)
}

/**
 * Start a PayUnit hosted checkout for the client's preorders.
 * Body: { items: [{ productId, quantity }] } — prices are recomputed from the
 * real product catalog server-side, never trusted from the client.
 * Creates the pending orders (same dedupe as /api/orders), then initializes the
 * payment and returns the hosted payment page URL to redirect the client to.
 */
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  rateLimit(20, 60_000)(event)
  if (!payunitConfigured()) {
    throw createError({ statusCode: 503, statusMessage: 'Le paiement en ligne n\u2019est pas encore disponible.' })
  }
  const body = await readBody(event).catch(() => ({}))
  const rawItems = Array.isArray(body?.items) ? body.items : []
  if (!rawItems.length) {
    throw createError({ statusCode: 400, statusMessage: 'Panier vide.' })
  }
  if (rawItems.length > 30) {
    throw createError({ statusCode: 400, statusMessage: 'Trop d\u2019articles pour un paiement.' })
  }

  // Resolve real products (authoritative prices + titles + images).
  const products = await loadProducts()
  const resolved: { product: any; quantity: number }[] = []
  for (const it of rawItems) {
    const pid = String(it?.productId || '')
    const qty = Math.max(1, Math.min(999, Number(it?.quantity) || 1))
    const product = products.find((p) => String(p.id) === pid)
    if (!product) {
      throw createError({ statusCode: 400, statusMessage: 'Produit introuvable dans le catalogue.' })
    }
    resolved.push({ product, quantity: qty })
  }

  // Resolve the real customer profile (authoritative name/phone/country).
  const accounts = await loadAccounts()
  const account = accounts.find((a) => String(a.id) === String(session.userId || '')) || null

  // Create the pending orders (same dedupe semantics as /api/orders).
  const createdOrders: any[] = []
  const ts = Date.now()
  for (const { product, quantity } of resolved) {
    const id = `ord_${ts}_${Math.random().toString(36).slice(2, 8)}`
    const order = {
      id,
      productId: String(product.id || ''),
      productTitle: String(product.title || '').slice(0, 200),
      productImage: String(product.imageUrl || '').slice(0, 500),
      customerName: String(account?.name || account?.pseudo || session.name || 'Client WhatsApp').slice(0, 120),
      customerPhone: String(account?.phone || '').slice(0, 40),
      customerLocation: String(account?.country || '—').slice(0, 120),
      userId: session.userId || undefined,
      quantity,
      priceXof: Number(product.priceXof) || 0,
      priceEur: Number(product.priceEur) || 0,
      status: 'pending',
      payment: { method: 'payunit', status: 'pending' },
      createdAt: new Date().toISOString(),
    }
    let created = false
    await mutateOrders((orders) => {
      const dup = order.userId
        ? orders.findIndex((o) => !o.deleted && o.userId === order.userId && o.productId === order.productId && o.status === 'pending')
        : -1
      if (dup >= 0) {
        orders[dup] = { ...orders[dup], ...order, payment: { ...(orders[dup].payment || {}), method: 'payunit', status: 'pending' } }
        createdOrders.push(orders[dup])
      } else {
        orders.unshift(order)
        createdOrders.push(order)
        created = true
      }
      return { next: orders, value: undefined }
    })
    if (created && order.userId) {
      await migratePreorderToOrder(order.id, order.userId, {
        productTitle: order.productTitle,
        customerName: order.customerName,
      })
    }
  }

  // Total in FCFA (PayUnit accepts XAF; XOF and XAF are the same CFA value).
  const totalAmount = resolved.reduce((s, { product, quantity }) => s + (Number(product.priceXof) || 0) * quantity, 0)
  if (!(totalAmount > 0)) {
    throw createError({ statusCode: 400, statusMessage: 'Montant invalide.' })
  }

  const siteUrl = process.env.SITE_URL || 'https://deeproots-importexport.netlify.app'
  const transactionId = `dr_${ts}_${Math.random().toString(36).slice(2, 8)}`
  const items: PayUnitItem[] = resolved.map(({ product, quantity }) => ({
    price_description: { unit_amount: Number(product.priceXof) || 0 },
    product_description: {
      name: String(product.title || 'Article').slice(0, 120),
      image_url: String(product.imageUrl || `${siteUrl}/og-image.png`),
      about_product: String(product.description || '').slice(0, 500) || undefined,
    },
    quantity,
  }))

  const { redirect, checkoutId } = await initPayunitCheckout({
    transaction_id: transactionId,
    total_amount: totalAmount,
    currency: 'XAF',
    success_url: `${siteUrl}/paiement/retour?tx=${encodeURIComponent(transactionId)}`,
    cancel_url: `${siteUrl}/paiement/retour?tx=${encodeURIComponent(transactionId)}&canceled=1`,
    notify_url: `${siteUrl}/api/payments/webhook`,
    items,
  })

  // Persist the payment record so the return page / webhook can reconcile.
  await mutatePayments((payments) => {
    payments.push({
      checkoutId,
      transactionId,
      userId: session.userId || '',
      orderIds: createdOrders.map((o) => o.id),
      amountXof: totalAmount,
      currency: 'XAF',
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    return { next: payments.slice(-500), value: undefined }
  })

  publishSiteUpdate('orders')
  return { success: true, redirectUrl: redirect, checkoutId, transactionId, totalAmount }
})
