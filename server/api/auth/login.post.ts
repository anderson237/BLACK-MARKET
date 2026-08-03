import crypto from 'node:crypto'
import { safeEqual, signToken, rateLimit, SESSION_TTL_MS } from '~~/server/utils/auth'
import { findAccount, upsertAccount, type PublicAccount } from '~~/server/utils/storage'

const adminEmails = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || 'elomopatrick.pn@gmail.com')
  .toLowerCase()
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const adminPassword = process.env.ADMIN_PASSWORD || 'ADMIN99'

export default defineEventHandler(async (event) => {
  rateLimit(6, 60_000)(event)
  const body = await readBody(event)
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body?.password === 'string' ? body.password.trim() : ''
  if (!password) throw createError({ statusCode: 400, statusMessage: 'Veuillez saisir la clé d\'accès.' })
  if (email && !adminEmails.includes(email)) {
    throw createError({ statusCode: 401, statusMessage: 'Email administrateur non reconnu.' })
  }
  if (!safeEqual(password, adminPassword)) {
    throw createError({ statusCode: 401, statusMessage: 'Clé d\'accès incorrecte.' })
  }

  // The admin login must resolve to a real client account so the connected
  // session carries a stable userId. Create the account on first login if the
  // admin email has not signed in through Google yet.
  const adminEmail = email || adminEmails[0] || 'elomopatrick.pn@gmail.com'
  let account = adminEmail ? await findAccount({ email: adminEmail }) : null
  if (!account) {
    account = {
      id: `usr_${crypto.randomBytes(8).toString('hex')}`,
      email: adminEmail,
      name: 'Administrateur',
      provider: 'password',
      role: 'admin',
      status: 'active',
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    }
  } else {
    account = await upsertAccount({ ...account, lastLoginAt: new Date().toISOString() })
  }
  const saved = await upsertAccount(account)

  const token = await signToken({
    email: saved.email,
    name: saved.name,
    picture: saved.picture,
    userId: saved.id,
    role: 'admin',
    exp: Date.now() + SESSION_TTL_MS,
  })
  const { passwordHash, salt, ...pub } = saved as PublicAccount
  return { success: true, token, role: 'admin', user: pub, expiresIn: SESSION_TTL_MS }
})