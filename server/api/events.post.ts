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
  // Client-side geo (from useGeo) is authoritative; fall back to the CDN
  // country header (Netlify/Cloudflare) when the browser didn't resolve one.
  let countryCode = body?.countryCode ? String(body.countryCode).slice(0, 4).toUpperCase() : ''
  if (!countryCode) {
    // CDN country headers: Netlify sets x-nf-request-country, Cloudflare sets
    // cf-ipcountry. Both are ISO 3166-1 alpha-2.
    const cf = event.node.req.headers['cf-ipcountry']
    const nf = event.node.req.headers['x-nf-request-country']
    const fromCdn = typeof cf === 'string' ? cf : typeof nf === 'string' ? nf : ''
    if (fromCdn) countryCode = fromCdn.toUpperCase().slice(0, 4)
  }
  await pushEvent({
    type,
    productId: body?.productId ? String(body.productId).slice(0, 120) : undefined,
    productTitle: body?.productTitle ? String(body.productTitle).slice(0, 300) : undefined,
    url: body?.url ? String(body.url).slice(0, 500) : undefined,
    ts: Date.now(),
    userId,
    ip: clientIP(event),
    country: body?.country ? String(body.country).slice(0, 100) : undefined,
    countryCode,
    city: body?.city ? String(body.city).slice(0, 120) : undefined,
    region: body?.region ? String(body.region).slice(0, 120) : undefined,
  })
  return { success: true }
})