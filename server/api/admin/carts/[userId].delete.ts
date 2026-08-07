import { deleteCart, removePreorderThreadsFor } from '~~/server/utils/storage'
import { requireAuth } from '~~/server/utils/auth'

// Admin-only: permanently drop an abandoned (non-confirmed) basket together with
// its pre-order chat threads, so the merchant can clean up stale carts.
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  if (session.role !== 'admin') throw createError({ statusCode: 403, statusMessage: 'Accès administrateur requis.' })

  const userId = String(getRouterParam(event, 'userId') || '')
  if (!userId) throw createError({ statusCode: 400, statusMessage: 'Identifiant manquant.' })

  await deleteCart(userId)
  const threadsRemoved = await removePreorderThreadsFor(userId)

  return { success: true, threadsRemoved }
})
