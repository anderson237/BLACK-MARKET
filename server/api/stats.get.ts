import { loadProducts, loadOrders, getSocial, loadAccounts } from '~~/server/utils/storage'
import { requireAuth } from '~~/server/utils/auth'

// Admin dashboard: global business KPIs + a rich interaction analytics layer
// (~18 stats): per-product tops (views, clicks, likes, comments, preorders,
// WhatsApp) and per-user tops (likers, commenters, preorders, viewers, sharers,
// engaged).
export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const [productsRaw, orders, social, accounts] = await Promise.all([loadProducts(), loadOrders(), getSocial(), loadAccounts()])
  const products = productsRaw.filter((p: any) => !p.deleted)

  const events = social.events || []
  const comments = social.comments || []

  // ---- user display info ----
  const accountIndex = new Map(accounts.map((a) => [a.id, a]))
  const userInfo = (id: string) => {
    const a = accountIndex.get(id)
    return {
      id,
      name: a?.pseudo || a?.name || a?.email || 'Anonyme',
      pseudo: a?.pseudo || '',
      picture: a?.picture || '',
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

  // ---- product aggregates ----
  const viewedByProduct = new Map<string, number>()
  const clickedByProduct = new Map<string, number>()
  const sharedByProduct = new Map<string, number>()
  const likedUsers = new Map<string, Set<string>>()
  const commentedByProduct = new Map<string, number>()
  const bump = (m: Map<string, number>, key: string, n = 1) => m.set(key, (m.get(key) || 0) + n)

  for (const e of events) {
    if (!e.productId) continue
    const pid = String(e.productId)
    if (e.type === 'view') bump(viewedByProduct, pid)
    else if (e.type === 'click') bump(clickedByProduct, pid)
    else if (e.type === 'share' || e.type === 'copy') bump(sharedByProduct, pid)
    else if (e.type === 'like') {
      let s = likedUsers.get(pid)
      if (!s) { s = new Set(); likedUsers.set(pid, s) }
      if (e.userId) s.add(String(e.userId))
    } else if (e.type === 'unlike' && e.userId) {
      likedUsers.get(pid)?.delete(String(e.userId))
    }
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

  const topLiked = [...likedUsers.entries()]
    .map(([id, s]) => ({ ...productMeta(id), count: s.size }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)

  // ---- user tops ----
  const usersById = [...counters.entries()].filter(([, c]) => c.total > 0).map(([id, c]) => ({ ...userInfo(id), ...c, likedCount: c.liked.size }))
  const topUsers = (pick: (c: UserCounters) => number, min = 0, n = 6) =>
    usersById
      .map((u) => ({ id: u.id, name: u.name, pseudo: u.pseudo, picture: u.picture, count: pick(u as any) }))
      .filter((u) => u.count >= min)
      .sort((a, b) => b.count - a.count)
      .slice(0, n)

  const totalClicks = products.reduce((s: number, p: any) => s + (Number(p.whatsappClicks) || 0), 0)
  const totalRevenueXof = orders.reduce((s: number, o: any) => s + (Number(o.priceXof) || 0) * (Number(o.quantity) || 1), 0)
  const totalRevenueEur = orders.reduce((s: number, o: any) => s + (Number(o.priceEur) || 0) * (Number(o.quantity) || 1), 0)

  const salesByCategory: Record<string, number> = {}
  orders.forEach((o: any) => {
    const p = products.find((pp: any) => pp.id === o.productId)
    const cat = (p?.category || 'Autres') as string
    salesByCategory[cat] = (salesByCategory[cat] || 0) + 1
  })

  const revenueSeries = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    const key = d.toISOString().slice(0, 10)
    const dayOrders = orders.filter((o: any) => (o.createdAt || '').slice(0, 10) === key)
    const label = d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
    return {
      label,
      revenueXof: dayOrders.reduce((s: number, o: any) => s + (Number(o.priceXof) || 0) * (Number(o.quantity) || 1), 0),
      revenueEur: dayOrders.reduce((s: number, o: any) => s + (Number(o.priceEur) || 0) * (Number(o.quantity) || 1), 0),
      orders: dayOrders.length,
    }
  })

  const topProducts = products
    .map((p: any) => ({
      id: p.id,
      title: p.title,
      imageUrl: p.imageUrl,
      clicks: Number(p.whatsappClicks) || 0,
      revenueXof: orders.filter((o: any) => o.productId === p.id).reduce((s: number, o: any) => s + (Number(o.priceXof) || 0) * (Number(o.quantity) || 1), 0),
      revenueEur: orders.filter((o: any) => o.productId === p.id).reduce((s: number, o: any) => s + (Number(o.priceEur) || 0) * (Number(o.quantity) || 1), 0),
    }))
    .sort((a: any, b: any) => b.clicks - a.clicks)
    .slice(0, 8)

  const interactions = {
    views: events.filter((e: any) => e.type === 'view').length,
    clicks: events.filter((e: any) => e.type === 'click').length,
    likes: Object.values(social.likes || {}).reduce((s: number, v) => s + (Number(v) || 0), 0),
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
      salesByCategory: Object.entries(salesByCategory).map(([category, orders]) => ({ category, orders, revenueXof: 0 })),
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
          whatsapp: products
            .map((p: any) => ({ id: p.id, title: p.title, imageUrl: p.imageUrl, count: Number(p.whatsappClicks) || 0 }))
            .filter((p) => p.count > 0)
            .sort((a, b) => b.count - a.count)
            .slice(0, 6),
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
