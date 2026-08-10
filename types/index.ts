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
  /** Mention produit vitrine : neuf / occasion / gros (optionnelle, ST-018).
   * Produits anciens sans mention → aucun badge, aucun filtre ne les exclut
   * tant qu'aucune mention n'est sélectionnée. Valeur normalisée FR, distincte
   * du champ brut source `condition` (texte source d'origine, IMPORTANT). */
  mention?: ProductMention
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
  /** Fournisseur (import ST-017) — affiché en « Fiche vendeur » sur la fiche
   * produit publique quand au moins un champ est renseigné (optionnel). */
  sourcePriceTiers?: { quantity: string; value: string }[]
  sourceStock?: number
  /** URL source du produit (import/scraping, ex. Goofish) — affichée en
   * éditeur admin avec lien « Ouvrir la source ». Absente pour les produits
   * manuels/anciens. */
  sourceUrl?: string
  /** Infos vendeur scrapées à l'import — LECTURE SEULE (donnée scraping).
   * Objet court nettoyé par sanitizeProduct ; absent pour les produits
   * manuels/anciens. */
  seller?: {
    nick?: string
    city?: string
    soldCount?: number
    replyRatio24h?: string
    newGoodRatioRate?: string
    zhimaVerified?: boolean
  }
  supplierContact?: {
    platform?: string
    sourceId?: string
    sellerName?: string
    country?: string
    wechat?: string
    email?: string
    whatsapp?: string
    phone?: string
    website?: string
    note?: string
    updatedAt?: string
  }
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

/** Mentions produit vitrine (ST-018) — valeurs normalisées FR + libellés.
 * `PRODUCT_MENTIONS[].value` est la valeur persistée sur `Product.mention` ;
 * `label` est le libellé FR affiché (badges cartes, filtres vitrine, selects). */
export const PRODUCT_MENTIONS = [
  { value: 'neuf', label: 'Neuf' },
  { value: 'occasion', label: 'Occasion' },
  { value: 'gros', label: 'Gros' },
] as const

export type ProductMention = (typeof PRODUCT_MENTIONS)[number]['value']
