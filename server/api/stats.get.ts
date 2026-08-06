import { loadProducts, loadOrders, getSocial, loadAccounts } from '~~/server/utils/storage'
import { requireAuth } from '~~/server/utils/auth'
import { revenueRows } from '~~/server/utils/accounting'

// Admin dashboard: global business KPIs + a rich interaction analytics layer
// (~18 stats): per-product tops (views, clicks, likes, comments, preorders,
// WhatsApp) and per-user tops (likers, commenters, preorders, viewers, sharers,
// engaged).
//
// Single source of truth:
//  - Revenue (CA) counts ONLY paid orders (REVENUE_STATUSES), exactly like
//    /api/accounting and /api/treasury -> the dashboard, comptabilité and
//    analyse always show the same numbers.
//  - Clicks come from social events (type 'click'), like counts come from the
//    social like index (social.likes) -> no parallel counters anywhere.
export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const [productsRaw, orders, social, accounts] = await Promise.all([loadProducts(), loadOrders(), getSocial(), loadAccounts()])
  const products = productsRaw.filter((p: any) => !p.deleted)
  const rows = revenueRows(orders, products)

  const events = social.events || []
  const comments = social.comments || []
  const likeIndex = social.likes || {}

  // ---- user display info ----
  const accountIndex = new Map(accounts.map((a) => [a.id, a]))
  const userInfo = (id: string) => {
    const a = accountIndex.get(id)
    return {
      id,
      name: a?.pseudo || a?.name || a?.email || 'Anonyme',
      pseudo: a?.pseudo || '',
      picture: a?.picture || '',
      role: a?.role || 'user',
    }
  }

  // ---- per-user event counters (views, clicks, likes/unlikes, shares) ----
  interface UserCounters {
    views: number
    clicks: number
    likes: number
    unlikes: number
    shares: number
    copies: number
    comments: number
    commentsCount: number
    liked: Set<string>
    orders: number
    total: number
  }
  const counters = new Map<string, UserCounters>()
  const counterFor = (id: string): UserCounters => {
    let c = counters.get(id)
    if (!c) {
      c = { views: 0, clicks: 0, likes: 0, unlikes: 0, shares: 0, copies: 0, comments: 0, commentsCount: 0, liked: new Set(), orders: 0, total: 0 }
      counters.set(id, c)
    }
    return c
  }

  for (const e of events) {
    if (!e.userId) continue
    const c = counterFor(String(e.userId))
    c.total += 1
    switch (e.type) {
      case 'view': c.views += 1; break
      case 'click': c.clicks += 1; break
      case 'share': c.shares += 1; break
      case 'copy': c.copies += 1; break
      case 'comment': c.comments += 1; break
      case 'like': c.likes += 1; c.liked.add(e.productId); break
      case 'unlike': c.unlikes += 1; c.liked.delete(e.productId); break
    }
  }
  // comments stored separately -> merge into user counters
  for (const c of comments) {
    if (!c.userId) continue
    const u = counterFor(String(c.userId))
    u.commentsCount += 1
    u.total += 1
  }
  // preorders from orders (exclude cancelled for "intent" metric)
  const preordersByUser = new Map<string, number>()
  const preordersByProduct = new Map<string, number>()
  for (const o of orders) {
    if (o.status === 'cancelled') continue
    if (o.userId) preordersByUser.set(String(o.userId), (preordersByUser.get(String(o.userId)) || 0) + 1)
    preordersByProduct.set(String(o.productId), (preordersByProduct.get(String(o.productId)) || 0) + 1)
  }
  for (const [uid, n] of preordersByUser) {
    const u = counterFor(uid)
    u.orders = n
    u.total += n
  }

  // ---- product aggregates (views/clicks/shares/comments from social) ----
  const viewedByProduct = new Map<string, number>()
  const clickedByProduct = new Map<string, number>()
  const sharedByProduct = new Map<string, number>()
  const commentedByProduct = new Map<string, number>()
  const bump = (m: Map<string, number>, key: string, n = 1) => m.set(key, (m.get(key) || 0) + n)

  for (const e of events) {
    if (!e.productId) continue
    const pid = String(e.productId)
    if (e.type === 'view') bump(viewedByProduct, pid)
    else if (e.type === 'click') bump(clickedByProduct, pid)
    else if (e.type === 'share' || e.type === 'copy') bump(sharedByProduct, pid)
  }
  for (const c of comments) {
    if (!c.productId) continue
    bump(commentedByProduct, String(c.productId))
  }

  const productMeta = (id: string) => {
    const p = products.find((x: any) => x.id === id)
    return { id, title: p?.title || 'Produit', imageUrl: p?.imageUrl || '' }
  }
  const topBy = (m: Map<string, number>, n = 6) =>
    [...m.entries()]
      .map(([id, count]) => ({ ...productMeta(id), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, n)

  // "Plus aimés": derived from the SAME like index as every like count shown
  // (social.likes) so both numbers can never diverge.
  const topLiked = Object.entries(likeIndex)
    .map(([id, count]) => ({ ...productMeta(id), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)

  // ---- user tops ----
  const usersById = [...counters.entries()].filter(([, c]) => c.total > 0).map(([id, c]) => ({ ...userInfo(id), ...c, likedCount: c.liked.size }))
  const topUsers = (pick: (c: UserCounters) => number, min = 0, n = 6) =>
    usersById
      .map((u) => ({ id: u.id, name: u.name, pseudo: u.pseudo, picture: u.picture, role: u.role, count: pick(u as any) }))
      .filter((u) => u.count >= min)
      .sort((a, b) => b.count - a.count)
      .slice(0, n)

  // ---- revenue: paid orders only (same definition as comptabilité/analyse) ----
  const totalClicks = [...clickedByProduct.values()].reduce((s, n) => s + n, 0)
  let totalRevenueXof = 0
  let totalRevenueEur = 0
  for (const row of rows) {
    totalRevenueXof += row.revenueXof
    totalRevenueEur += (Number(row.order.priceEur) || 0) * Math.max(1, Number(row.order.quantity) || 1)
  }

  const revenueByProduct = new Map<string, { revenueXof: number; revenueEur: number }>()
  for (const row of rows) {
    const pid = String(row.order.productId || '')
    const cur = revenueByProduct.get(pid) || { revenueXof: 0, revenueEur: 0 }
    cur.revenueXof += row.revenueXof
    cur.revenueEur += (Number(row.order.priceEur) || 0) * Math.max(1, Number(row.order.quantity) || 1)
    revenueByProduct.set(pid, cur)
  }

  const salesByCategory: Record<string, number> = {}
  rows.forEach((row) => {
    const p = products.find((pp: any) => pp.id === row.order.productId)
    const cat = (p?.category || 'Autres') as string
    salesByCategory[cat] = (salesByCategory[cat] || 0) + 1
  })

  const revenueSeries = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    const key = d.toISOString().slice(0, 10)
    const dayRows = rows.filter((r) => (r.order.createdAt || '').slice(0, 10) === key)
    const label = d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
    return {
      label,
      revenueXof: dayRows.reduce((s, r) => s + r.revenueXof, 0),
      revenueEur: dayRows.reduce((s, r) => s + (Number(r.order.priceEur) || 0) * Math.max(1, Number(r.order.quantity) || 1), 0),
      orders: dayRows.length,
    }
  })

  const topProducts = products
    .map((p: any) => {
      const rev = revenueByProduct.get(p.id) || { revenueXof: 0, revenueEur: 0 }
      return {
        id: p.id,
        title: p.title,
        imageUrl: p.imageUrl,
        clicks: clickedByProduct.get(p.id) || 0,
        revenueXof: rev.revenueXof,
        revenueEur: rev.revenueEur,
      }
    })
    .sort((a: any, b: any) => b.clicks - a.clicks)
    .slice(0, 8)

  const interactions = {
    views: events.filter((e: any) => e.type === 'view').length,
    clicks: totalClicks,
    likes: Object.values(likeIndex).reduce((s: number, v) => s + (Number(v) || 0), 0),
    shares: events.filter((e: any) => e.type === 'share').length,
    copies: events.filter((e: any) => e.type === 'copy').length,
    unlikes: events.filter((e: any) => e.type === 'unlike').length,
    comments: comments.length,
    commentLikes: comments.reduce((s: number, c: any) => s + (Number(c.likes) || 0), 0),
    commentDislikes: comments.reduce((s: number, c: any) => s + (Number(c.dislikes) || 0), 0),
    commentReports: comments.reduce((s: number, c: any) => s + (Number(c.reports) || 0), 0),
    events: events.length,
  }

  return {
    success: true,
    stats: {
      totalProducts: products.length,
      totalOrders: orders.length,
      totalClicks,
      totalRevenueXof,
      totalRevenueEur,
      interactions,
      salesByCategory: Object.entries(salesByCategory).map(([category, ordersCount]) => ({ category, orders: ordersCount, revenueXof: 0 })),
      revenueSeries,
      topProducts,
      analytics: {
        totalUsers: accounts.length,
        engagedUsers: usersById.filter((u) => u.total > 0).length,
        products: {
          viewed: topBy(viewedByProduct),
          clicked: topBy(clickedByProduct),
          liked: topLiked,
          commented: topBy(commentedByProduct),
          preordered: topBy(preordersByProduct),
          whatsapp: topBy(clickedByProduct),
        },
        users: {
          likers: topUsers((c) => c.liked.size, 1),
          commenters: topUsers((c) => c.commentsCount, 1),
          preorders: topUsers((c) => c.orders, 1),
          viewers: topUsers((c) => c.views, 1),
          sharers: topUsers((c) => c.shares + c.copies, 1),
          engaged: topUsers((c) => c.total, 1),
        },
      },
    },
  }
})
