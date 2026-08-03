import crypto from 'node:crypto'
import { saveVideo, looksLikeVideo } from '~~/server/utils/storage'
import { requireAuth, rateLimit } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  rateLimit(10, 60_000)(event)
  const body = await readBody(event)
  const videoBase64 = body?.videoBase64
  if (!videoBase64 || typeof videoBase64 !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Aucune vidéo reçue (base64 manquant).' })
  }
  const base64Data = videoBase64.split(',').pop() || ''
  const input = Buffer.from(base64Data, 'base64')
  if (!input.length || input.length > 60 * 1024 * 1024) {
    throw createError({ statusCode: 400, statusMessage: 'Vidéo invalide ou trop volumineuse (max 60 Mo).' })
  }
  if (!looksLikeVideo(input)) {
    throw createError({ statusCode: 400, statusMessage: "Le fichier n'est pas une vidéo valide (MP4/WebM/MOV)." })
  }
  const id = crypto.randomBytes(8).toString('hex')
  await saveVideo(id, input)
  return { success: true, url: `/api/vid/${id}.mp4` }
})