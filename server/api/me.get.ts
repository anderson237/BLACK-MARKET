import { findAccount } from '~~/server/utils/storage'
import { requireAuth } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  if (session.userId) {
    const account = await findAccount({ id: session.userId })
    if (account) {
      const { passwordHash, salt, ...pub } = account
      return { success: true, session: { role: account.role, userId: account.id }, user: pub }
    }
  }
  return {
    success: true,
    session: { email: session.email, role: session.role || 'user' },
    user: {
      email: session.email,
      name: session.name,
      picture: session.picture,
      role: session.role || 'user',
    },
  }
})