export interface Product {
  id: string
  title: string
  chineseTitle?: string
  description: string
  originalDescription?: string
  chineseDescription?: string
  features: string[]
  priceEur: number
  priceXof: number
  currency?: string
  /** Promo / réduction : pourcentage à appliquer (ex. 25 = -25%) */
  discountPercent?: number
  /** Fin de la promo (ISO). Compte à rebours affiché sur la fiche. */
  discountEndsAt?: string
  imageUrl: string
  gallery?: string[]
  videoUrl?: string
  featuredMedia?: 'image' | 'video'
  category: string
  whatsappClicks: number
  likeCount?: number
  commentCount?: number
  waNumber?: string
  sourceRmb?: number
  purchaseRmb?: number
  shippingRmb?: number
  marginPercent?: number
  stockStatus?: 'in_stock' | 'preorder'
  stockQuantity?: number
  moq?: number
  deleted?: boolean
  deletedAt?: string
  createdAt: string
}

export type OrderStatus = 'pending' | 'processing' | 'completed' | 'shipped' | 'cancelled'

export interface Order {
  id: string
  productId: string
  productTitle: string
  productImage: string
  customerName: string
  customerPhone: string
  customerLocation: string
  userId?: string
  quantity: number
  priceXof: number
  priceEur: number
  status: OrderStatus
  createdAt: string
}

export interface DashboardStats {
  totalProducts: number
  totalOrders: number
  totalClicks: number
  totalRevenueXof: number
  totalRevenueEur: number
  topProducts: { id: string; title: string; imageUrl: string; clicks: number; revenueXof: number; revenueEur: number }[]
  salesByCategory: { category: string; orders: number; revenueXof: number }[]
  revenueSeries: { label: string; revenueXof: number; revenueEur: number; orders: number }[]
}

export const CATEGORIES = [
  'Techwear',
  'Streetwear',
  'Cyber Gadgets',
  'Gaming Room',
  'Accessoires',
]
