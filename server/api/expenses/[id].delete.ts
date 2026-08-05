import { loadExpenses, saveExpenses, withLock } from '~~/server/utils/storage'
import { requireAuth } from '~~/server/utils/auth'

const ALLOWED_ROLES = ['admin', 'editor', 'publisher']

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  if (!ALLOWED_ROLES.includes(String(session.role || ''))) {
    throw createError({ statusCode: 403, statusMessage: 'Accès réservé à la gestion.' })
  }
  const id = String(getRouterParam(event, 'id') || '')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Identifiant manquant.' })

  let removed = false
  await withLock('expenses', async () => {
    const expenses = await loadExpenses()
    const next = expenses.filter((e: any) => e.id !== id)
    if (next.length !== expenses.length) {
      removed = true
      await saveExpenses(next)
    }
  })

  if (!removed) throw createError({ statusCode: 404, statusMessage: 'Dépense introuvable.' })
  return { success: true }
})
