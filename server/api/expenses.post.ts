import { loadExpenses, saveExpenses, withLock } from '~~/server/utils/storage'
import { requireAuth } from '~~/server/utils/auth'
import { EXPENSE_CATEGORIES } from '../../data/expenseCategories'

const ALLOWED_ROLES = ['admin', 'editor', 'publisher']
const VALID_CATEGORIES = EXPENSE_CATEGORIES.map((c) => c.value)

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  if (!ALLOWED_ROLES.includes(String(session.role || ''))) {
    throw createError({ statusCode: 403, statusMessage: 'Accès réservé à la gestion.' })
  }
  const body = await readBody(event).catch(() => ({}))
  const label = String(body.label || '').trim().slice(0, 160)
  const category = VALID_CATEGORIES.includes(body.category) ? body.category : 'divers'
  const amountXof = Math.round(Number(body.amountXof) || 0)
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(body.date || '')) ? String(body.date) : new Date().toISOString().slice(0, 10)
  const note = String(body.note || '').trim().slice(0, 500)
  const paymentMethod = ['cash', 'momopay', 'orange', 'bank', 'other'].includes(body.paymentMethod) ? body.paymentMethod : 'cash'

  if (!label) throw createError({ statusCode: 400, statusMessage: 'Libellé obligatoire.' })
  if (amountXof <= 0) throw createError({ statusCode: 400, statusMessage: 'Montant invalide (doit être > 0).' })

  const id = String(body.id || `exp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`)
  const expense = {
    id,
    label,
    category,
    amountXof,
    date,
    note,
    paymentMethod,
    createdAt: String(body.createdAt || new Date().toISOString()),
  }

  await withLock('expenses', async () => {
    const expenses = await loadExpenses()
    const idx = expenses.findIndex((e: any) => e.id === id)
    if (idx >= 0) expenses[idx] = expense
    else expenses.unshift(expense)
    await saveExpenses(expenses)
  })

  return { success: true, expense }
})
