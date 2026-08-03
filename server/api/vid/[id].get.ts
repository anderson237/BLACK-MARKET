import { loadVideo } from '~~/server/utils/storage'

export default defineEventHandler(async (event) => {
  const raw = getRouterParam(event, 'id') || ''
  const id = raw.replace(/\.mp4$/i, '')
  if (!id || !/^[a-f0-9]{16}$/i.test(id)) throw createError({ statusCode: 404, statusMessage: 'Vidée introuvable.' })
  const buffer = await loadVideo(id)
  if (!buffer) throw createError({ statusCode: 404, statusMessage: 'Vidée introuvable.' })
  const isWebM = buffer.length > 4 && buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3
  setResponseHeaders(event, {
    'Content-Type': isWebM ? 'video/webm' : 'video/mp4',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=86400',
  })
  return buffer
})