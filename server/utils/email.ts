// Shared transactional email helper (Resend). Reused by the abandoned-cart
// reminder engine and the admin "new order confirmed" notification.

export async function sendEmail(to: string, subject: string, text: string, html: string): Promise<boolean> {
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
        html,
      }),
    })
    return res.ok
  } catch (err) {
    console.error('[email] Resend failed:', err)
    return false
  }
}
