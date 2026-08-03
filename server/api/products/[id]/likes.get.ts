import { getLikeCount } from '~~/server/utils/storage'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const count = await getLikeCount(id)
  return { success: true, count }
})