import { loadAllCarts, loadAccounts, loadReminders, saveReminder, type CartItem } from '~~/server/utils/storage'
import { sendEmail } from '~~/server/utils/email'

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

const SITE_URL = process.env.URL || process.env.SITE_URL || 'https://deeproots-importexport.netlify.app'
const BRAND = 'DEEP ROOTS LOGISTICS'
const CTA_ACCOUNT = `${SITE_URL}/compte`

/** Escape HTML for safe email rendering. */
function esc(v: unknown): string {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function fmtXof(n: number): string {
  return Number(n || 0).toLocaleString('fr-FR') + ' F CFA'
}

/**
 * Plain-text body — punchy, short lines, one clear action.
 */
export function renderReminderText(c: ReminderCandidate): string {
  const lines = c.items.map((i) => `• ${String(i.title || '').toUpperCase()}  →  ${i.quantity} × ${fmtXof(i.priceXof)}`)
  return [
    `${c.name}, TES ARTICLES T'ATTENDENT ENCORE. 🔥`,
    ``,
    `Tu as laissé ${c.itemsCount} article${c.itemsCount > 1 ? 's' : ''} dans ton panier chez ${BRAND} — et ils ne vont pas attendre éternellement.`,
    ``,
    ...lines,
    ``,
    `💰 TOTAL RÉSERVÉ POUR TOI : ${fmtXof(c.totalXof)}`,
    ``,
    `👉 Confirme en 30 secondes ici : ${CTA_ACCOUNT}`,
    ``,
    `Ton panier est toujours là. Ton stock, lui, ne l'est pas.`,
    `Quand c'est parti, c'est parti.`,
    ``,
    `À très vite,`,
    `L'équipe ${BRAND}`,
  ].join('\n')
}

/**
 * HTML body — dark streetwear look, red accent, product thumbnails and a
 * single big CTA. Used alongside the plain-text version.
 */
export function renderReminderHtml(c: ReminderCandidate): string {
  const rows = c.items.map((i) => {
    const img = i.imageUrl
      ? `<img src="${esc(i.imageUrl)}" alt="" width="64" height="64" style="width:64px;height:64px;border-radius:12px;object-fit:cover;border:1px solid #27272a;display:block;background:#16161d;" />`
      : `<div style="width:64px;height:64px;border-radius:12px;background:#16161d;border:1px solid #27272a;display:flex;align-items:center;justify-content:center;color:#ff2a2a;font-weight:800;font-family:Arial,sans-serif;">🛒</div>`
    return `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #1f1f27;vertical-align:middle;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>
            <td style="width:72px;vertical-align:middle;">${img}</td>
            <td style="vertical-align:middle;padding-left:12px;">
              <div style="color:#f4f4f5;font-family:Arial,sans-serif;font-size:14px;font-weight:700;line-height:1.3;">${esc(i.title)}</div>
              <div style="color:#a1a1aa;font-family:Arial,sans-serif;font-size:12px;margin-top:2px;">${i.quantity} × ${fmtXof(i.priceXof)}</div>
            </td>
          </tr></table>
        </td>
      </tr>`
  }).join('\n')

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#09090c;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#09090c;padding:24px 16px;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#0d0d14;border:1px solid #1f1f27;border-radius:20px;overflow:hidden;">
    <!-- Header -->
    <tr>
      <td style="padding:28px 28px 12px;text-align:center;border-bottom:2px solid #ff2a2a;">
        <div style="font-family:Verdana,Arial,sans-serif;font-size:20px;font-weight:900;letter-spacing:3px;color:#ffffff;">DEEP <span style="color:#ff2a2a;">ROOTS</span></div>
        <div style="font-family:Verdana,Arial,sans-serif;font-size:10px;letter-spacing:4px;color:#71717a;margin-top:4px;text-transform:uppercase;">Votre ancre mondiale</div>
      </td>
    </tr>
    <!-- Hero -->
    <tr>
      <td style="padding:26px 28px 8px;text-align:center;">
        <div style="font-family:Verdana,Arial,sans-serif;font-size:22px;font-weight:900;color:#ffffff;line-height:1.25;">${esc(c.name)}, tes articles <span style="color:#ff2a2a;">t'attendent encore</span> 🔥</div>
        <div style="font-family:Arial,sans-serif;font-size:14px;color:#a1a1aa;line-height:1.6;margin-top:10px;">
          Tu as laissé <strong style="color:#f4f4f5;">${c.itemsCount} article${c.itemsCount > 1 ? 's' : ''}</strong> dans ton panier.<br/>
          Ils sont <strong style="color:#ff2a2a;">réservés pour toi</strong> — mais pas pour toujours.
        </div>
      </td>
    </tr>
    <!-- Items -->
    <tr><td style="padding:12px 28px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${rows}
      </table>
    </td></tr>
    <!-- Total -->
    <tr>
      <td style="padding:16px 28px 4px;text-align:right;">
        <div style="font-family:Arial,sans-serif;font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:1px;">Total réservé pour toi</div>
        <div style="font-family:Verdana,Arial,sans-serif;font-size:26px;font-weight:900;color:#ff2a2a;margin-top:2px;">${fmtXof(c.totalXof)}</div>
      </td>
    </tr>
    <!-- CTA -->
    <tr>
      <td style="padding:20px 28px 10px;text-align:center;">
        <a href="${CTA_ACCOUNT}" style="display:inline-block;background:#ff2a2a;color:#ffffff;font-family:Verdana,Arial,sans-serif;font-size:15px;font-weight:900;letter-spacing:1px;text-decoration:none;padding:16px 36px;border-radius:12px;">CONFIRMER MA PRÉCOMMANDE →</a>
        <div style="font-family:Arial,sans-serif;font-size:12px;color:#71717a;margin-top:10px;">30 secondes. Ton panier t'attend sur ton compte.</div>
      </td>
    </tr>
    <!-- FOMO line -->
    <tr>
      <td style="padding:6px 28px 16px;text-align:center;">
        <div style="font-family:Arial,sans-serif;font-size:12px;color:#a1a1aa;line-height:1.5;border:1px dashed #27272a;border-radius:10px;padding:10px;">
          ⚠️ Ton stock, lui, ne t'attend pas. <strong style="color:#f4f4f5;">Quand c'est parti, c'est parti.</strong>
        </div>
      </td>
    </tr>
    <!-- Footer -->
    <tr>
      <td style="padding:18px 28px 24px;text-align:center;background:#09090c;border-top:1px solid #1f1f27;">
        <div style="font-family:Arial,sans-serif;font-size:11px;color:#52525b;line-height:1.6;">
          ${BRAND} — Import-export & précommandes WhatsApp<br/>
          <a href="${SITE_URL}" style="color:#ff2a2a;text-decoration:none;">${SITE_URL}</a>
        </div>
      </td>
    </tr>
  </table>
</td></tr>
</table>
</body>
</html>`
}

/** Send an email via Resend (no-op unless RESEND_API_KEY is present). */
/**
 * Run the reminder pass. Returns per-candidate status.
 */export async function runReminderPass(opts?: { abandonedHours?: number; cooldownHours?: number; dryRun?: boolean }): Promise<ReminderRunResult> {
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

    const subject = `🔥 ${c.name}, ${c.itemsCount} article${c.itemsCount > 1 ? 's' : ''} t'attend${c.itemsCount > 1 ? 'ent' : ''} encore — ${fmtXof(c.totalXof)}`
    if (dryRun) {
      await saveReminder({ userId: c.userId, reminderAt: new Date().toISOString(), status: 'dry-run', via: 'email', target: c.email, totalXof: c.totalXof })
      continue
    }
    const ok = await sendEmail(c.email, subject, renderReminderText(c), renderReminderHtml(c))
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
