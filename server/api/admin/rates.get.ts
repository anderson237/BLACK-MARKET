import { requireAuth } from '~~/server/utils/auth'
import { loadRates, DEFAULT_RATES } from '~~/server/utils/rates'

// Admin: read the current conversion rates (CFA / yuan / euro / dollar).
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  if (session.role !== 'admin') throw createError({ statusCode: 403, statusMessage: 'Accès administrateur requis.' })
  const rates = await loadRates()
  return { success: true, rates, defaults: DEFAULT_RATES }
})
