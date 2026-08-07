import { useState } from '#imports'

export type CurrencyCode = 'XOF' | 'EUR' | 'USD'

interface CurrencyMeta {
  code: CurrencyCode
  symbol: string
  /** Multiplication factor applied to a XOF amount to get this currency. */
  factor: number
  /** Number of decimals to display. */
  decimals: number
}

/**
 * Global, SSR-safe currency state. Defaults to the site-configured currency
 * loaded from /api/settings; the visitor may override it locally (persisted in
 * localStorage so the choice survives navigation/refresh). XOF is the canonical
 * stored unit — every price in the catalog is stored in XOF and converted on
 * display only, never written back.
 */
const CURRENCIES: Record<CurrencyCode, CurrencyMeta> = {
  XOF: { code: 'XOF', symbol: 'F CFA', factor: 1, decimals: 0 },
  EUR: { code: 'EUR', symbol: '€', factor: 655.957, decimals: 0 },
  USD: { code: 'USD', symbol: '$', factor: 600, decimals: 0 },
}

const STORAGE_KEY = 'bm_currency_v1'
const OPTIONS: CurrencyCode[] = ['XOF', 'EUR', 'USD']

function isValid(code: unknown): code is CurrencyCode {
  return code === 'XOF' || code === 'EUR' || code === 'USD'
}

/** Formats a XOF amount in the requested currency (default XOF). */
export function formatCurrency(amountXof: number, code: CurrencyCode = 'XOF'): string {
  const m = CURRENCIES[code] || CURRENCIES.XOF
  const value = (Number(amountXof) || 0) / m.factor
  return (
    value.toLocaleString('fr-FR', {
      minimumFractionDigits: m.decimals,
      maximumFractionDigits: m.decimals,
    }) + ' ' + m.symbol
  )
}

/**
 * Global composable. Call it in any component; the reactive state is shared
 * app-wide through useState (same SSR-safe ref across all consumers), so the
 * active currency changes everywhere at once.
 */
export function useCurrency() {
  const code = useState<CurrencyCode>('bm-currency-code', () => 'XOF')
  const ready = useState<boolean>('bm-currency-ready', () => false)

  async function load() {
    if (ready.value) return
    let next: CurrencyCode = 'XOF'

    // 1) Visitor override (highest priority, persisted locally)
    if (import.meta.client) {
      try {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved && isValid(saved)) next = saved
      } catch {
        /* ignore */
      }
    }

    // 2) Site default (from server settings) only when no local override exists
    const hasLocal = import.meta.client ? !!localStorage.getItem(STORAGE_KEY) : false
    if (!hasLocal) {
      try {
        const res: any = await $fetch('/api/settings', { headers: { Accept: 'application/json' } })
        const cur = String(res?.settings?.currency || '').toUpperCase()
        if (isValid(cur)) next = cur
      } catch {
        /* keep XOF */
      }
    }

    code.value = next
    ready.value = true
  }

  function set(c: CurrencyCode) {
    code.value = c
    if (import.meta.client) {
      try {
        localStorage.setItem(STORAGE_KEY, c)
      } catch {
        /* ignore */
      }
    }
  }

  function meta(): CurrencyMeta {
    return CURRENCIES[code.value] || CURRENCIES.XOF
  }

  /** Convert a XOF amount into the currently active display currency. */
  function convert(amountXof: number): number {
    return (Number(amountXof) || 0) / meta().factor
  }

  /** Format a XOF amount in the currently active display currency. */
  function format(amountXof: number): string {
    return formatCurrency(amountXof, code.value)
  }

  return { code, ready, load, set, options: () => OPTIONS.map((c) => CURRENCIES[c]), meta, convert, format }
}
