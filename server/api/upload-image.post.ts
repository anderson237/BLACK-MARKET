import crypto from 'node:crypto'
import { saveImage, looksLikeImage } from '~~/server/utils/storage'
import { requireAuth, rateLimit } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  rateLimit(30, 60_000)(event)
  const body = await readBody(event)
  const imageBase64 = body?.imageBase64
  if (!imageBase64 || typeof imageBase64 !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Aucune image reçue (base64 manquant).' })
  }
  const base64Data = imageBase64.split(',').pop() || ''
  const input = Buffer.from(base64Data, 'base64')
  if (!input.length || input.length > 15 * 1024 * 1024) {
    throw createError({ statusCode: 400, statusMessage: 'Image invalide ou trop volumineuse (max 15 Mo).' })
  }
  if (!looksLikeImage(input)) {
    throw createError({ statusCode: 400, statusMessage: "Le fichier n'est pas une image valide (JPEG/PNG/GIF/WebP/BMP)." })
  }
  const id = crypto.randomBytes(8).toString('hex')
  await saveImage(id, input)
  return { success: true, url: `/api/img/${id}.jpg` }
})