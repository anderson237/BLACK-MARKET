import { loadProducts, loadOrders, loadExpenses, loadKpiSettings } from '~~/server/utils/storage'
import { requireAuth } from '~~/server/utils/auth'
import {
  REVENUE_STATUSES,
  revenueRows,
  totalsFor,
  lastNMonths,
  lastNDays,
  dateKey,
  sameDay,
  sameWeek,
  sameMonth,
  sameYear,
  productCostXof,
  sellingPriceXof,
  normalizeKpiSettings,
  periodMonths,
} from '~~/server/utils/accounting'
import { RMB_TO_XOF_RATE } from '../utils/constants'
import { EXPENSE_CATEGORY_LABEL } from '../../data/expenseCategories'

const ALLOWED_ROLES = ['admin', 'editor', 'publisher']

type Row = { order: any; product: any; revenueXof: number; costXof: number }

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  if (!ALLOWED_ROLES.includes(String(session.role || ''))) {
    throw createError({ statusCode: 403, statusMessage: 'Accès réservé à la gestion.' })
  }

  const [productsRaw, orders, expenses] = await Promise.all([loadProducts(), loadOrders(), loadExpenses()])
  const products = productsRaw.filter((p: any) => !p.deleted)
  const rows = revenueRows(orders, products) as Row[]
  const settings = normalizeKpiSettings(await loadKpiSettings())
  const now = new Date()

  // ---- KPIs étendus par période ----
  function build(key: 'today' | 'week' | 'month' | 'year' | 'allTime', date: Date, match: (a: Date, b: Date) => boolean) {
    const p = totalsFor(rows, expenses, date, match)
    const periodRows = key === 'allTime' ? rows : rows.filter((r) => match(new Date(r.order.createdAt || 0), date))
    const customers = new Set(periodRows.map((r) => String(r.order.customerPhone || r.order.customerName || r.order.id || ''))).size
    let months = periodMonths(key)
    if (key === 'allTime' && rows.length) {
      const first = new Date(Math.min(...rows.map((r) => +new Date(r.order.createdAt || 0))))
      months = Math.max(1, (now.getTime() - first.getTime()) / (30.44 * 864e5))
    }
    const returnsXof = Math.round(p.revenueXof * (settings.returnsPct / 100) * 0.2)
    const feesXof = Math.round(p.revenueXof * (settings.feesPct / 100))
    const shippingXof = Math.round(p.orders * settings.shippingCostXof)
    const adsXof = Math.round(settings.adsMonthlyXof * months)
    const fixedXof = Math.round(settings.fixedCostsMonthlyXof * months)
    const contribution = p.grossProfitXof - feesXof - shippingXof - returnsXof
    const netProfit = contribution - p.expensesXof - fixedXof
    const aov = p.orders > 0 ? p.revenueXof / p.orders : 0
    const ordersPerCustomer = customers > 0 ? p.orders / customers : 0
    const cac = customers > 0 ? adsXof / customers : 0
    const clv = aov > 0 && customers > 0 ? aov * ordersPerCustomer * (settings.avgCustomerLifespanMonths / Math.max(months, 0.001)) : 0
    const pct = (v: number) => (p.revenueXof > 0 ? Math.round((v / p.revenueXof) * 1000) / 10 : 0)
    return {
      revenueXof: p.revenueXof,
      costXof: p.costXof,
      expensesXof: p.expensesXof,
      orders: p.orders,
      customers,
      grossProfitXof: p.grossProfitXof,
      grossMarginPct: p.grossMarginPct,
      contribution,
      contributionMarginPct: pct(contribution),
      netProfitXof: Math.round(netProfit),
      netMarginPct: pct(netProfit),
      returnsXof,
      feesXof,
      shippingXof,
      adsXof,
      fixedXof,
      aov: Math.round(aov),
      cac: Math.round(cac),
      clv: Math.round(clv),
      cacClv: cac > 0 ? Math.round((clv / cac) * 10) / 10 : 0,
    }
  }

  const today = build('today', now, sameDay)
  const week = build('week', now, sameWeek)
  const month = build('month', now, sameMonth)
  const year = build('year', now, sameYear)
  const allTime = build('allTime', new Date(0), () => true)

  // ---- daily series (last 30 days) ----
  const daily = lastNDays(30, now).map((d) => {
    const date = new Date(`${d.key}T12:00:00`)
    const t = totalsFor(rows, expenses, date, sameDay)
    return { key: d.key, label: d.label, revenueXof: t.revenueXof, expensesXof: t.expensesXof, netProfitXof: t.netProfitXof, orders: t.orders }
  })
  let cum = 0
  const dailyWithCum = daily.map((d) => {
    cum += d.netProfitXof
    return { ...d, cumulativeNetXof: cum }
  })

  // ---- monthly series (last 12 months) ----
  const monthly = lastNMonths(12, now).map((m) => {
    const [y, mm] = m.key.split('-').map(Number)
    const ref = new Date(y, mm - 1, 15)
    const t = totalsFor(rows, expenses, ref, sameMonth)
    return {
      key: m.key,
      label: m.label,
      revenueXof: t.revenueXof,
      costXof: t.costXof,
      expensesXof: t.expensesXof,
      grossProfitXof: t.grossProfitXof,
      netProfitXof: t.netProfitXof,
      grossMarginPct: t.grossMarginPct,
      netMarginPct: t.netMarginPct,
      orders: t.orders,
    }
  })
  const costXofLast12m = monthly.reduce((s, m) => s + m.costXof, 0)

  // ---- expenses grouped by category ----
  const catTotals = new Map<string, number>()
  const catCount = new Map<string, number>()
  for (const e of expenses) {
    const cat = String(e.category || 'divers')
    catTotals.set(cat, (catTotals.get(cat) || 0) + (Number(e.amountXof) || 0))
    catCount.set(cat, (catCount.get(cat) || 0) + 1)
  }
  const totalExpenses = [...catTotals.values()].reduce((s, n) => s + n, 0)
  const categories = [...catTotals.entries()]
    .map(([category, totalXof]) => ({
      category,
      label: EXPENSE_CATEGORY_LABEL(category),
      totalXof,
      count: catCount.get(category) || 0,
      pct: totalExpenses > 0 ? Math.round((totalXof / totalExpenses) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.totalXof - a.totalXof)

  // ---- KPIs par catégorie de produit (rentabilité par segment) ----
  const byCat = new Map<string, { revenueXof: number; costXof: number; orders: number }>()
  for (const r of rows) {
    const cat = String(r.product?.category || 'Autre')
    const cur = byCat.get(cat) || { revenueXof: 0, costXof: 0, orders: 0 }
    cur.revenueXof += r.revenueXof
    cur.costXof += r.costXof
    cur.orders += 1
    byCat.set(cat, cur)
  }
  const categoryKpis = [...byCat.entries()]
    .map(([category, v]) => ({
      category,
      revenueXof: v.revenueXof,
      costXof: v.costXof,
      grossProfitXof: v.revenueXof - v.costXof,
      marginPct: v.revenueXof > 0 ? Math.round(((v.revenueXof - v.costXof) / v.revenueXof) * 1000) / 10 : 0,
      orders: v.orders,
    }))
    .sort((a, b) => b.revenueXof - a.revenueXof)

  // ---- top products by revenue (with gross profit + margin) ----
  const byProduct = new Map<string, { revenueXof: number; costXof: number; orders: number }>()
  for (const r of rows) {
    const id = String(r.order.productId || '')
    const cur = byProduct.get(id) || { revenueXof: 0, costXof: 0, orders: 0 }
    cur.revenueXof += r.revenueXof
    cur.costXof += r.costXof
    cur.orders += 1
    byProduct.set(id, cur)
  }
  const topProducts = [...byProduct.entries()]
    .map(([id, v]) => {
      const p = products.find((pp: any) => pp.id === id)
      return {
        id,
        title: p?.title || 'Produit',
        imageUrl: p?.imageUrl || '',
        category: p?.category || '',
        revenueXof: v.revenueXof,
        costXof: v.costXof,
        grossProfitXof: v.revenueXof - v.costXof,
        marginPct: v.revenueXof > 0 ? Math.round(((v.revenueXof - v.costXof) / v.revenueXof) * 1000) / 10 : 0,
        orders: v.orders,
        stockQuantity: Number(p?.stockQuantity) || 0,
      }
    })
    .sort((a, b) => b.revenueXof - a.revenueXof)
    .slice(0, 10)

  // ---- stock : valeur, rotation, DIO, dormant ----
  const stockProducts = products.filter((p: any) => (Number(p.stockQuantity) || 0) > 0)
  const stockUnits = stockProducts.reduce((s, p: any) => s + Number(p.stockQuantity), 0)
  const stockValueXof = stockProducts.reduce((s, p: any) => s + productCostXof(p) * Number(p.stockQuantity), 0)
  const rotation = stockValueXof > 0 ? costXofLast12m / stockValueXof : 0
  const dio = rotation > 0 ? Math.round(365 / rotation) : 0
  const sixMonthsAgo = new Date(now)
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
  const soldRecently = new Set(rows.filter((r) => new Date(r.order.createdAt || 0) >= sixMonthsAgo).map((r) => String(r.order.productId || '')))
  const dormantProducts = stockProducts.filter((p: any) => !soldRecently.has(String(p.id)))
  const dormantValueXof = dormantProducts.reduce((s, p: any) => s + productCostXof(p) * Number(p.stockQuantity), 0)
  const potentialMargin = products.reduce(
    (s, p: any) => s + Math.max(0, sellingPriceXof(Number(p.purchaseRmb) || 0, Number(p.shippingRmb) || 0, Number(p.marginPercent) || 0) - productCostXof(p)),
    0,
  )
  const lowMargin = products
    .map((p: any) => {
      const price = Number(p.priceXof) || 0
      const cost = productCostXof(p)
      const marginPct = price > 0 ? Math.round(((price - cost) / price) * 1000) / 10 : 0
      return { id: p.id, title: p.title, priceXof: price, costXof: cost, marginPct, stockQuantity: Number(p.stockQuantity) || 0 }
    })
    .filter((x) => x.priceXof > 0 && x.marginPct < 30)
    .sort((a, b) => a.marginPct - b.marginPct)
    .slice(0, 10)

  const stock = {
    units: stockUnits,
    valueXof: stockValueXof,
    rotation: Math.round(rotation * 10) / 10,
    dio,
    dormantUnits: dormantProducts.reduce((s, p: any) => s + Number(p.stockQuantity), 0),
    dormantValueXof: dormantValueXof,
    potentialMargin,
    lowMargin,
    topProducts,
  }

  // ---- marketing global ----
  const marketing = {
    aov: allTime.aov,
    ordersPerCustomer: allTime.customers > 0 ? Math.round((allTime.orders / allTime.customers) * 10) / 10 : 0,
    repeatRate: allTime.customers > 0 ? Math.round(((allTime.orders - allTime.customers) / allTime.customers) * 100) : 0,
    cac: allTime.cac,
    clv: allTime.clv,
    cacClv: allTime.cacClv,
    contributionMarginPct: allTime.contributionMarginPct,
  }

  const expensesSorted = [...expenses]
    .map((e: any) => ({
      id: String(e.id || ''),
      label: String(e.label || 'Dépense'),
      category: String(e.category || 'divers'),
      amountXof: Number(e.amountXof) || 0,
      date: String(e.date || dateKey(now)),
      note: String(e.note || ''),
      paymentMethod: String(e.paymentMethod || 'cash'),
      createdAt: String(e.createdAt || new Date().toISOString()),
    }))
    .sort((a: any, b: any) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))

  const kpi = (p: ReturnType<typeof build>) => ({ ...p })

  return {
    success: true,
    accounting: {
      generatedAt: now.toISOString(),
      currency: 'XOF',
      rmbRate: RMB_TO_XOF_RATE,
      revenueStatuses: [...REVENUE_STATUSES],
      settings,
      kpi: {
        today: kpi(today),
        week: kpi(week),
        month: kpi(month),
        year: kpi(year),
        allTime: kpi(allTime),
      },
      daily: dailyWithCum,
      monthly,
      categories,
      categoryKpis,
      topProducts,
      stock,
      marketing,
      expenses: expensesSorted,
      expensesTotalXof: totalExpenses,
    },
  }
})
