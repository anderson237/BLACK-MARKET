import { loadTreasury, saveTreasury, withLock } from '~~/server/utils/storage'
import { requireAuth } from '~~/server/utils/auth'

const ALLOWED_ROLES = ['admin', 'editor', 'publisher']

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  if (!ALLOWED_ROLES.includes(String(session.role || ''))) {
    throw createError({ statusCode: 403, statusMessage: 'Accès réservé à la gestion.' })
  }
  const id = String(getRouterParam(event, 'id') || '')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Identifiant manquant.' })

  const body = await readBody(event).catch(() => ({}))
  const type = body.type === 'out' ? 'out' : 'in'
  const label = String(body.label || '').trim().slice(0, 160)
  const amountXof = Math.round(Number(body.amountXof) || 0)
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(body.date || '')) ? String(body.date) : new Date().toISOString().slice(0, 10)
  const method = ['cash', 'momopay', 'orange', 'bank', 'other'].includes(body.method) ? body.method : 'cash'
  const note = String(body.note || '').trim().slice(0, 500)

  if (!label) throw createError({ statusCode: 400, statusMessage: 'Libellé obligatoire.' })
  if (amountXof <= 0) throw createError({ statusCode: 400, statusMessage: 'Montant invalide (doit être > 0).' })

  let updated = false
  await withLock('treasury', async () => {
    const data = await loadTreasury()
    const entry = data.entries.find((e: any) => e.id === id)
    if (entry) {
      entry.type = type
      entry.label = label
      entry.amountXof = amountXof
      entry.date = date
      entry.method = method
      entry.note = note
      entry.updatedAt = new Date().toISOString()
      await saveTreasury(data)
      updated = true
    }
  })

  if (!updated) throw createError({ statusCode: 404, statusMessage: 'Mouvement introuvable.' })
  return { success: true }
})
