import { resetSocial } from '~~/server/utils/storage'
import { requireAuth } from '~~/server/utils/auth'

// Admin-only: wipe every user's interaction stats (views, clicks, likes,
// shares, comments). Business data (products, orders, accounts) is untouched.
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  if (session.role !== 'admin') throw createError({ statusCode: 403, statusMessage: 'Accès administrateur requis.' })
  await resetSocial()
  return { success: true, message: 'Statistiques de tous les utilisateurs remises à zéro.' }
})
