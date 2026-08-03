import { revokeToken, extractToken } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  revokeToken(extractToken(event))
  return { success: true }
})