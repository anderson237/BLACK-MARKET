import { createSupplier } from '~~/server/utils/storage'
import { requireAuth } from '~~/server/utils/auth'

// Admin: manually create a supplier (ST-019).
// Body: { name (required), category?, country?, platforms? (string[]|csv),
//         wechat?, email?, whatsapp?, phone?, website?, note? }
// Created suppliers are flagged manual:true (distinct from auto capture).
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  if (session.role !== 'admin') throw createError({ statusCode: 403, statusMessage: 'Accès administrateur requis.' })
  const body = await readBody(event).catch(() => ({}))

  const name = String(body?.name || '').trim()
  if (!name) throw createError({ statusCode: 400, statusMessage: 'Le nom du fournisseur est requis.' })

  try {
    const supplier = await createSupplier({ name, ...body })
    return { success: true, supplier }
  } catch (err: any) {
    if (err?.statusCode) throw err
    if (String(err?.message || '').includes('existe déjà')) {
      throw createError({ statusCode: 409, statusMessage: err.message })
    }
    throw createError({ statusCode: 400, statusMessage: err?.message || 'Impossible de créer le fournisseur.' })
  }
})