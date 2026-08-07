import { runReminderPass, findAbandonedCarts } from '~~/server/utils/reminders'
import { requireAuth } from '~~/server/utils/auth'

/**
 * Trigger the abandoned-cart reminder pass.
 *
 * Two authorized callers:
 *  - An authenticated admin (manual "Run now" from the admin UI).
 *  - The Netlify Scheduled Function (external cron) via header `x-task-secret`
 *    matching `runtimeConfig.taskSecret`.
 */
export default defineEventHandler(async (event) => {
  // External scheduler: check the shared secret.
  const headerSecret = String(event.headers.get('x-task-secret') || '')
  const config = useRuntimeConfig()
  const taskSecret = String(config.taskSecret || '')
  let authed = false
  if (taskSecret && headerSecret && headerSecret === taskSecret) {
    authed = true
  } else {
    try {
      const session = await requireAuth(event)
      if (session.role === 'admin') authed = true
    } catch {
      authed = false
    }
  }
  if (!authed) throw createError({ statusCode: 401, statusMessage: 'Non autorisé.' })

  const body = (await readBody(event).catch(() => ({}))) as { dryRun?: boolean; abandonedHours?: number; cooldownHours?: number } | null
  const abandonedHours = Number(body?.abandonedHours)
  const cooldownHours = Number(body?.cooldownHours)
  const result = await runReminderPass({
    abandonedHours: Number.isFinite(abandonedHours) ? abandonedHours : undefined,
    cooldownHours: Number.isFinite(cooldownHours) ? cooldownHours : undefined,
    dryRun: body?.dryRun,
  })

  return { success: true, ...result }
})
