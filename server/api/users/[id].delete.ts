import { loadAccounts, saveAccounts, loadUsers, saveUsers, deleteCart, loadChat, saveChat } from '~~/server/utils/storage'
import { requireAuth } from '~~/server/utils/auth'

const ownerEmail = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || 'elomopatrick.pn@gmail.com')
  .toLowerCase()
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)[0]

// Admin panel: delete a customer account permanently. Works for EVERY provider
// (Google, password/email, phone) because the account is resolved by id or
// email and removed from the canonical account list. Also cleans up the legacy
// login record, the user's basket and their chat threads (preorder + general +
// order) for privacy.
//
// Orders are business records and are KEPT (they carry the customer name/phone
// denormalized); social comments/events remain too (they render as "Anonyme").
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  if (session.role !== 'admin') throw createError({ statusCode: 403, statusMessage: 'Accès administrateur requis.' })
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Identifiant de compte manquant.' })

  const accounts = await loadAccounts()
  const email = String(id).toLowerCase()
  const account = accounts.find((a) => a.id === id || (a.email && String(a.email).toLowerCase() === email))
  if (!account) throw createError({ statusCode: 404, statusMessage: 'Compte introuvable.' })

  const accountEmail = String(account.email || '').toLowerCase()
  if (accountEmail && accountEmail === ownerEmail) {
    throw createError({ statusCode: 400, statusMessage: 'Impossible de supprimer le compte propriétaire.' })
  }
  if (accountEmail && session.email && accountEmail === String(session.email).toLowerCase()) {
    throw createError({ statusCode: 400, statusMessage: 'Impossible de supprimer votre propre compte.' })
  }

  // 1) canonical account
  await saveAccounts(accounts.filter((a) => a.id !== account.id && String(a.email || '').toLowerCase() !== accountEmail))

  // 2) legacy users blob (logins/accounts from the pre-accounts era)
  const users = await loadUsers()
  users.logins = (users.logins || []).filter((l) => {
    if (l?.id && l.id === account.id) return false
    return !(accountEmail && String(l?.email || '').toLowerCase() === accountEmail)
  })
  users.accounts = (users.accounts || []).filter((a) => a?.id !== account.id && !(accountEmail && String(a?.email || '').toLowerCase() === accountEmail))
  await saveUsers(users)

  // 3) basket + 4) chat threads (privacy cleanup)
  await deleteCart(account.id)
  const threads = await loadChat()
  const kept = threads.filter((t) => t.userId !== account.id)
  if (kept.length !== threads.length) await saveChat(kept)

  return { success: true, deletedId: account.id, deletedEmail: account.email || '' }
})
