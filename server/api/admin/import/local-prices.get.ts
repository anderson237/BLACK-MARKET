import { requireAuth } from '~~/server/utils/auth'
import { loadLocalPrices } from '~~/server/utils/storage'

// Admin local market price table (ST-017): list entries. Used to display the
// third price (marché local) next to the yuan & CFA prices when a match exists.
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  if (session.role !== 'admin') throw createError({ statusCode: 403, statusMessage: 'Accès administrateur requis.' })
  const prices = await loadLocalPrices()
  return { success: true, prices }
})
