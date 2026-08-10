import { updateSupplier } from '~~/server/utils/storage'
import { requireAuth } from '~~/server/utils/auth'

// Admin: edit a supplier (ST-019).
// Params: id (router). Body: any editable field — name, category, country,
// platforms (string[]|csv), wechat, email, whatsapp, phone, website, note,
// manual? (boolean override). Unknown supplier -> 404.
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  if (session.role !== 'admin') throw createError({ statusCode: 403, statusMessage: 'Accès administrateur requis.' })
  const id = String(getRouterParam(event, 'id') || '')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Identifiant manquant.' })
  const body = await readBody(event).catch(() => ({}))

  try {
    const supplier = await updateSupplier(id, body)
    if (!supplier) throw createError({ statusCode: 404, statusMessage: 'Fournisseur introuvable.' })
    return { success: true, supplier }
  } catch (err: any) {
    if (err?.statusCode) throw err
    if (String(err?.message || '').includes('existe déjà') || String(err?.message || '').includes('ne peut pas être vide')) {
      throw createError({ statusCode: 409, statusMessage: err.message })
    }
    throw createError({ statusCode: 400, statusMessage: err?.message || 'Impossible de mettre à jour le fournisseur.' })
  }
})