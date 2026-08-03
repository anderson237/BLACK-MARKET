import { loadUsers, saveUsers } from '~~/server/utils/storage'
import { requireAuth } from '~~/server/utils/auth'

const ownerEmail = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || 'elomopatrick.pn@gmail.com')
  .toLowerCase()
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)[0]

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  if (session.role !== 'admin') throw createError({ statusCode: 403, statusMessage: 'Accès administrateur requis.' })
  const body = await readBody<{ admins: string[] }>(event)
  const users = await loadUsers()

  let admins: string[] = Array.isArray(body?.admins) ? body.admins : []
  admins = Array.from(new Set(admins.map((e) => e.toLowerCase().trim()).filter(Boolean)))

  if (session.email && session.email.toLowerCase() === ownerEmail) {
    admins = Array.from(new Set([ownerEmail, ...admins]))
  } else {
    admins = Array.from(new Set([ownerEmail, ...(users.admins || []), ...admins]))
  }

  users.admins = admins
  await saveUsers(users)

  return { success: true, admins }
})