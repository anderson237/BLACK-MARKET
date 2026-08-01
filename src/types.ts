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
  videoUrl?: string; // A video link or simulated slideshow slides
  category: string;
  whatsappClicks: number;
  sourceRmb?: number;
  createdAt: string;
}

export interface WebhookConfig {
  phoneNumber: string; // Dynamic WhatsApp number, e.g. "33612345678" or "2250707..."
  currency: "EUR" | "XOF";
  githubRepo: string;
  githubBranch: string;
  githubToken: string;
  makeWebhookUrl: string;
}

export interface AIProcessingState {
  loading: boolean;
  error: string | null;
  success: boolean;
}

export type TabId = "catalog" | "ai_generator" | "make_guide" | "whatsapp_script";
