import crypto from 'node:crypto'
import { addComment } from '~~/server/utils/storage'
import { requireAuth, rateLimit } from '~~/server/utils/auth'
import { publishSiteUpdate } from '~~/server/utils/realtime'

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  rateLimit(20, 60_000)(event)
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)
  const text = String(body?.text || '').replace(/<[^>]*>/g, '').slice(0, 1000).trim()
  if (!text) throw createError({ statusCode: 400, statusMessage: 'Commentaire vide.' })
  const userId = String(session.userId || body?.userId || '')
  const comment = await addComment({
    id: `cm_${crypto.randomBytes(8).toString('hex')}`,
    productId: id,
    userId,
    name: String(body?.name || 'Utilisateur').slice(0, 80),
    picture: body?.picture ? String(body.picture).slice(0, 8000) : undefined,
    role: String(session.role || 'user'),
    text,
    createdAt: new Date().toISOString(),
  })
  publishSiteUpdate('catalog')
  return { success: true, comment }
})