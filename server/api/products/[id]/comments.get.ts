import { getComments, getCommentCount } from '~~/server/utils/storage'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const comments = await getComments(id)
  const count = await getCommentCount(id)
  return { success: true, comments, count }
})