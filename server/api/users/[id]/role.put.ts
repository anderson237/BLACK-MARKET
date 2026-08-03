import { loadAccounts, saveAccounts } from '~~/server/utils/storage'
import { requireAuth } from '~~/server/utils/auth'

// Admin-only: elevate (or downgrade) a connected user's role to editor,
// publisher, or back to user. Admin status itself stays managed through the
// dedicated promote/demote flow.
const ALLOWED = ['user', 'editor', 'publisher']

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  if (session.role !== 'admin') throw createError({ statusCode: 403, statusMessage: 'Accès administrateur requis.' })
  const id = getRouterParam(event, 'id') || ''
  const body = await readBody(event).catch(() => ({}))
  const role = String(body?.role || '').toLowerCase()
  if (!ALLOWED.includes(role)) throw createError({ statusCode: 400, statusMessage: 'Rôle invalide.' })

  const accounts = await loadAccounts()
  const email = String(body?.email || '').toLowerCase()
  const idx = accounts.findIndex((a) => a.id === id || (email && a.email && a.email.toLowerCase() === email))
  if (idx < 0) throw createError({ statusCode: 404, statusMessage: 'Compte introuvable.' })

  accounts[idx] = { ...accounts[idx], role: role as any }
  await saveAccounts(accounts)

  const { passwordHash, salt, ...pub } = accounts[idx]
  return { success: true, user: pub }
})
