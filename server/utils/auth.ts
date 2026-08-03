import crypto from 'node:crypto'
import { getStore } from '@netlify/blobs'
import fs from 'node:fs'
import path from 'node:path'
import { isNetlifyRuntime, SESSION_TTL_MS } from './storage'

export { SESSION_TTL_MS }

// ---------------------------------------------------------------------------
// Shared Nitro auth utilities. Ported from the proven Express layer:
// stateless HMAC-signed bearer tokens with a persisted secret, per-IP rate
// limiting, constant-time comparison.
// ---------------------------------------------------------------------------

interface SessionPayload {
  email?: string
  name?: string
  picture?: string
  role?: 'admin' | 'user'
  userId?: string
  exp: number
}

async function getSessionSecret(): Promise<string> {
  const envSecret = process.env.SESSION_SECRET
  if (envSecret) return envSecret
  try {
    if (isNetlifyRuntime()) {
      const store = getStore({ name: 'bm-products' })
      const raw = await store.get('session-secret', { type: 'text' })
      if (raw) return raw
      const generated = crypto.randomBytes(32).toString('hex')
      await store.set('session-secret', generated)
      return generated
    }
    const file = path.join(process.cwd(), 'data', 'session-secret')
    try {
      const existing = await fs.promises.readFile(file, 'utf-8')
      if (existing.trim()) return existing.trim()
    } catch {}
    const generated = crypto.randomBytes(32).toString('hex')
    await fs.promises.mkdir(path.join(process.cwd(), 'data'), { recursive: true })
    await fs.promises.writeFile(file, generated, 'utf-8')
    return generated
  } catch {
    return process.env.ADMIN_PASSWORD || 'bm-dev-session-secret'
  }
}

let secretPromise: Promise<string> | null = null
function sessionSecret(): Promise<string> {
  if (!secretPromise) secretPromise = getSessionSecret()
  return secretPromise
}

export async function signToken(payload: Omit<SessionPayload, 'exp'> & { exp?: number }): Promise<string> {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: payload.exp || Date.now() + SESSION_TTL_MS })).toString('base64url')
  const secret = await sessionSecret()
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url')
  return `${body}.${sig}`
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const [body, sig] = token.split('.')
    if (!body || !sig) return null
    const secret = await sessionSecret()
    const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url')
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    if (!payload || typeof payload.exp !== 'number') return null
    return payload
  } catch {
    return null
  }
}

export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(String(a))
  const bufB = Buffer.from(String(b))
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

// ---- strategy: HMAC-sha256 with iterations to derive a password hash ----
export function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex')
}

export function randomSalt(): string {
  return crypto.randomBytes(16).toString('hex')
}

// ---- revoked tokens (per-instance best effort) ----
const revokedTokens = new Map<string, number>()

export async function requireAuth(event: any): Promise<SessionPayload> {
  const header = event.node.req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  const revokedAt = revokedTokens.get(token)
  if (revokedAt && revokedAt > Date.now()) revokeRemove(token)
  const session = await verifyToken(token)
  if (!session || session.exp < Date.now()) {
    throw createError({ statusCode: 401, statusMessage: 'Session invalide ou expirée. Veuillez vous reconnecter.' })
  }
  return session
}

function revokeRemove(token: string) {
  revokedTokens.delete(token)
}

export function revokeToken(token: string) {
  if (token) revokedTokens.set(token, Date.now() + SESSION_TTL_MS)
}

// ---- extract bearer token from event ----
export function extractToken(event: any): string {
  const header = event.node.req.headers.authorization || ''
  return header.startsWith('Bearer ') ? header.slice(7).trim() : ''
}

// ---- simple per-IP rate limiting ----
const rateBuckets = new Map<string, { count: number; resetAt: number }>()

export function clientIP(event: any): string {
  const h = event.node.req.headers['x-forwarded-for']
  if (typeof h === 'string' && h.length) return h.split(',')[0].trim()
  return event.node.req.socket?.remoteAddress || 'unknown'
}

export function rateLimit(maxRequests: number, windowMs: number) {
  return (event: any) => {
    const ip = clientIP(event)
    const now = Date.now()
    let bucket = rateBuckets.get(ip)
    if (!bucket || bucket.resetAt < now) {
      bucket = { count: 0, resetAt: now + windowMs }
      rateBuckets.set(ip, bucket)
    }
    bucket.count += 1
    if (bucket.count > maxRequests) {
      throw createError({ statusCode: 429, statusMessage: 'Trop de requêtes. Veuillez patienter quelques secondes.' })
    }
  }
}

// periodical flush
if (typeof setInterval === 'function') {
  setInterval(() => {
    const now = Date.now()
    for (const [ip, bucket] of rateBuckets) {
      if (bucket.resetAt < now) rateBuckets.delete(ip)
    }
  }, 60_000).unref?.()
}