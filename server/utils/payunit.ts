// ---------------------------------------------------------------------------
// PayUnit payment gateway client (server-only).
//
// Docs: https://developer.payunit.net/fr
//  - Hosted checkout: POST /api/gateway/checkout/initialize
//    (returns data.redirect = payment page, valid 15 minutes)
//  - Status:         GET  /api/gateway/checkout/status/{checkout_id}
//    (data.status: PENDING | FAILED | CANCELLED | SUCCESS)
//
// Every call authenticates with HTTP Basic (api_user:api_password), the
// application token (x-api-key) and the app mode (test|live). Credentials are
// read from runtimeConfig (env PAYUNIT_API_USER / PAYUNIT_API_PASSWORD /
// PAYUNIT_APP_TOKEN / PAYUNIT_MODE) and never leak to the client bundle.
// ---------------------------------------------------------------------------

const PAYUNIT_BASE_URL = 'https://gateway.payunit.net'

export function payunitConfigured(): boolean {
  const c = useRuntimeConfig().payunit
  return Boolean(c.apiUser && c.apiPassword && c.appToken)
}

export function payunitMode(): string {
  return useRuntimeConfig().payunit.mode || 'test'
}

function payunitHeaders(): Record<string, string> {
  const c = useRuntimeConfig().payunit
  const basic = Buffer.from(`${c.apiUser}:${c.apiPassword}`).toString('base64')
  return {
    'Content-Type': 'application/json',
    Authorization: `Basic ${basic}`,
    'x-api-key': c.appToken,
    mode: c.mode || 'test',
  }
}

export interface PayUnitItem {
  price_description: { unit_amount: number }
  product_description: { name: string; image_url: string; about_product?: string }
  quantity: number
}

export interface InitCheckoutParams {
  transaction_id: string
  total_amount: number
  currency: string
  success_url: string
  cancel_url: string
  notify_url?: string
  items: PayUnitItem[]
  payment_country?: string
}

export interface CheckoutInitResult {
  redirect: string
  checkoutId: string
}

/**
 * Initialize a hosted PayUnit checkout. Returns the payment page URL plus the
 * checkout id (last segment of the redirect URL) used to poll the status.
 */
export async function initPayunitCheckout(p: InitCheckoutParams): Promise<CheckoutInitResult> {
  if (!payunitConfigured()) {
    throw new Error('PayUnit n\u2019est pas configur\u00e9 (cl\u00e9s API manquantes).')
  }
  const res = await fetch(`${PAYUNIT_BASE_URL}/api/gateway/checkout/initialize`, {
    method: 'POST',
    headers: payunitHeaders(),
    body: JSON.stringify({
      mode: 'payment',
      currency: p.currency,
      transaction_id: p.transaction_id,
      total_amount: p.total_amount,
      success_url: p.success_url,
      cancel_url: p.cancel_url,
      notify_url: p.notify_url,
      items: p.items,
      meta: {
        phone_number_collection: true,
        address_collection: false,
      },
      ...(p.payment_country ? { payment_country: p.payment_country } : {}),
    }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json?.status !== 'SUCCESS' || !json?.data?.redirect) {
    console.error('[payunit] initialize failed:', res.status, JSON.stringify(json).slice(0, 500))
    throw new Error(json?.message || 'PayUnit n\u2019a pas pu initialiser le paiement.')
  }
  const redirect: string = json.data.redirect
  const checkoutId = redirect.split('/').filter(Boolean).pop() || ''
  return { redirect, checkoutId }
}

/**
 * Poll the status of a hosted checkout. Returns the raw `data` object whose
 * `status` is PENDING | FAILED | CANCELLED | SUCCESS.
 */
export async function getPayunitCheckoutStatus(checkoutId: string): Promise<any> {
  if (!payunitConfigured()) {
    throw new Error('PayUnit n\u2019est pas configur\u00e9 (cl\u00e9s API manquantes).')
  }
  const res = await fetch(`${PAYUNIT_BASE_URL}/api/gateway/checkout/status/${encodeURIComponent(checkoutId)}`, {
    method: 'GET',
    headers: payunitHeaders(),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json?.status !== 'SUCCESS' || !json?.data) {
    console.error('[payunit] status failed:', res.status, JSON.stringify(json).slice(0, 500))
    throw new Error(json?.message || 'Impossible de v\u00e9rifier le statut du paiement.')
  }
  return json.data
}
