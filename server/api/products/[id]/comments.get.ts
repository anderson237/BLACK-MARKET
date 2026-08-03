import { getComments } from '~~/server/utils/storage'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const comments = await getComments(id)
  return { success: true, comments }
})