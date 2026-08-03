import { findAccount, upsertAccount, type PublicAccount } from '~~/server/utils/storage'
import { requireAuth } from '~~/server/utils/auth'

const clean = (v: unknown, max = 200) => String(v ?? '').trim().slice(0, max)

// Update the connected client's own profile (pseudo, name, avatar, WhatsApp).
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  if (!session.userId) throw createError({ statusCode: 400, statusMessage: 'Compte introuvable.' })
  const account = await findAccount({ id: session.userId })
  if (!account) throw createError({ statusCode: 404, statusMessage: 'Compte introuvable.' })
  if (account.status === 'blocked') throw createError({ statusCode: 403, statusMessage: 'Compte suspendu.' })

  const body = await readBody(event).catch(() => ({}))
  const next: Partial<PublicAccount> = {}

  const name = clean(body?.name, 80)
  if (body?.name !== undefined) next.name = name

  const pseudo = clean(body?.pseudo, 40)
  if (body?.pseudo !== undefined) next.pseudo = pseudo

  const picture = clean(body?.picture, 8000)
  if (body?.picture !== undefined) next.picture = picture

  const phone = clean(body?.phone, 20).replace(/[^0-9]/g, '')
  if (body?.phone !== undefined) {
    if (phone && phone.length < 6) throw createError({ statusCode: 400, statusMessage: 'Numéro WhatsApp invalide.' })
    next.phone = phone
  }
  if (body?.phonePrefix !== undefined) next.phonePrefix = clean(body.phonePrefix, 10)
  if (body?.country !== undefined) next.country = clean(body.country, 60)

  if (next.phone && next.phone !== account.phone) {
    const other = await findAccount({ phone: next.phone })
    if (other && other.id !== account.id) {
      throw createError({ statusCode: 409, statusMessage: 'Ce numéro WhatsApp est déjà utilisé par un autre compte.' })
    }
  }

  const updated = await upsertAccount({ ...account, ...next })
  const { passwordHash, salt, ...pub } = updated
  return { success: true, user: pub }
})
