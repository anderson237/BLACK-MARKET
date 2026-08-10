import { requireAuth } from '~~/server/utils/auth'
import { loadExtensionDrafts } from '~~/server/utils/storage'

// ST-020 — Liste les drafts capturés par l'extension Chrome scraper
// fournisseurs (persistés par POST /api/admin/import/extension), pour que
// l'admin les prévisualise et les publie depuis la page Import.
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  if (session.role !== 'admin') throw createError({ statusCode: 403, statusMessage: 'Accès administrateur requis.' })
  return { drafts: await loadExtensionDrafts() }
})
