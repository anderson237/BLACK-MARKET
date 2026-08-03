import { safeEqual, signToken, rateLimit, SESSION_TTL_MS } from '~~/server/utils/auth'

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
  if (safeEqual(password, adminPassword)) {
    const token = await signToken({ email: email || undefined, role: 'admin', exp: Date.now() + SESSION_TTL_MS })
    return { success: true, token, role: 'admin', expiresIn: SESSION_TTL_MS }
  }
  throw createError({ statusCode: 401, statusMessage: 'Clé d\'accès incorrecte.' })
})