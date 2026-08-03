import crypto from 'node:crypto'
import { findAccount, upsertAccount, type PublicAccount } from '~~/server/utils/storage'
import { hashPassword, signToken, rateLimit, SESSION_TTL_MS } from '~~/server/utils/auth'

const clean = (v: unknown, max = 200) => String(v ?? '').trim().slice(0, max)
const emailOf = (v: unknown) => String(v ?? '').trim().toLowerCase()

export default defineEventHandler(async (event) => {
  rateLimit(10, 60_000)(event)
  const body = await readBody(event)
  const mode = body?.mode === 'email' ? 'email' : 'phone'

  // Registration always collects the full customer record:
  // an email (for login/order updates) AND a WhatsApp phone number.
  const name = clean(body?.name, 80)
  const emailRaw = emailOf(body?.email)
  const password = String(body?.password || '')
  const phone = clean(body?.phone, 20).replace(/[^0-9]/g, '')
  const phonePrefix = clean(body?.phonePrefix, 10)
  const country = clean(body?.country, 60)

  // ---- validation ----
  if (emailRaw && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
    throw createError({ statusCode: 400, statusMessage: 'Email invalide.' })
  }
  if (!emailRaw) {
    throw createError({ statusCode: 400, statusMessage: 'Adresse email requise.' })
  }
  if (phone && phone.length < 6) {
    throw createError({ statusCode: 400, statusMessage: 'Numéro de téléphone invalide.' })
  }
  if (!phone) {
    throw createError({ statusCode: 400, statusMessage: 'Numéro WhatsApp requis.' })
  }
  if (password.length < 6) {
    throw createError({ statusCode: 400, statusMessage: 'Mot de passe : 6 caractères minimum.' })
  }

  // ---- uniqueness (email OR phone must identify the account) ----
  if (emailRaw) {
    const existing = await findAccount({ email: emailRaw })
    if (existing) throw createError({ statusCode: 409, statusMessage: 'Un compte existe déjà avec cet email.' })
  }
  if (phone) {
    const existing = await findAccount({ phone })
    if (existing) throw createError({ statusCode: 409, statusMessage: 'Un compte existe déjà avec ce numéro.' })
  }

  const salt = password ? crypto.randomBytes(16).toString('hex') : undefined

  const account: PublicAccount = {
    id: `usr_${crypto.randomBytes(8).toString('hex')}`,
    name,
    email: emailRaw,
    phone,
    phonePrefix: phonePrefix || undefined,
    country,
    provider: password ? 'password' : 'phone',
    passwordHash: password ? hashPassword(password, salt as string) : undefined,
    salt,
    role: 'user',
    status: 'active',
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  }
  await upsertAccount(account)
  const token = await signToken({
    email: account.email,
    name: account.name,
    userId: account.id,
    role: account.role,
    exp: Date.now() + SESSION_TTL_MS,
  })
  return { success: true, token, user: stripSecret(account), expiresIn: SESSION_TTL_MS }
})

function stripSecret(a: PublicAccount) {
  const { passwordHash, salt, ...pub } = a
  return pub
}