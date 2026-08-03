import { findAccount, upsertAccount } from '~~/server/utils/storage'
import { hashPassword, signToken, rateLimit, SESSION_TTL_MS } from '~~/server/utils/auth'

const clean = (v: unknown, max = 200) => String(v ?? '').trim().slice(0, max)
const emailOf = (v: unknown) => String(v ?? '').trim().toLowerCase()

export default defineEventHandler(async (event) => {
  rateLimit(8, 60_000)(event)
  const body = await readBody(event)
  const mode = body?.mode === 'phone' ? 'phone' : 'email'

  if (mode === 'email') {
    const email = emailOf(body?.email)
    const password = String(body?.password || '')
    if (!email || !password) throw createError({ statusCode: 400, statusMessage: 'Email et mot de passe requis.' })
    const account = await findAccount({ email })
    if (!account || !account.passwordHash || !account.salt) {
      throw createError({ statusCode: 401, statusMessage: 'Email ou mot de passe incorrect.' })
    }
    const candidate = hashPassword(password, account.salt)
    if (candidate !== account.passwordHash) {
      throw createError({ statusCode: 401, statusMessage: 'Email ou mot de passe incorrect.' })
    }
    if (account.status === 'blocked') throw createError({ statusCode: 403, statusMessage: 'Compte suspendu.' })
    await upsertAccount({ ...account, lastLoginAt: new Date().toISOString() })
    const token = await signToken({
      email: account.email,
      name: account.name,
      userId: account.id,
      role: account.role,
      exp: Date.now() + SESSION_TTL_MS,
    })
    const { passwordHash, salt, ...pub } = account
    return { success: true, token, user: pub, expiresIn: SESSION_TTL_MS }
  }

  // phone + prefix mode
  const phone = clean(body?.phone, 20).replace(/[^0-9]/g, '')
  const phonePrefix = clean(body?.phonePrefix, 10)
  if (!phone) throw createError({ statusCode: 400, statusMessage: 'Numéro de téléphone requis.' })
  const account = await findAccount({ phone })
  if (!account) {
    throw createError({ statusCode: 401, statusMessage: 'Aucun compte trouvé avec ce numéro. Inscrivez-vous d\'abord.' })
  }
  if (account.status === 'blocked') throw createError({ statusCode: 403, statusMessage: 'Compte suspendu.' })
  await upsertAccount({
    ...account,
    phonePrefix: phonePrefix || account.phonePrefix,
    lastLoginAt: new Date().toISOString(),
  })
  const token = await signToken({
    email: account.email,
    name: account.name,
    userId: account.id,
    role: account.role,
    exp: Date.now() + SESSION_TTL_MS,
  })
  const { passwordHash, salt, ...pub } = account
  return { success: true, token, user: pub, expiresIn: SESSION_TTL_MS }
})