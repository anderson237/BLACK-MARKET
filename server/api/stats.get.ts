import { loadProducts, loadOrders, getSocial } from '~~/server/utils/storage'
import { requireAuth } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const [productsRaw, orders, social] = await Promise.all([loadProducts(), loadOrders(), getSocial()])
  const products = productsRaw.filter((p: any) => !p.deleted)

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

  return {
    success: true,
    stats: {
      totalProducts: products.length,
      totalOrders: orders.length,
      totalClicks,
      totalRevenueXof,
      totalRevenueEur,
      interactions: {
        views: social.events.filter((e: any) => e.type === 'view').length,
        clicks: social.events.filter((e: any) => e.type === 'click').length,
        likes: Object.values(social.likes || {}).reduce((s: number, v) => s + (Number(v) || 0), 0),
        shares: social.events.filter((e: any) => e.type === 'share').length,
        comments: social.comments.length,
        events: social.events.length,
      },
      salesByCategory: Object.entries(salesByCategory).map(([category, orders]) => ({ category, orders, revenueXof: 0 })),
      revenueSeries,
      topProducts,
    },
  }
})