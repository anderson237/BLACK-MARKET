import crypto from 'node:crypto'
import { addComment } from '~~/server/utils/storage'
import { requireAuth, rateLimit } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  rateLimit(20, 60_000)(event)
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)
  const text = String(body?.text || '').replace(/<[^>]*>/g, '').slice(0, 1000).trim()
  if (!text) throw createError({ statusCode: 400, statusMessage: 'Commentaire vide.' })
  const comment = await addComment({
    id: `cm_${crypto.randomBytes(8).toString('hex')}`,
    productId: id,
    userId: String(body?.userId || ''),
    name: String(body?.name || 'Utilisateur').slice(0, 80),
    picture: body?.picture ? String(body.picture).slice(0, 8000) : undefined,
    text,
    createdAt: new Date().toISOString(),
  })
  return { success: true, comment }
})