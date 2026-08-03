import { loadAccounts } from '~~/server/utils/storage'
import { requireAuth } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  if (session.role !== 'admin') throw createError({ statusCode: 403, statusMessage: 'Accès administrateur requis.' })
  const accounts = await loadAccounts()
  const customers = accounts.map((a: any) => {
    const { passwordHash, salt, ...pub } = a
    return pub
  })
  customers.sort((a: any, b: any) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime())
  return { success: true, customers }
})