import crypto from 'node:crypto'
import { findAccount, upsertAccount, loadAccounts, loadUsers, SESSION_TTL_MS } from '~~/server/utils/storage'
import { requireAuth, signToken, rateLimit } from '~~/server/utils/auth'

const normalizeEmail = (e: unknown) => String(e ?? '').trim().toLowerCase()
const googleClientId = process.env.GOOGLE_CLIENT_ID || ''

export default defineEventHandler(async (event) => {
  rateLimit(10, 60_000)(event)
  const body = await readBody(event)
  const credential = typeof body?.credential === 'string' ? body.credential.trim() : ''
  if (!credential) throw createError({ statusCode: 400, statusMessage: 'Jeton Google manquant.' })

  const infoRes = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`,
    { signal: AbortSignal.timeout(15000) },
  )
  if (!infoRes.ok) throw createError({ statusCode: 401, statusMessage: 'Jeton Google invalide.' })
  const info: any = await infoRes.json()
  if (!info || info.error) throw createError({ statusCode: 401, statusMessage: 'Jeton Google invalide.' })

  if (googleClientId && info.aud && info.aud !== googleClientId) {
    throw createError({ statusCode: 401, statusMessage: 'Jeton émis pour une autre application.' })
  }
  if (info.email_verified !== 'true' && info.email_verified !== true) {
    throw createError({ statusCode: 401, statusMessage: 'Email non vérifié.' })
  }

  const email = normalizeEmail(info.email)
  const name = String(info.name || email)
  const picture = String(info.picture || '')

  let account = await findAccount({ email })

  // Anyone can sign in with Google (open registration). Admin is granted for
  // env-declared emails OR accounts listed in the admin panel's admin list OR
  // accounts whose stored role is already admin.
  const users = await loadUsers()
  const adminEmails = Array.from(new Set([
    ...(process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || 'elomopatrick.pn@gmail.com')
      .toLowerCase().split(',').map((s) => s.trim()).filter(Boolean),
    ...(users.admins || []).map((s) => String(s).toLowerCase()),
  ]))
  const isAdmin = adminEmails.includes(email) || (await loadAccounts()).some((a) => a.email === email && a.role === 'admin')

  if (!account) {
    account = {
      id: `usr_${crypto.randomBytes(8).toString('hex')}`,
      email,
      name,
      picture,
      provider: 'google',
      role: isAdmin ? 'admin' : 'user',
      status: 'active',
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    }
    await upsertAccount(account)
  } else {
    if (account.status === 'blocked') throw createError({ statusCode: 403, statusMessage: 'Compte suspendu.' })
    account = await upsertAccount({
      ...account,
      name: account.name || name,
      picture: account.picture || picture,
      lastLoginAt: new Date().toISOString(),
      role: isAdmin ? 'admin' : account.role,
    })
  }

  const token = await signToken({
    email: account.email,
    name: account.name,
    picture: account.picture,
    userId: account.id,
    role: account.role,
    exp: Date.now() + SESSION_TTL_MS,
  })
  const { passwordHash, salt, ...pub } = account
  return { success: true, token, user: pub, expiresIn: SESSION_TTL_MS }
})