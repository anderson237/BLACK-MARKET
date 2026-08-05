import { loadTreasury, saveTreasury, withLock } from '~~/server/utils/storage'
import { requireAuth } from '~~/server/utils/auth'

const ALLOWED_ROLES = ['admin', 'editor', 'publisher']

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  if (!ALLOWED_ROLES.includes(String(session.role || ''))) {
    throw createError({ statusCode: 403, statusMessage: 'Accès réservé à la gestion.' })
  }
  const body = await readBody(event).catch(() => ({}))
  const initialBalanceXof = Math.round(Number(body.initialBalanceXof) || 0)
  if (initialBalanceXof < 0) throw createError({ statusCode: 400, statusMessage: 'Solde initial invalide.' })

  await withLock('treasury', async () => {
    const data = await loadTreasury()
    data.settings.initialBalanceXof = initialBalanceXof
    await saveTreasury(data)
  })

  return { success: true, initialBalanceXof }
})
