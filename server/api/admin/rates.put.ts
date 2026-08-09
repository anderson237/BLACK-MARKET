import { requireAuth } from '~~/server/utils/auth'
import { saveRates } from '~~/server/utils/rates'

// Admin: update the conversion rates (CFA / yuan / euro / dollar).
// Body: { cnyToXof?, eurToXof?, usdToXof? } — partial patch, each > 0.
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  if (session.role !== 'admin') throw createError({ statusCode: 403, statusMessage: 'Accès administrateur requis.' })
  const body = await readBody(event).catch(() => ({}))
  const patch: any = {}
  for (const key of ['cnyToXof', 'eurToXof', 'usdToXof'] as const) {
    if (body?.[key] !== undefined && body[key] !== null && body[key] !== '') {
      const n = Number(body[key])
      if (!Number.isFinite(n) || n <= 0) {
        throw createError({ statusCode: 400, statusMessage: `Taux invalide pour ${key}.` })
      }
      patch[key] = n
    }
  }
  const rates = await saveRates(patch)
  return { success: true, rates }
})
