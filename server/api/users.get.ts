import { loadUsers, loadAccounts } from '~~/server/utils/storage'
import { requireAuth } from '~~/server/utils/auth'

const ownerEmail = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || 'elomopatrick.pn@gmail.com')
  .toLowerCase()
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)[0]

// Admin panel: every person who ever connected (Google, phone, email) shows up
// in the "connections" list, with their current role (user/editor/publisher).
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  if (session.role !== 'admin') throw createError({ statusCode: 403, statusMessage: 'Accès administrateur requis.' })
  const [users, accounts] = await Promise.all([loadUsers(), loadAccounts()])
  const adminEmails = Array.from(new Set([ownerEmail, ...(users.admins || [])]))

  const logins: any[] = (accounts || [])
    .map((a) => ({
      id: a.id,
      email: a.email,
      name: a.pseudo || a.name || a.email || 'Utilisateur',
      picture: a.picture || '',
      role: a.role || 'user',
      status: a.status,
      phone: a.phone || '',
      provider: a.provider,
      loggedInAt: a.lastLoginAt || a.createdAt,
    }))
    .sort((a, b) => new Date(b.loggedInAt || 0).getTime() - new Date(a.loggedInAt || 0).getTime())

  // Legacy logins (pre-accounts era) that don't match a current account.
  const seen = new Set(logins.map((l) => l.email))
  for (const lg of users.logins || []) {
    if (lg?.email && !seen.has(lg.email)) {
      logins.push({
        id: '',
        email: lg.email,
        name: lg.name || lg.email,
        picture: lg.picture || '',
        role: 'user',
        status: 'active',
        phone: '',
        provider: lg.provider || 'google',
        loggedInAt: lg.loggedInAt || lg.ts,
      })
      seen.add(lg.email)
    }
  }

  return {
    success: true,
    users: {
      owner: ownerEmail,
      admins: adminEmails,
      currentEmail: session.email || '',
      logins,
    },
  }
})
