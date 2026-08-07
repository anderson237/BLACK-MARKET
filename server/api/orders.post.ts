import { loadOrders, saveOrders, withLock } from '~~/server/utils/storage'
import { requireAuth, rateLimit } from '~~/server/utils/auth'
import { migratePreorderToOrder } from '~~/server/utils/chat'
import { publishSiteUpdate } from '~~/server/utils/realtime'
import { sendEmail } from '~~/server/utils/email'

// Recipient for new-order notifications (env configurable, sane default).
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

// Confirmation email: a logged-in client just confirmed their preorder(s).
async function notifyAdminNewOrder(order: any) {
  const subject = `🚚 Nouvelle commande confirmée — ${order.productTitle || 'Article'}`
  const text = [
    `Bonjour Admin,`,
    ``,
    `Une commande vient d'être confirmée sur DEEP ROOTS :`,
    ``,
    `📦 Produit : ${order.productTitle || '—'}`,
    `🔢 Quantité : ${order.quantity || 1}`,
    `💰 Total : ${fmtXof((Number(order.priceXof) || 0) * (Number(order.quantity) || 1))}`,
    `👤 Client : ${order.customerName || '—'}`,
    `📱 Téléphone : ${order.customerPhone || '—'}`,
    `📍 Localisation : ${order.customerLocation || '—'}`,
    ``,
    `Réf : ${order.id}`,
    ``,
    `Traitez la commande dans votre console admin : ${process.env.SITE_URL || 'https://deeproots-importexport.netlify.app'}/admin/orders`,
  ].join('\n')
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#0b0b10;font-family:Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:24px">
    <div style="text-align:center;padding:18px 0">
      <span style="display:inline-block;background:#ff2a2a;color:#fff;font-weight:900;font-size:22px;width:44px;height:44px;line-height:44px;border-radius:10px">D</span>
      <p style="color:#fff;font-weight:800;letter-spacing:3px;font-size:13px;margin:10px 0 0">DEEP ROOTS</p>
      <p style="color:#9ca3af;font-size:11px;margin:2px 0 0">NOUVELLE COMMANDE CONFIRMÉE 🔥</p>
    </div>
    <div style="background:#14141c;border:1px solid #26262f;border-radius:16px;padding:20px;color:#e5e7eb">
      <p style="margin:0 0 14px;font-size:14px"><b style="color:#fff">${order.productTitle || 'Article'}</b> × ${order.quantity || 1}</p>
      <p style="margin:0 0 6px;font-size:13px;color:#f3f4f6">💰 <b style="color:#ff2a2a">${fmtXof((Number(order.priceXof) || 0) * (Number(order.quantity) || 1))}</b></p>
      <p style="margin:0 0 6px;font-size:12px;color:#9ca3af">👤 ${order.customerName || '—'} · ${order.customerPhone || '—'}</p>
      <p style="margin:0 0 16px;font-size:12px;color:#9ca3af">📍 ${order.customerLocation || '—'}</p>
      <a href="${process.env.SITE_URL || 'https://deeproots-importexport.netlify.app'}/admin/orders" style="display:block;background:#ff2a2a;color:#fff;text-align:center;font-weight:700;font-size:14px;padding:14px;border-radius:12px;text-decoration:none">TRAITER LA COMMANDE →</a>
      <p style="margin:14px 0 0;font-size:10px;color:#6b7280;font-family:monospace">Réf ${order.id}</p>
    </div>
  </div></body></html>`
  return sendEmail(adminEmail(), subject, text, html)
}

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
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
    userId: session.userId || undefined,
    quantity: Math.max(1, Number(body.quantity) || 1),
    priceXof: Number(body.priceXof) || 0,
    priceEur: Number(body.priceEur) || 0,
    status: ['pending', 'processing', 'completed', 'shipped', 'cancelled'].includes(body.status) ? body.status : 'pending',
    createdAt: String(body.createdAt || new Date().toISOString()),
  }
  return withLock('orders', async () => {
    const orders = await loadOrders()
    const idx = orders.findIndex((o) => o.id === id)
    let created = false
    if (idx >= 0) orders[idx] = order
    else {
      // Dedupe: a logged-in user preordering the same product twice keeps one
      // pending order instead of spamming the admin console.
      const dup = order.userId
        ? orders.findIndex((o) => o.userId === order.userId && o.productId === order.productId && o.status === 'pending')
        : -1
      if (dup >= 0) orders[dup] = { ...orders[dup], ...order }
      else {
        orders.unshift(order)
        created = true
      }
    }
    await saveOrders(orders)

    // Preserve the preorder conversation on the new confirmed order.
    if (created && order.userId) {
      await migratePreorderToOrder(order.id, order.userId, {
        productTitle: order.productTitle,
        customerName: order.customerName,
      })
    }

    // Notify the admin (email) when a logged-in client confirms an order.
    if (created && order.userId) {
      notifyAdminNewOrder(order).catch((e) => console.error('[orders] admin email failed:', e))
    }

    // Site-wide: the admin console + client space refresh instantly.
    publishSiteUpdate('orders')

    return { success: true, order: idx >= 0 ? orders[idx] : order }
  })
})