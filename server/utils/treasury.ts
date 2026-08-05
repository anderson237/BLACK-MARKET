import { loadOrders, loadProducts, loadExpenses, loadTreasury } from './storage'
import { revenueRows, dateKey, lastNDays, lastNMonths } from './accounting'

// ---------------------------------------------------------------------------
// Trésorerie (cash ledger). Every movement that touches the cash box:
//   + entrées  = CA des commandes payées (auto) + mouvements manuels entrant
//   − sorties  = toutes les dépenses (auto, dont achat de marchandise) + mouvements manuels sortant
// Solde courant = solde initial + Σ entrées − Σ sorties.
// ---------------------------------------------------------------------------

export interface TreasuryMovement {
  id: string
  date: string
  label: string
  amountXof: number
  type: 'in' | 'out'
  source: 'orders' | 'expense' | 'manual'
  method: string
  category?: string
  note?: string
  createdAt: string
  balanceXof?: number
}

export interface TreasurySnapshot {
  soldeInitialXof: number
  soldeCourantXof: number
  totalInXof: number
  totalOutXof: number
  salesXof: number
  manualInXof: number
  expensesXof: number
  manualOutXof: number
  movements: TreasuryMovement[]
  daily: { key: string; label: string; balanceXof: number; inXof: number; outXof: number }[]
  monthly: { key: string; label: string; balanceXof: number; inXof: number; outXof: number }[]
  entries: any[]
}

export async function computeTreasury(): Promise<TreasurySnapshot> {
  const [productsRaw, orders, expenses, treasury] = await Promise.all([loadProducts(), loadOrders(), loadExpenses(), loadTreasury()])
  const products = productsRaw.filter((p: any) => !p.deleted)
  const rows = revenueRows(orders, products)
  const initial = Number(treasury.settings?.initialBalanceXof) || 0
  const now = new Date()

  const movements: TreasuryMovement[] = []

  // + commandes payées, agrégées par jour
  const salesByDay = new Map<string, number>()
  for (const row of rows) {
    const key = dateKey(new Date(row.order.createdAt || 0))
    salesByDay.set(key, (salesByDay.get(key) || 0) + row.revenueXof)
  }
  for (const [day, total] of salesByDay) {
    movements.push({
      id: `ord_${day}`,
      date: day,
      label: 'Ventes (commandes payées)',
      amountXof: total,
      type: 'in',
      source: 'orders',
      method: 'cash',
      createdAt: `${day}T12:00:00.000Z`,
    })
  }

  // − dépenses (toutes sortent de la caisse, y compris achat de marchandise)
  for (const e of expenses) {
    movements.push({
      id: `exp_${e.id}`,
      date: String(e.date || ''),
      label: String(e.label || 'Dépense'),
      amountXof: -(Number(e.amountXof) || 0),
      type: 'out',
      source: 'expense',
      method: String(e.paymentMethod || 'cash'),
      category: String(e.category || 'divers'),
      note: String(e.note || ''),
      createdAt: String(e.createdAt || new Date().toISOString()),
    })
  }

  // ± mouvements manuels (apports, recettes, retraits…)
  for (const ent of treasury.entries) {
    const amount = Number(ent.amountXof) || 0
    const isIn = ent.type === 'in'
    movements.push({
      id: `man_${ent.id}`,
      date: String(ent.date || ''),
      label: String(ent.label || (isIn ? 'Entrée' : 'Sortie')),
      amountXof: isIn ? amount : -amount,
      type: isIn ? 'in' : 'out',
      source: 'manual',
      method: String(ent.method || 'cash'),
      note: String(ent.note || ''),
      createdAt: String(ent.createdAt || new Date().toISOString()),
    })
  }

  // running balance (asc chronological, then by createdAt)
  movements.sort((a, b) => (a.date === b.date ? a.createdAt.localeCompare(b.createdAt) : a.date < b.date ? -1 : 1))
  let balance = initial
  for (const m of movements) {
    balance += m.amountXof
    m.balanceXof = balance
  }

  const totalIn = movements.reduce((s, m) => s + Math.max(0, m.amountXof), 0)
  const totalOut = movements.reduce((s, m) => s + Math.max(0, -m.amountXof), 0)
  const salesXof = movements.filter((m) => m.source === 'orders').reduce((s, m) => s + m.amountXof, 0)
  const manualInXof = movements.filter((m) => m.source === 'manual' && m.type === 'in').reduce((s, m) => s + m.amountXof, 0)
  const expensesXof = movements.filter((m) => m.source === 'expense').reduce((s, m) => s + Math.abs(m.amountXof), 0)
  const manualOutXof = movements.filter((m) => m.source === 'manual' && m.type === 'out').reduce((s, m) => s + Math.abs(m.amountXof), 0)

  // end-of-day balance per day (for series)
  const byDay = new Map<string, { inXof: number; outXof: number; balanceXof: number }>()
  let run = initial
  for (const m of movements) {
    const cur = byDay.get(m.date) || { inXof: 0, outXof: 0, balanceXof: run }
    if (m.amountXof >= 0) cur.inXof += m.amountXof
    else cur.outXof += Math.abs(m.amountXof)
    run += m.amountXof
    cur.balanceXof = run
    byDay.set(m.date, cur)
  }

  const daily = (() => {
    const days = lastNDays(30, now)
    let cum = initial
    return days.map((d) => {
      const day = byDay.get(d.key)
      if (day) cum = day.balanceXof
      return { key: d.key, label: d.label, balanceXof: cum, inXof: day?.inXof || 0, outXof: day?.outXof || 0 }
    })
  })()

  const monthly = lastNMonths(12, now).map((m) => {
    const prefix = m.key + '-'
    let inXof = 0
    let outXof = 0
    let balanceXof = initial
    for (const [key, v] of byDay) {
      if (key.startsWith(prefix)) {
        inXof += v.inXof
        outXof += v.outXof
        balanceXof = v.balanceXof
      }
    }
    return { key: m.key, label: m.label, balanceXof, inXof, outXof }
  })

  return {
    soldeInitialXof: initial,
    soldeCourantXof: balance,
    totalInXof: totalIn,
    totalOutXof: totalOut,
    salesXof,
    manualInXof,
    expensesXof,
    manualOutXof,
    movements: [...movements].reverse(),
    daily,
    monthly,
    entries: treasury.entries,
  }
}
