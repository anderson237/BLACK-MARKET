import { loadUsers } from '~~/server/utils/storage'
import { requireAuth } from '~~/server/utils/auth'

const ownerEmail = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || 'elomopatrick.pn@gmail.com')
  .toLowerCase()
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)[0]

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  if (session.role !== 'admin') throw createError({ statusCode: 403, statusMessage: 'Accès administrateur requis.' })
  const users = await loadUsers()
  return {
    success: true,
    users: {
      owner: ownerEmail,
      admins: Array.from(new Set([ownerEmail, ...(users.admins || [])])),
      currentEmail: session.email || '',
      logins: (users.logins || [])
        .slice()
        .sort((a: any, b: any) => new Date(b?.loggedInAt || 0).getTime() - new Date(a?.loggedInAt || 0).getTime()),
    },
  }
})
