import { requireAuth } from '~~/server/utils/auth'

// Admin-only: send a single test email through the configured Resend provider,
// to validate RESEND_API_KEY / RESEND_FROM without touching any customer.
// Target defaults to the connected admin's email (in test mode with
// onboarding@resend.dev, Resend only allows sending to the account owner).
export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  if (session.role !== 'admin') throw createError({ statusCode: 403, statusMessage: 'Accès administrateur requis.' })

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { success: false, reason: 'RESEND_API_KEY non configurée (Netlify → Environment variables).' }

  const body = (await readBody(event).catch(() => ({}))) as { to?: string } | null
  const to = String(body?.to || '').trim() || String(session.email || '')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return { success: false, reason: `Adresse cible invalide : "${to}"` }
  }

  const from = process.env.RESEND_FROM || 'Deep Roots Logistics <no-reply@deeproots-importexport.netlify.app>'
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [to],
        subject: '✅ Test DEEP ROOTS — votre configuration email fonctionne',
        text: 'Ceci est un email de test envoyé depuis votre site DEEP ROOTS LOGISTICS.\n\nSi vous recevez ce message, la configuration Resend (RESEND_API_KEY / RESEND_FROM) fonctionne correctement.\n\n— L\'équipe DEEP ROOTS',
        html: `<!doctype html><html><body style="margin:0;background:#09090c;padding:24px;font-family:Verdana,Arial,sans-serif;">
          <div style="max-width:520px;margin:0 auto;background:#0d0d14;border:1px solid #1f1f27;border-radius:18px;overflow:hidden;">
            <div style="background:#ff2a2a;padding:18px 24px;font-size:15px;font-weight:900;letter-spacing:3px;color:#fff;">DEEP <span style="color:#000;">ROOTS</span> — TEST</div>
            <div style="padding:24px;color:#e4e4e7;font-size:14px;line-height:1.6;">
              <p style="margin:0 0 12px;font-weight:700;font-size:16px;">✅ Votre configuration email fonctionne !</p>
              <p style="margin:0 0 12px;">Ceci est un email de test envoyé depuis votre site. Si vous le recevez, <strong>RESEND_API_KEY</strong> et <strong>RESEND_FROM</strong> sont correctement configurés.</p>
              <p style="margin:0;color:#a1a1aa;">Envoyé vers : <strong style="color:#fff;">${String(to).replace(/[<>&]/g, '')}</strong><br/>Expéditeur : <strong style="color:#fff;">${String(from).replace(/[<>&]/g, '')}</strong></p>
            </div>
          </div></body></html>`,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok) return { success: true, to, from }
    const err = data?.message || data?.name || `Erreur Resend ${res.status}`
    return { success: false, reason: err, status: res.status, to, from }
  } catch (err: any) {
    return { success: false, reason: String(err?.message || err), to, from }
  }
})
