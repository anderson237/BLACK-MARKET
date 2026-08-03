import { resetSocial, loadProducts, saveProducts } from '~~/server/utils/storage'
import { requireAuth } from '~~/server/utils/auth'

// Admin-only: wipe every user's interaction stats (views, clicks, likes,
// shares, comments) AND the per-product WhatsApp click counters. Business data
// (products, orders, accounts) is otherwise untouched.
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  if (session.role !== 'admin') throw createError({ statusCode: 403, statusMessage: 'Accès administrateur requis.' })
  await resetSocial()
  const products = await loadProducts()
  const cleared = products.map((p: any) => ({ ...p, whatsappClicks: 0 }))
  await saveProducts(cleared)
  return { success: true, message: 'Statistiques de tous les utilisateurs et clics WhatsApp produits remis à zéro.' }
})
