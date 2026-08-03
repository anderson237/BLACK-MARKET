import { loadOrders } from '~~/server/utils/storage'
import { requireAuth } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const orders = await loadOrders()
  return { success: true, orders }
})