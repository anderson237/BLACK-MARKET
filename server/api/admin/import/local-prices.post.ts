import crypto from 'node:crypto'
import { requireAuth } from '~~/server/utils/auth'
import { upsertLocalPrice, loadLocalPrices } from '~~/server/utils/storage'

// Admin local market price table (ST-017): upsert one entry.
// Body: { id?, label, match, priceXof, source? } — id auto-generated when absent.
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  if (session.role !== 'admin') throw createError({ statusCode: 403, statusMessage: 'Accès administrateur requis.' })
  const body = await readBody(event)
  const label = String(body?.label || '').trim()
  const match = String(body?.match || '').trim().toLowerCase()
  const priceXof = Number(body?.priceXof)
  if (!label || !match || !Number.isFinite(priceXof) || priceXof <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Libellé, mot-clé et prix CFA requis.' })
  }
  const id = String(body?.id || '').trim() || `lp_${crypto.randomBytes(4).toString('hex')}`
  const list = await upsertLocalPrice({
    id,
    label,
    match,
    priceXof: Math.round(priceXof),
    source: String(body?.source || '').trim() || undefined,
    updatedAt: new Date().toISOString(),
  })
  return { success: true, prices: list }
})
