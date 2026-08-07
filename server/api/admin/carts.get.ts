import { loadAllCarts, loadAccounts, type CartItem } from '~~/server/utils/storage'
import { requireAuth } from '~~/server/utils/auth'

// Admin view of all non-confirmed baskets ("abandoned carts"), joined with the
// customer account so the merchant can re-engage them (WhatsApp follow-up).
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  if (session.role !== 'admin') throw createError({ statusCode: 403, statusMessage: 'Accès administrateur requis.' })

  const [carts, accounts] = await Promise.all([loadAllCarts(), loadAccounts()])
  const byId = new Map((accounts || []).map((a) => [a.id, a]))

  const rows = Object.entries(carts || {})
    .map(([userId, items]) => {
      const acc = byId.get(userId)
      const list: CartItem[] = Array.isArray(items) ? items : []
      const totalXof = list.reduce((s, c) => s + (Number(c.priceXof) || 0) * (Number(c.quantity) || 1), 0)
      const itemsCount = list.reduce((s, c) => s + (Number(c.quantity) || 1), 0)
      const lastAdded = list.length ? Math.max(...list.map((c) => new Date(c.addedAt || 0).getTime())) : 0
      return {
        userId,
        customer: {
          name: acc?.pseudo || acc?.name || acc?.email || 'Client invité',
          email: acc?.email || '',
          phone: acc?.phone || '',
          phonePrefix: acc?.phonePrefix || '',
          country: acc?.country || '',
          picture: acc?.picture || '',
        },
        items: list,
        itemsCount,
        totalXof,
        lastAdded,
        addedAt: lastAdded ? new Date(lastAdded).toISOString() : '',
      }
    })
    .filter((r) => r.items.length > 0)
    .sort((a, b) => b.lastAdded - a.lastAdded)

  return { success: true, carts: rows }
})
