import { requireAuth } from '~~/server/utils/auth'
import { clearExtensionDrafts, deleteExtensionDraft } from '~~/server/utils/storage'

// ST-020 — Suppression de drafts extension : un id précis (body { id }) ou
// tout vider (DELETE sans body). Retourne la liste restante.
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  if (session.role !== 'admin') throw createError({ statusCode: 403, statusMessage: 'Accès administrateur requis.' })
  let body: any = null
  try {
    body = await readBody(event)
  } catch {
    body = null
  }
  const id = String(body?.id || '').trim()
  if (id) return { drafts: await deleteExtensionDraft(id) }
  await clearExtensionDrafts()
  return { drafts: [] }
})
