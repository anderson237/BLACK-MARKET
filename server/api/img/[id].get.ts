import { loadImage } from '~~/server/utils/storage'

export default defineEventHandler(async (event) => {
  const raw = getRouterParam(event, 'id') || ''
  const id = raw.replace(/\.jpg$/i, '')
  if (!id || !/^[a-f0-9]{16}$/i.test(id)) throw createError({ statusCode: 404, statusMessage: 'Image introuvable.' })
  const buffer = await loadImage(id)
  if (!buffer) throw createError({ statusCode: 404, statusMessage: 'Image introuvable.' })
  setResponseHeaders(event, {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'image/jpeg',
    'Cache-Control': 'public, max-age=86400',
  })
  return buffer
})