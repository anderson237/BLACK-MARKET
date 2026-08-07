import React, { useState, useEffect, useCallback, useMemo } from "react";
import { INITIAL_PRODUCTS } from "./data";
import { Product, WebhookConfig, AIProcessingState, TabId, Order, Customer, DashboardStats } from "./types";
import Catalog from "./components/Catalog";
import Login from "./components/Login";
import Header from "./components/Header";
import StatsBar from "./components/StatsBar";
import Sidebar from "./components/Sidebar";
import Dashboard from "./components/Dashboard";
import OrdersList from "./components/OrdersList";
import OrderDetails from "./components/OrderDetails";
import OrdersManager from "./components/OrdersManager";
import CustomersList from "./components/CustomersList";
import CategoriesManager from "./components/CategoriesManager";
import UsersManager from "./components/UsersManager";
import Settings from "./components/Settings";
import AIGenerator from "./components/AIGenerator";
import {
  loginRequest,
  logoutRequest,
  fetchProducts,
  saveProduct,
  saveProductsBulk,
  deleteProduct,
  incrementClicks,
  translateProduct,
  loadConfig,
  saveConfig,
  setAuthenticated,
  isAuthenticated,
  googleLogin,
  fetchOrders,
  saveOrder,
  updateOrder,
  deleteOrder,
  fetchStats,
} from "./lib/api";
import { DEFAULT_MARKUP } from "./lib/constants";
import { estimatePrices } from "./lib/pricing";

