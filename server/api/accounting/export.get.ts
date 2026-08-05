import { loadProducts, loadOrders, loadExpenses } from '~~/server/utils/storage'
import { requireAuth } from '~~/server/utils/auth'
import { revenueRows, totalsFor, lastNMonths, sameMonth, dateKey } from '~~/server/utils/accounting'
import { EXPENSE_CATEGORY_LABEL, EXPENSE_PAYMENT_LABEL } from '../../../data/expenseCategories'

const ALLOWED_ROLES = ['admin', 'editor', 'publisher']

const csv = (rows: (string | number)[][]) =>
  rows
    .map((r) =>
      r
        .map((v) => {
          const s = String(v ?? '')
          return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
        })
        .join(';'),
    )
    .join('\r\n')

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  if (!ALLOWED_ROLES.includes(String(session.role || ''))) {
    throw createError({ statusCode: 403, statusMessage: 'Accès réservé à la gestion.' })
  }

  const [productsRaw, orders, expenses] = await Promise.all([loadProducts(), loadOrders(), loadExpenses()])
  const products = productsRaw.filter((p: any) => !p.deleted)
  const rows = revenueRows(orders, products)
  const now = new Date()
  const allExpenses = expenses.reduce((s: number, e: any) => s + (Number(e.amountXof) || 0), 0)

  const out: (string | number)[][] = []
  out.push(['RAPPORT COMPTABLE BLACK MARKET'])
  out.push(['Généré le', now.toLocaleDateString('fr-FR'), now.toLocaleTimeString('fr-FR')])
  out.push([])
  out.push(['Chiffre d\'affaires total (FCFA)', rows.reduce((s, r) => s + r.revenueXof, 0)])
  out.push(['Coût marchandises vendues (FCFA)', rows.reduce((s, r) => s + r.costXof, 0)])
  out.push(['Bénéfice brut (FCFA)', rows.reduce((s, r) => s + (r.revenueXof - r.costXof), 0)])
  out.push(['Dépenses totales (FCFA)', allExpenses])
  const revenueTotal = rows.reduce((s, r) => s + r.revenueXof, 0)
  out.push(['Bénéfice net (FCFA)', revenueTotal - rows.reduce((s, r) => s + r.costXof, 0) - allExpenses])
  out.push(['Nombre de commandes comptabilisées', rows.length])
  out.push([])

  out.push(['MOIS', 'CA (FCFA)', 'Coût marchandises', 'Dépenses', 'Bénéfice net', 'Commandes'])
  for (const m of lastNMonths(12, now)) {
    const [y, mm] = m.key.split('-').map(Number)
    const ref = new Date(y, mm - 1, 15)
    const t = totalsFor(rows, expenses, ref, sameMonth)
    out.push([m.label, t.revenueXof, t.costXof, t.expensesXof, t.netProfitXof, t.orders])
  }
  out.push([])

  out.push(['DATE', 'CATÉGORIE', 'LIBELLÉ', 'MONTANT (FCFA)', 'PAIEMENT', 'NOTE'])
  const sorted = [...expenses].sort((a: any, b: any) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  for (const e of sorted) {
    out.push([
      e.date || '',
      EXPENSE_CATEGORY_LABEL(e.category),
      e.label || '',
      Number(e.amountXof) || 0,
      EXPENSE_PAYMENT_LABEL(e.paymentMethod),
      e.note || '',
    ])
  }

  const filename = `comptabilite-black-market-${dateKey(now)}.csv`
  setHeader(event, 'Content-Type', 'text/csv; charset=utf-8')
  setHeader(event, 'Content-Disposition', `attachment; filename="${filename}"`)
  return '\uFEFF' + csv(out)
})
