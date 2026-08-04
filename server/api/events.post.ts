import { pushEvent, findAccount } from '~~/server/utils/storage'
import { rateLimit, clientIP, verifyToken, extractToken } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  rateLimit(300, 60_000)(event)
  const body = await readBody(event).catch(() => ({}))
  const type = ['view', 'click', 'like', 'unlike', 'share', 'copy', 'comment'].includes(body?.type)
    ? body.type
    : 'view'
  // Authoritative identity comes from the signed session when present,
  // otherwise fall back to whatever the client reported (anonymous views).
  const session = await verifyToken(extractToken(event))
  let userId = String(session?.userId || body?.userId || '')
  // Legacy tokens (no userId) still resolve to the real account via email.
  if (!userId && session?.email) {
    const account = await findAccount({ email: session.email })
    if (account) userId = account.id
  }
  await pushEvent({
    type,
    productId: body?.productId ? String(body.productId).slice(0, 120) : undefined,
    productTitle: body?.productTitle ? String(body.productTitle).slice(0, 300) : undefined,
    url: body?.url ? String(body.url).slice(0, 500) : undefined,
    ts: Date.now(),
    userId,
    ip: clientIP(event),
  })
  return { success: true }
})