export default function App() {
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");

  // Orders & dashboard stats (server persistence)
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showNewOrder, setShowNewOrder] = useState(false);

  // Consolidate customers from orders
  const customers: Customer[] = useMemo(() => {
    const map = new Map<string, Customer>();
    orders.forEach((o) => {
      const key = (o.customerPhone || o.customerName || "inconnu").trim();
      if (!key) return;
      const existing = map.get(key);
      const totalXof = (Number(o.priceXof) || 0) * (Number(o.quantity) || 1);
      const totalEur = (Number(o.priceEur) || 0) * (Number(o.quantity) || 1);
      if (existing) {
        existing.orders += 1;
        existing.totalXof += totalXof;
        existing.totalEur += totalEur;
        if (new Date(o.createdAt) > new Date(existing.lastOrderAt)) existing.lastOrderAt = o.createdAt;
      } else {
        map.set(key, {
          id: key,
          name: o.customerName || key,
          phone: o.customerPhone || "",
          location: o.customerLocation || "—",
          orders: 1,
          totalXof,
          totalEur,
          lastOrderAt: o.createdAt,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => new Date(b.lastOrderAt).getTime() - new Date(a.lastOrderAt).getTime());
  }, [orders]);

  // Secure Authentication States
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(isAuthenticated);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutTime, setLockoutTime] = useState(0);
  const [isLocked, setIsLocked] = useState(false);

  // Lockout effect (60 seconds after 3 failed attempts)
  useEffect(() => {
    if (lockoutTime > 0) {
      const timer = setTimeout(() => {
        setLockoutTime((prev) => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      setIsLocked(false);
    }
  }, [lockoutTime]);

  // Secure Inactivity Auto-logout (15 minutes)
  useEffect(() => {
    if (!isLoggedIn) return;
    let timeoutId: ReturnType<typeof setTimeout>;

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setIsLoggedIn(false);
        setAuthenticated(false);
        alert("Session expirée après 15 minutes d'inactivité pour votre sécurité.");
      }, 15 * 60 * 1000);
    };

    window.addEventListener("mousemove", resetTimer);
    window.addEventListener("keydown", resetTimer);
    window.addEventListener("click", resetTimer);

    resetTimer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      window.removeEventListener("mousemove", resetTimer);
      window.removeEventListener("keydown", resetTimer);
      window.removeEventListener("click", resetTimer);
    };
  }, [isLoggedIn]);

  // Load persisted catalog from server when an active session exists
  useEffect(() => {
    if (!isAuthenticated()) return;
    fetchProducts()
      .then((serverProducts) => {
        if (serverProducts.length) setProducts(serverProducts);
      })
      .catch(() => {
        // Server unreachable: keep local data
      });
    // Load orders + stats too, so a still-active session (e.g. after a refresh)
    // shows real KPIs instead of zeros.
    refreshDashboard();
  }, [isLoggedIn]);

  // Live refresh: new preorders / clicks from the client site appear in the
  // dashboard automatically without having to re-login or reload the page.
  useEffect(() => {
    if (!isAuthenticated()) return;
    const timer = setInterval(() => {
      refreshDashboard();
      fetchProducts()
        .then((serverProducts) => {
          if (serverProducts.length) setProducts(serverProducts);
        })
        .catch(() => {
          // ignore
        });
    }, 20_000);
    return () => clearInterval(timer);
  }, [isLoggedIn]);

  // Config (phone/currency) persisted in localStorage
  const [config, setConfig] = useState<WebhookConfig>(
    loadConfig() ?? {
      phoneNumber: "237683963007",
      currency: "XOF",
      githubRepo: "mon-pseudo/blackmarket-sheets",
      githubBranch: "main",
      githubToken: "",
    }
  );

  useEffect(() => {
    saveConfig(config);
  }, [config]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) return;

    const sanitizedPassword = password.trim().replace(/<[^>]*>/g, "");

    try {
      // Server-side authentication is the ONLY valid path.
      // The legacy local fallback (DEMO_PASSWORDS) has been removed for security.
      await loginRequest(sanitizedPassword);
      onLoginSuccess();
    } catch (err: any) {
      if (err?.status) {
        // Server responded: credentials rejected
        fail("Clé d'accès incorrecte.");
      } else {
        // Server unreachable (offline / static hosting): refuse access.
        fail("Serveur d'authentification injoignable. Réessayez.");
      }
    }
  };

  const onLoginSuccess = async () => {
    setIsLoggedIn(true);
    setAuthenticated(true);
    setFailedAttempts(0);
    setLoginError("");
    setPassword("");
    // Refresh catalog from server persistence
    try {
      const serverProducts = await fetchProducts();
      if (serverProducts.length) setProducts(serverProducts);
    } catch {
      // ignore
    }
    refreshDashboard();
  };

  const refreshDashboard = async () => {
    try {
      const [serverOrders, serverStats] = await Promise.all([fetchOrders(), fetchStats()]);
      setOrders(serverOrders);
      setStats(serverStats);
    } catch {
      // dashboard data is non-critical
    }
  };

  const handleLogout = () => {
    logoutRequest();
    setIsLoggedIn(false);
    setAuthenticated(false);
  };

  // AI Generation Sandbox States
  const [aiInputChinese, setAiInputChinese] = useState<string>(
    "赛博朋克重工业防毒面罩，发光LED显示屏，可通过手机App输入文字或涂鸦，Goth风格机能战术穿搭，充电续航12小时。"
  );
  const [aiImageBase64, setAiImageBase64] = useState<string>("");
  const [aiImagePreview, setAiImagePreview] = useState<string>("");
  const [aiBasePriceRmb, setAiBasePriceRmb] = useState<number>(65);
  const [aiMarkup, setAiMarkup] = useState<number>(DEFAULT_MARKUP);
  const [aiCategory, setAiCategory] = useState<string>("Techwear");
  const [aiState, setAiState] = useState<AIProcessingState>({ loading: false, error: null, success: false });
  const [generatedProduct, setGeneratedProduct] = useState<Product | null>(null);

  // Convert uploaded image file to Base64 for the server-side Gemini API
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setAiImagePreview(base64String);
      const base64Data = base64String.split(",")[1];
      setAiImageBase64(base64Data);
    };
    reader.readAsDataURL(file);
  };

  const handleClearImage = () => {
    setAiImagePreview("");
    setAiImageBase64("");
  };

  // Trigger server-side Gemini translation and generation API
  const handleAiTranslate = async () => {
    setAiState({ loading: true, error: null, success: false });
    setGeneratedProduct(null);

    try {
      const data = await translateProduct({
        chineseDescription: aiInputChinese,
        imageBase64: aiImageBase64 || undefined,
        imageMimeType: aiImagePreview ? aiImagePreview.split(";")[0].split(":")[1] : "image/jpeg",
        customMarkup: aiMarkup,
        basePriceRmb: aiBasePriceRmb || undefined,
      });

      const fallback = estimatePrices(aiBasePriceRmb, aiMarkup);
      const newProduct: Product = {
        id: `prod_ai_${Date.now()}`,
        title: data.translatedTitle || "Nouveau Produit Importé",
        chineseTitle: aiInputChinese.slice(0, 40),
        chineseDescription: aiInputChinese,
        description: data.salesPitch || data.translatedDescription,
        originalDescription: data.translatedDescription,
        features: data.features || [],
        priceEur: data.priceEur || fallback.priceEur,
        priceXof: data.priceXof || fallback.priceXof,
        imageUrl: aiImagePreview || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=600",
        category: aiCategory,
        whatsappClicks: 0,
        sourceRmb: aiBasePriceRmb,
        createdAt: new Date().toISOString(),
      };

      setGeneratedProduct(newProduct);
      setAiState({ loading: false, error: null, success: true });
    } catch (err: any) {
      console.error(err);
      setAiState({
        loading: false,
        error: err.message || "Une erreur réseau est survenue lors de l'appel de l'IA.",
        success: false,
      });
    }
  };

  // Append generated product to the catalog (local + server persistence)
  const addProductToCatalog = async () => {
    if (!generatedProduct) return;

    const productToSend = generatedProduct;
    setProducts((prev) => [productToSend, ...prev]);
    setGeneratedProduct(null);
    setActiveTab("catalog");

    // Persist to server (silent best-effort)
    saveProduct(productToSend).catch((err) => console.warn("Server persistence failed:", err));
  };

  const handleDeleteProduct = async (product: Product) => {
    setProducts((prev) => prev.filter((p) => p.id !== product.id));
    deleteProduct(product.id).catch((err) => console.warn("Server delete failed:", err));
  };

  const handleUpdateProduct = async (updated: Product) => {
    setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    saveProduct(updated).catch((err) => console.warn("Server update failed:", err));
  };

  const handleAddProduct = async (newProduct: Product) => {
    setProducts((prev) => [newProduct, ...prev]);
    saveProduct(newProduct).catch((err) => console.warn("Server create failed:", err));
    refreshDashboard();
  };

  const handleIncrementClicks = useCallback((product: Product) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, whatsappClicks: (p.whatsappClicks || 0) + 1 } : p))
    );
    incrementClicks(product.id);
  }, []);

  // Orders CRUD
  const handleAddOrder = async (orderData: Omit<Order, "id" | "createdAt" | "status">) => {
    const now = new Date().toISOString();
    const optimistic: Order = { ...orderData, id: `ord_tmp_${Date.now()}`, status: "pending", createdAt: now };
    setOrders((prev) => [optimistic, ...prev]);
    try {
      const saved = await saveOrder(orderData);
      setOrders((prev) => prev.map((o) => (o.id === optimistic.id ? saved : o)));
    } catch (err) {
      console.warn("Order save failed:", err);
    }
    refreshDashboard();
  };

  const handleUpdateOrder = async (id: string, patch: Partial<Order>) => {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
    if (selectedOrder?.id === id) setSelectedOrder((o) => (o ? { ...o, ...patch } : o));
    try {
      await updateOrder(id, patch);
    } catch (err) {
      console.warn("Order update failed:", err);
    }
    refreshDashboard();
  };

  const handleDeleteOrder = async (id: string) => {
    if (!window.confirm("Supprimer définitivement cette commande ?")) return;
    setOrders((prev) => prev.filter((o) => o.id !== id));
    if (selectedOrder?.id === id) setSelectedOrder(null);
    try {
      await deleteOrder(id);
    } catch (err) {
      console.warn("Order delete failed:", err);
    }
    refreshDashboard();
  };

  // Category reclassification (rename/delete cascades to products)
  const handleReclassifyCategories = async (updated: Product[]) => {
    setProducts(updated);
    try {
      await saveProductsBulk(updated);
    } catch (err) {
      console.warn("Bulk category update failed:", err);
    }
    refreshDashboard();
  };

  const handleGoogleLogin = async (credential: string) => {
    try {
      await googleLogin(credential);
      onLoginSuccess();
    } catch (err: any) {
      fail(err?.message || "Connexion Google refusée. Vérifiez que votre email est un administrateur autorisé.");
    }
  };

  const fail = (message: string) => {
    const newAttempts = failedAttempts + 1;
    setFailedAttempts(newAttempts);
    if (newAttempts >= 3) {
      setIsLocked(true);
      setLockoutTime(60); // 60 seconds brute-force lockout
      setLoginError("Accès temporairement verrouillé pour des raisons de sécurité. Veuillez patienter.");
    } else {
      setLoginError(message);
    }
    setPassword("");
  };

  if (!isLoggedIn) {
    return (
      <Login
        password={password}
        onPasswordChange={setPassword}
        loginError={loginError}
        isLocked={isLocked}
        lockoutTime={lockoutTime}
        onSubmit={handleLogin}
        onGoogleLogin={handleGoogleLogin}
        onGoogleError={(msg) => setLoginError(msg)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#08080c] text-slate-100 font-sans" id="main-applet-root">
      <Header config={config} onConfigChange={setConfig} onLogout={handleLogout} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
          <div className="flex-1 min-w-0 space-y-6">
            <StatsBar products={products} config={config} markup={aiMarkup} />

            <div className="space-y-6">
              {activeTab === "dashboard" && (
                <Dashboard
                  orders={orders}
                  stats={stats}
                  config={config}
                  onOpenOrder={setSelectedOrder}
                  onGoTo={(tab) => setActiveTab(tab as TabId)}
                />
              )}

              {activeTab === "catalog" && (
                <Catalog
                  products={products}
                  config={config}
                  onIncrementClicks={handleIncrementClicks}
                  onDeleteProduct={handleDeleteProduct}
                  onUpdateProduct={handleUpdateProduct}
                  onAddProduct={handleAddProduct}
                />
              )}

              {activeTab === "orders" && (
                <OrdersList
                  orders={orders}
                  config={config}
                  onOpenOrder={setSelectedOrder}
                  onAddOrder={() => setShowNewOrder(true)}
                  onDeleteOrder={handleDeleteOrder}
                />
              )}

              {activeTab === "customers" && <CustomersList customers={customers} config={config} />}

              {activeTab === "categories" && (
                <CategoriesManager products={products} onUpdateProducts={handleReclassifyCategories} />
              )}

              {activeTab === "users" && <UsersManager />}

              {activeTab === "settings" && <Settings config={config} onConfigChange={setConfig} />}

              {activeTab === "ai_generator" && (
                <AIGenerator
                  products={products}
                  aiInputChinese={aiInputChinese}
                  setAiInputChinese={setAiInputChinese}
                  aiImagePreview={aiImagePreview}
                  aiImageBase64={aiImageBase64}
                  onImageUpload={handleImageUpload}
                  onClearImage={handleClearImage}
                  aiBasePriceRmb={aiBasePriceRmb}
                  setAiBasePriceRmb={setAiBasePriceRmb}
                  aiMarkup={aiMarkup}
                  setAiMarkup={setAiMarkup}
                  aiCategory={aiCategory}
                  setAiCategory={setAiCategory}
                  aiState={aiState}
                  onGenerate={handleAiTranslate}
                  generatedProduct={generatedProduct}
                  onInject={addProductToCatalog}
                  onRefuse={() => setGeneratedProduct(null)}
                />
              )}
            </div>
          </div>
        </div>
      </main>

      {selectedOrder && (
        <OrderDetails
          order={selectedOrder}
          config={config}
          onClose={() => setSelectedOrder(null)}
          onUpdateStatus={(id, status) => handleUpdateOrder(id, { status })}
          onDelete={handleDeleteOrder}
        />
      )}

      {showNewOrder && (
        <OrdersManager
          orders={orders}
          config={config}
          products={products}
          onAddOrder={handleAddOrder}
          onClose={() => setShowNewOrder(false)}
        />
      )}

      <footer className="bg-[#0b0b10] border-t border-zinc-900 py-8 mt-12 text-center text-xs text-zinc-500 font-mono">
        <div className="max-w-7xl mx-auto px-4 space-y-1">
          <p>© 2026 DEEP ROOTS SINO-PREP SYSTEM // KOREAN STREET STYLE</p>
          <p>Toutes les images et vidéos prévisualisées reçoivent le filigrane indélébile obligatoire.</p>
        </div>
      </footer>
    </div>
  );
}
