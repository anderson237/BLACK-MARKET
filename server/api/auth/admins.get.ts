import { loadUsers } from '~~/server/utils/storage'

const adminEmails = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || 'elomopatrick.pn@gmail.com')
  .toLowerCase()
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

export default defineEventHandler(async () => {
  const users = await loadUsers()
  const allAdmins = Array.from(new Set([...adminEmails, ...users.admins]))
  return {
    success: true,
    admins: allAdmins,
    total: allAdmins.length,
  }
})