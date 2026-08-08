import { requireAuth } from '~~/server/utils/auth'
import { upsertSupplierContact, type SupplierContact } from '~~/server/utils/storage'

// Admin import pipeline (ST-017): save / update the manually captured supplier
// contact (WeChat / WhatsApp / email / phone / site) for one imported product
// (platform + sourceId). Stored server-side in bm-supplier-contacts so the
// same product re-imported later comes back pre-filled.
// Body: { platform, sourceId, contact: { wechat?, email?, whatsapp?, phone?, website?, note? } }
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  if (session.role !== 'admin') throw createError({ statusCode: 403, statusMessage: 'Accès administrateur requis.' })
  const body = await readBody(event)
  const platform = String(body?.platform || '').trim()
  const sourceId = String(body?.sourceId || '').trim()
  if (!platform || !sourceId) throw createError({ statusCode: 400, statusMessage: 'Plateforme et identifiant source requis.' })

  const c = (body?.contact || {}) as Record<string, unknown>
  const contact: SupplierContact = {
    platform,
    sourceId,
    wechat: String(c.wechat || '').trim() || undefined,
    email: String(c.email || '').trim() || undefined,
    whatsapp: String(c.whatsapp || '').trim() || undefined,
    phone: String(c.phone || '').trim() || undefined,
    website: String(c.website || '').trim() || undefined,
    note: String(c.note || '').trim() || undefined,
    updatedAt: new Date().toISOString(),
  }

  const list = await upsertSupplierContact(contact)
  const saved = list.find((e) => e.platform === platform && e.sourceId === sourceId)
  return { success: true, contact: saved }
})
