import { requireAuth } from '~~/server/utils/auth'
import { computeTreasury } from '~~/server/utils/treasury'

const ALLOWED_ROLES = ['admin', 'editor', 'publisher']

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  if (!ALLOWED_ROLES.includes(String(session.role || ''))) {
    throw createError({ statusCode: 403, statusMessage: 'Accès réservé à la gestion.' })
  }
  const treasury = await computeTreasury()
  return { success: true, treasury }
})
