import { resetSocial } from '~~/server/utils/storage'
import { requireAuth } from '~~/server/utils/auth'

// Admin-only: wipe every user's interaction stats (views, clicks, likes,
// shares, comments). All of it lives in the social store (comments, like
// index, event log) -> a single reset is enough. Business data (products,
// orders, accounts) is untouched.
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  if (session.role !== 'admin') throw createError({ statusCode: 403, statusMessage: 'Accès administrateur requis.' })
  await resetSocial()
  return { success: true, message: 'Statistiques de tous les utilisateurs (vues, clics, likes, commentaires, partages) remis à zéro.' }
})
