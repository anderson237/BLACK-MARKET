import { loadSettings } from '~~/server/utils/storage'

// Public read of non-sensitive site settings (used by the client to configure
// analytics before any gtag script loads). Only exposes what the front-end needs.
export default defineEventHandler(async () => {
  const settings = await loadSettings()
  return { settings }
})
