import { Product, WebhookConfig, Order, DashboardStats, UsersData } from "../types";
import { TOKEN_STORAGE_KEY, SESSION_STORAGE_KEY } from "./constants";

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setToken(token: string | null) {
  if (token) sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
  else sessionStorage.removeItem(TOKEN_STORAGE_KEY);
}

export function setAuthenticated(flag: boolean) {
  if (flag) sessionStorage.setItem(SESSION_STORAGE_KEY, "true");
  else sessionStorage.removeItem(SESSION_STORAGE_KEY);
}

export function isAuthenticated(): boolean {
  return sessionStorage.getItem(SESSION_STORAGE_KEY) === "true";
}

async function request<T>(url: string, options: RequestInit = {}, needsAuth = false): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (needsAuth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(url, { ...options, headers });
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) {
    const err = new Error(body?.error || `Erreur HTTP ${res.status}`);
    (err as any).status = res.status;
    throw err;
  }
  return body as T;
}

export async function loginRequest(password: string): Promise<void> {
  const data = await request<{ success: boolean; token: string }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
  setToken(data.token);
}

export async function googleLogin(credential: string): Promise<void> {
  const data = await request<{ success: boolean; token: string; email?: string }>("/api/auth/google", {
    method: "POST",
    body: JSON.stringify({ credential }),
  });
  setToken(data.token);
  if (data.email) {
    try {
      sessionStorage.setItem("bm_admin_email", data.email);
    } catch {
      // ignore
    }
  }
}

export async function logoutRequest(): Promise<void> {
  try {
    await request("/api/auth/logout", { method: "POST" }, true);
  } catch {
    // ignore network errors on logout
  }
  setToken(null);
}

export async function fetchProducts(): Promise<Product[]> {
  const data = await request<{ success: boolean; products: Product[] }>("/api/products", {}, true);
  return data.products || [];
}

export async function saveProduct(product: Product): Promise<void> {
  await request("/api/products", { method: "POST", body: JSON.stringify(product) }, true);
}

export async function saveProductsBulk(products: Product[]): Promise<void> {
  await request("/api/products", { method: "PUT", body: JSON.stringify(products) }, true);
}

export async function deleteProduct(id: string): Promise<void> {
  await request(`/api/products/${encodeURIComponent(id)}`, { method: "DELETE" }, true);
}

export async function incrementClicks(id: string): Promise<void> {
  try {
    await request(`/api/products/${encodeURIComponent(id)}/clicks`, { method: "POST" });
  } catch {
    // click counter is non-critical
  }
}

export async function fetchOrders(): Promise<Order[]> {
  const data = await request<{ success: boolean; orders: Order[] }>("/api/orders", {}, true);
  return data.orders || [];
}

export async function saveOrder(order: Partial<Order>): Promise<Order> {
  const data = await request<{ success: boolean; order: Order }>("/api/orders", {
    method: "POST",
    body: JSON.stringify(order),
  }, true);
  return data.order;
}

export async function updateOrder(id: string, patch: Partial<Order>): Promise<Order> {
  const data = await request<{ success: boolean; order: Order }>(`/api/orders/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(patch),
  }, true);
  return data.order;
}

export async function deleteOrder(id: string): Promise<void> {
  await request(`/api/orders/${encodeURIComponent(id)}`, { method: "DELETE" }, true);
}

export async function fetchStats(): Promise<DashboardStats> {
  const data = await request<{ success: boolean; stats: DashboardStats }>("/api/stats", {}, true);
  return data.stats;
}

export async function fetchUsers(): Promise<UsersData> {
  const data = await request<{ success: boolean; users: UsersData }>("/api/users", {}, true);
  return data.users;
}

export async function saveAdmins(emails: string[]): Promise<string[]> {
  const data = await request<{ success: boolean; admins: string[] }>("/api/users/admins", {
    method: "PUT",
    body: JSON.stringify({ emails }),
  }, true);
  return data.admins;
}

export interface TranslatePayload {
  chineseDescription?: string;
  imageBase64?: string;
  imageMimeType?: string;
  customMarkup?: number;
  basePriceRmb?: number;
}

export async function translateProduct(payload: TranslatePayload): Promise<any> {
  const data = await request<{ success: boolean; data: any }>("/api/translate-product", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return data.data;
}

export interface RefinePayload {
  field: "description" | "technical";
  title: string;
  category?: string;
  currentText?: string;
}

export async function refineText(payload: RefinePayload): Promise<string> {
  const data = await request<{ success: boolean; html: string }>("/api/ai-refine", {
    method: "POST",
    body: JSON.stringify(payload),
  }, true);
  return data.html;
}

export function loadConfig(): WebhookConfig | null {
  try {
    const raw = localStorage.getItem("bm_admin_config");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveConfig(config: WebhookConfig): void {
  try {
    localStorage.setItem("bm_admin_config", JSON.stringify(config));
  } catch {
    // storage may be unavailable (private mode)
  }
}
