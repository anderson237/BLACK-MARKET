import { loadAllCarts, loadAccounts, loadReminders, saveReminder, type CartItem } from '~~/server/utils/storage'

/**
 * Abandoned-cart reminder engine.
 *
 * No email provider is configured out of the box (the shop is WhatsApp-first),
 * so by default the run is a *dry-run*: it computes who would be reminded and
 * records a `dry-run` reminder entry. As soon as `RESEND_API_KEY` is set in the
 * Netlify environment, real reminder emails are sent via Resend and recorded
 * with status `sent`.
 */

const DEFAULT_ABANDONED_HOURS = 48
const DEFAULT_COOLDOWN_HOURS = 72 // don't re-remind someone more than every 3 days

export interface ReminderCandidate {
  userId: string
  name: string
  email: string
  phone: string
  country: string
  items: CartItem[]
  itemsCount: number
  totalXof: number
  lastAdded: string
  hoursSinceLastAdded: number
  lastReminderAt: string
}

export interface ReminderRunResult {
  dryRun: boolean
  candidates: ReminderCandidate[]
  sent: number
  skippedCooldown: number
  skippedNoContact: number
  date: string
}

function hoursBetween(iso: string, now: number): number {
  const t = new Date(iso).getTime()
  if (!t) return Number.POSITIVE_INFINITY
  return (now - t) / 36e5
}

function lastAddedOf(items: CartItem[]): string {
  if (!items.length) return ''
  return new Date(Math.max(...items.map((i) => new Date(i.addedAt || 0).getTime()))).toISOString()
}

/**
 * Scan every basket and select the ones that have been idle longer than
 * `abandonedHours` and whose owner has not been reminded within `cooldownHours`.
 */
export async function findAbandonedCarts(opts?: { abandonedHours?: number; cooldownHours?: number }): Promise<ReminderCandidate[]> {
  const abandonedHours = opts?.abandonedHours ?? DEFAULT_ABANDONED_HOURS
  const cooldownHours = opts?.cooldownHours ?? DEFAULT_COOLDOWN_HOURS
  const now = Date.now()

  const [carts, accounts, reminders] = await Promise.all([loadAllCarts(), loadAccounts(), loadReminders()])
  const byId = new Map((accounts || []).map((a) => [a.id, a]))
  const lastReminder = new Map(reminders.map((r) => [r.userId, new Date(r.reminderAt).getTime()]))

  const candidates: ReminderCandidate[] = []
  for (const [userId, items] of Object.entries(carts || {})) {
    const list: CartItem[] = Array.isArray(items) ? items : []
    if (!list.length) continue
    const lastAdded = lastAddedOf(list)
    const hours = hoursBetween(lastAdded, now)
    if (hours < abandonedHours) continue

    const acc = byId.get(userId)
    const prev = lastReminder.get(userId)
    if (prev && (now - prev) / 36e5 < cooldownHours) continue

    const totalXof = list.reduce((s, c) => s + (Number(c.priceXof) || 0) * (Number(c.quantity) || 1), 0)
    const itemsCount = list.reduce((s, c) => s + (Number(c.quantity) || 1), 0)
    candidates.push({
      userId,
      name: acc?.pseudo || acc?.name || acc?.email || 'Client',
      email: acc?.email || '',
      phone: acc?.phone || '',
      country: acc?.country || '',
      items: list,
      itemsCount,
      totalXof,
      lastAdded,
      hoursSinceLastAdded: Math.round(hours),
      lastReminderAt: prev ? new Date(prev).toISOString() : '',
    })
  }

  // Most abandoned first.
  return candidates.sort((a, b) => b.hoursSinceLastAdded - a.hoursSinceLastAdded)
}

/** Render the reminder email body (plain text, WhatsApp-friendly). */
export function renderReminderText(c: ReminderCandidate): string {
  const lines = c.items.map((i) => `• ${String(i.title || '').toUpperCase()} — ${i.quantity} × ${Number(i.priceXof).toLocaleString('fr-FR')} F CFA`)
  return [
    `Bonjour ${c.name},`,
    ``,
    `Vous avez laissé des articles dans votre panier sur Deep Roots Logistics sans confirmer votre précommande.`,
    ``,
    ...lines,
    ``,
    `💰 Total : ${c.totalXof.toLocaleString('fr-FR')} F CFA`,
    ``,
    `Connectez-vous à votre compte pour confirmer, ou répondez simplement à ce message.`,
    `Votre commande est réservée — ne la laissez pas vous échapper !`,
    ``,
    `À très vite,`,
    `L'équipe Deep Roots Logistics`,
  ].join('\n')
}

/** Send an email via Resend (no-op unless RESEND_API_KEY is present). */
async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return false
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || 'Deep Roots Logistics <no-reply@deeproots-importexport.netlify.app>',
        to: [to],
        subject,
        text,
      }),
    })
    return res.ok
  } catch (err) {
    console.error('[reminder] Resend failed:', err)
    return false
  }
}

/** Run the reminder pass. Returns per-candidate status. */
export async function runReminderPass(opts?: { abandonedHours?: number; cooldownHours?: number; dryRun?: boolean }): Promise<ReminderRunResult> {
  const candidates = await findAbandonedCarts(opts)
  // Force dry-run unless the operator explicitly enables sending AND a key exists.
  const dryRun = opts?.dryRun === false ? false : (!process.env.RESEND_API_KEY || opts?.dryRun === true)
  let sent = 0
  let skippedNoContact = 0
  let skippedCooldown = 0

  for (const c of candidates) {
    // Skip users without an email (no contact channel for automated email).
    if (!c.email) {
      skippedNoContact++
      await saveReminder({ userId: c.userId, reminderAt: new Date().toISOString(), status: 'no-contact', via: 'none', target: c.phone || c.email, totalXof: c.totalXof })
      continue
    }
    if (c.lastReminderAt) {
      skippedCooldown++
      continue
    }

    const subject = `Vos articles vous attendent chez Deep Roots — ${c.itemsCount} article${c.itemsCount > 1 ? 's' : ''}`
    if (dryRun) {
      await saveReminder({ userId: c.userId, reminderAt: new Date().toISOString(), status: 'dry-run', via: 'email', target: c.email, totalXof: c.totalXof })
      continue
    }
    const ok = await sendEmail(c.email, subject, renderReminderText(c))
    if (ok) {
      sent++
      await saveReminder({ userId: c.userId, reminderAt: new Date().toISOString(), status: 'sent', via: 'email', target: c.email, totalXof: c.totalXof })
    } else {
      skippedNoContact++
    }
  }

  return {
    dryRun,
    candidates,
    sent,
    skippedCooldown,
    skippedNoContact,
    date: new Date().toISOString(),
  }
}
