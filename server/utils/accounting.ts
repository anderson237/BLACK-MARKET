import { RMB_TO_XOF_RATE, XOF_PER_EUR } from '../../src/lib/constants'

// ---------------------------------------------------------------------------
// Accounting helpers shared by /api/accounting, the expense CRUD and the CSV
// export. Revenue only counts orders the shop actually receives money for
// (processing = confirmed/paid, shipped, completed). Pending = preorder intent
// (not paid yet), cancelled = never paid.
// ---------------------------------------------------------------------------

export const REVENUE_STATUSES = ['processing', 'completed', 'shipped'] as const

export type RevenueStatus = (typeof REVENUE_STATUSES)[number]

export function isRevenueStatus(status: string): boolean {
  return (REVENUE_STATUSES as readonly string[]).includes(status)
}

/** Purchase cost in FCFA for one unit of a product.
 *  Uses prix d'achat fournisseur + transport (RMB) when present, else the
 *  legacy source price in RMB. */
export function productCostXof(p?: any): number {
  if (!p) return 0
  const purchase = Number(p.purchaseRmb) || 0
  const shipping = Number(p.shippingRmb) || 0
  const rmb = purchase > 0 ? purchase + shipping : Number(p.sourceRmb) || 0
  return Math.round(rmb * RMB_TO_XOF_RATE)
}

/** Suggested selling price in FCFA from cost + margin, rounded to 100. */
export function sellingPriceXof(purchaseRmb: number, shippingRmb: number, marginPercent: number): number {
  const total = (Number(purchaseRmb) || 0) + (Number(shippingRmb) || 0)
  if (total <= 0) return 0
  const raw = total * (1 + (Number(marginPercent) || 0) / 100) * RMB_TO_XOF_RATE
  return Math.max(0, Math.round(raw / 100) * 100)
}

export function sellingPriceEur(xof: number): number {
  return Math.round(xof / XOF_PER_EUR)
}

// ---- date helpers (all date math in local time) ----
export function dateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function monthKey(d: Date): string {
  return dateKey(d).slice(0, 7)
}

/** Monday-based start of the week for the given date. */
export function startOfWeek(d: Date): Date {
  const copy = new Date(d)
  const day = (copy.getDay() + 6) % 7 // 0 = Monday
  copy.setDate(copy.getDate() - day)
  copy.setHours(0, 0, 0, 0)
  return copy
}

export function sameDay(a: Date, b: Date): boolean {
  return dateKey(a) === dateKey(b)
}

export function sameWeek(a: Date, b: Date): boolean {
  return dateKey(startOfWeek(a)) === dateKey(startOfWeek(b))
}

export function sameMonth(a: Date, b: Date): boolean {
  return monthKey(a) === monthKey(b)
}

export function sameYear(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
}

export interface PeriodTotals {
  revenueXof: number
  costXof: number
  expensesXof: number
  orders: number
  grossProfitXof: number
  netProfitXof: number
  grossMarginPct: number
  netMarginPct: number
}

export function emptyPeriod(): PeriodTotals {
  return {
    revenueXof: 0,
    costXof: 0,
    expensesXof: 0,
    orders: 0,
    grossProfitXof: 0,
    netProfitXof: 0,
    grossMarginPct: 0,
    netMarginPct: 0,
  }
}

export function finalizePeriod(p: PeriodTotals): PeriodTotals {
  p.grossProfitXof = p.revenueXof - p.costXof
  p.netProfitXof = p.revenueXof - p.costXof - p.expensesXof
  p.grossMarginPct = p.revenueXof > 0 ? Math.round((p.grossProfitXof / p.revenueXof) * 1000) / 10 : 0
  p.netMarginPct = p.revenueXof > 0 ? Math.round((p.netProfitXof / p.revenueXof) * 1000) / 10 : 0
  return p
}

export interface RevenueRow {
  order: any
  product: any
  revenueXof: number
  costXof: number
}

/** Flatten paid orders into revenue rows carrying their estimated COGS. */
export function revenueRows(orders: any[], products: any[]): RevenueRow[] {
  const byId = new Map(products.map((p) => [p.id, p]))
  const rows: RevenueRow[] = []
  for (const o of orders) {
    if (!isRevenueStatus(String(o.status || ''))) continue
    const qty = Math.max(1, Number(o.quantity) || 1)
    const price = Number(o.priceXof) || 0
    const product = byId.get(String(o.productId))
    rows.push({
      order: o,
      product,
      revenueXof: price * qty,
      costXof: productCostXof(product) * qty,
    })
  }
  return rows
}

/** Sum revenue/cost/orders for rows whose order falls in the period. */
export function totalsFor(rows: RevenueRow[], expenses: any[], date: Date, match: (a: Date, b: Date) => boolean): PeriodTotals {
  const p = emptyPeriod()
  for (const row of rows) {
    if (!match(new Date(row.order.createdAt || 0), date)) continue
    p.revenueXof += row.revenueXof
    p.costXof += row.costXof
    p.orders += 1
  }
  for (const e of expenses) {
    if (!match(new Date(`${e.date || ''}T12:00:00`), date)) continue
    p.expensesXof += Number(e.amountXof) || 0
  }
  return finalizePeriod(p)
}

export function fmtMonth(d: Date): string {
  return d.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })
}

export function fmtDay(d: Date): string {
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

/** Last `n` months as { key: 'YYYY-MM', label } ascending. */
export function lastNMonths(n: number, now = new Date()): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    out.push({ key: monthKey(d), label: fmtMonth(d) })
  }
  return out
}

/** Last `n` days as { key: 'YYYY-MM-DD', label } ascending. */
export function lastNDays(n: number, now = new Date()): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    out.push({ key: dateKey(d), label: fmtDay(d) })
  }
  return out
}

// ---- hypothèses KPI (données saisies par l'admin, pas mesurables sinon) ----
export interface KpiSettings {
  adsMonthlyXof: number
  feesPct: number
  returnsPct: number
  shippingCostXof: number
  fixedCostsMonthlyXof: number
  avgCustomerLifespanMonths: number
}

export const DEFAULT_KPI_SETTINGS: KpiSettings = {
  adsMonthlyXof: 0,
  feesPct: 3,
  returnsPct: 5,
  shippingCostXof: 1500,
  fixedCostsMonthlyXof: 0,
  avgCustomerLifespanMonths: 12,
}

export function normalizeKpiSettings(raw: any): KpiSettings {
  const s = raw || {}
  return {
    adsMonthlyXof: Number(s.adsMonthlyXof) || 0,
    feesPct: Number(s.feesPct) >= 0 ? Number(s.feesPct) : DEFAULT_KPI_SETTINGS.feesPct,
    returnsPct: Number(s.returnsPct) >= 0 ? Number(s.returnsPct) : DEFAULT_KPI_SETTINGS.returnsPct,
    shippingCostXof: Number(s.shippingCostXof) >= 0 ? Number(s.shippingCostXof) : DEFAULT_KPI_SETTINGS.shippingCostXof,
    fixedCostsMonthlyXof: Number(s.fixedCostsMonthlyXof) || 0,
    avgCustomerLifespanMonths: Math.max(1, Number(s.avgCustomerLifespanMonths) || 12),
  }
}

/** Nombre de mois calendaires représenté par un bucket KPI. */
export function periodMonths(key: string): number {
  switch (key) {
    case 'today':
      return 1 / 30
    case 'week':
      return 1 / 4.33
    case 'year':
      return 12
    default:
      return 1
  }
}
