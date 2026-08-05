export interface Product {
  id: string;
  title: string;
  chineseTitle?: string;
  description: string; // The French sales pitch
  originalDescription?: string; // The technical translation details
  chineseDescription?: string; // Original input in Chinese
  features: string[];
  priceEur: number;
  priceXof: number;
  imageUrl: string;
  gallery?: string[]; // Additional product photos displayed in the client carousel
  videoUrl?: string; // A video link or simulated slideshow slides
  featuredMedia?: 'image' | 'video';
  category: string;
  whatsappClicks: number;
  sourceRmb?: number;
  stockStatus?: 'in_stock' | 'preorder';
  stockQuantity?: number;
  moq?: number;
  createdAt: string;
}

export interface WebhookConfig {
  phoneNumber: string; // Dynamic WhatsApp number, e.g. "33612345678" or "2250707..."
  currency: "EUR" | "XOF";
  githubRepo: string;
  githubBranch: string;
  githubToken: string;
  siteUrl?: string;
}

export interface AIProcessingState {
  loading: boolean;
  error: string | null;
  success: boolean;
}

export type OrderStatus = "pending" | "processing" | "completed" | "shipped" | "cancelled";

export interface Order {
  id: string;
  productId: string;
  productTitle: string;
  productImage: string;
  customerName: string;
  customerPhone: string;
  customerLocation: string;
  quantity: number;
  priceXof: number;
  priceEur: number;
  status: OrderStatus;
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  location: string;
  orders: number;
  totalXof: number;
  totalEur: number;
  lastOrderAt: string;
}

export interface DashboardStats {
  totalProducts: number;
  totalOrders: number;
  totalClicks: number;
  totalRevenueXof: number;
  totalRevenueEur: number;
  topProducts: { id: string; title: string; imageUrl: string; clicks: number; revenueXof: number; revenueEur: number }[];
  salesByCategory: { category: string; orders: number; revenueXof: number }[];
  revenueSeries: { label: string; revenueXof: number; revenueEur: number; orders: number }[];
}

export type TabId =
  | "dashboard"
  | "catalog"
  | "orders"
  | "customers"
  | "categories"
  | "users"
  | "ai_generator"
  | "settings";

export interface UserLogin {
  email: string;
  name: string;
  picture: string;
  loggedInAt: string;
}

export interface UsersData {
  owner: string;
  admins: string[];
  currentEmail: string;
  logins: UserLogin[];
}
