import { loadTreasury, saveTreasury, withLock } from '~~/server/utils/storage'
import { requireAuth } from '~~/server/utils/auth'

const ALLOWED_ROLES = ['admin', 'editor', 'publisher']

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  if (!ALLOWED_ROLES.includes(String(session.role || ''))) {
    throw createError({ statusCode: 403, statusMessage: 'Accès réservé à la gestion.' })
  }
  const body = await readBody(event).catch(() => ({}))
  const type = body.type === 'out' ? 'out' : 'in'
  const label = String(body.label || '').trim().slice(0, 160)
  const amountXof = Math.round(Number(body.amountXof) || 0)
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(body.date || '')) ? String(body.date) : new Date().toISOString().slice(0, 10)
  const method = ['cash', 'momopay', 'orange', 'bank', 'other'].includes(body.method) ? body.method : 'cash'
  const note = String(body.note || '').trim().slice(0, 500)

  if (!label) throw createError({ statusCode: 400, statusMessage: 'Libellé obligatoire.' })
  if (amountXof <= 0) throw createError({ statusCode: 400, statusMessage: 'Montant invalide (doit être > 0).' })

  const entry = {
    id: `tre_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    label,
    amountXof,
    date,
    method,
    note,
    createdAt: new Date().toISOString(),
  }

  await withLock('treasury', async () => {
    const data = await loadTreasury()
    data.entries.unshift(entry)
    await saveTreasury(data)
  })

  return { success: true, entry }
})
