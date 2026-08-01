import React, { useState, useEffect, useCallback } from "react";
import { INITIAL_PRODUCTS } from "./data";
import { Product, WebhookConfig, AIProcessingState, TabId } from "./types";
import Catalog from "./components/Catalog";
import Login from "./components/Login";
import Header from "./components/Header";
import StatsBar from "./components/StatsBar";
import TabNav from "./components/TabNav";
import AIGenerator from "./components/AIGenerator";
import MakeGuide from "./components/MakeGuide";
import WhatsAppScriptPanel from "./components/WhatsAppScriptPanel";
import DeploymentPanel from "./components/DeploymentPanel";
import {
  loginRequest,
  logoutRequest,
  fetchProducts,
  saveProduct,
  deleteProduct,
  incrementClicks,
  translateProduct,
  loadConfig,
  saveConfig,
  setAuthenticated,
  isAuthenticated,
} from "./lib/api";
import { DEFAULT_MARKUP, DEMO_PASSWORDS } from "./lib/constants";
import { estimatePrices } from "./lib/pricing";

export default function App() {
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [activeTab, setActiveTab] = useState<TabId>("catalog");

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
  }, [isLoggedIn]);

  // Config (webhook/phone/currency) persisted in localStorage
  const [config, setConfig] = useState<WebhookConfig>(
    loadConfig() ?? {
      phoneNumber: "237683963007",
      currency: "XOF",
      githubRepo: "mon-pseudo/blackmarket-sheets",
      githubBranch: "main",
      githubToken: "",
      makeWebhookUrl: "https://hook.eu1.make.com/xxxxxxxxxxxxxxxxxxxxxxxx",
    }
  );

  useEffect(() => {
    saveConfig(config);
  }, [config]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) return;

    const sanitizedPassword = password.trim().replace(/<[^>]*>/g, "");
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

    try {
      // Prefer real server-side authentication
      await loginRequest(sanitizedPassword);
      onLoginSuccess();
    } catch (err: any) {
      if (err?.status) {
        // Server responded: credentials rejected (no local fallback)
        fail("Clé d'accès incorrecte.");
      } else {
        // Server unreachable (offline / static hosting): legacy local check only
        if (DEMO_PASSWORDS.includes(sanitizedPassword)) {
          onLoginSuccess();
        } else {
          fail("Clé d'accès incorrecte.");
        }
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

  // Copy status indicators for different guide parts
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedStates((prev) => ({ ...prev, [id]: true }));
    setTimeout(() => {
      setCopiedStates((prev) => ({ ...prev, [id]: false }));
    }, 2000);
  };

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

  const sendToWebhook = async (productToSend: Product) => {
    const isWebhookConfigured =
      config.makeWebhookUrl &&
      config.makeWebhookUrl.trim() !== "" &&
      !config.makeWebhookUrl.includes("xxxxxxxxxxxxxxxxxxxxxxxx");

    if (!isWebhookConfigured) return;

    try {
      const response = await fetch(config.makeWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(productToSend),
        mode: "cors",
      });
      if (response.ok) {
        alert(`✅ Produit "${productToSend.title}" envoyé avec succès à votre Google Sheet via Make.com !`);
      } else {
        alert(`⚠️ Le webhook Make a répondu avec le statut ${response.status}. Vérifiez votre scénario.`);
      }
    } catch (err: any) {
      console.error("Error sending to webhook:", err);
      try {
        await fetch(config.makeWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(productToSend),
          mode: "no-cors",
        });
        alert("✅ Requête d'envoi transmise au Webhook Make (mode no-cors de secours).");
      } catch (subErr) {
        alert(`❌ Impossible d'envoyer au webhook Make.com : ${err.message || err}`);
      }
    }
  };

  // Append generated product to the catalog (local + server persistence + webhook)
  const addProductToCatalog = async () => {
    if (!generatedProduct) return;

    const productToSend = generatedProduct;
    setProducts((prev) => [productToSend, ...prev]);
    setGeneratedProduct(null);
    setActiveTab("catalog");

    // Persist to server (silent best-effort)
    saveProduct(productToSend).catch((err) => console.warn("Server persistence failed:", err));

    await sendToWebhook(productToSend);
  };

  const handleDeleteProduct = async (product: Product) => {
    setProducts((prev) => prev.filter((p) => p.id !== product.id));
    deleteProduct(product.id).catch((err) => console.warn("Server delete failed:", err));
  };

  const handleUpdateProduct = async (updated: Product) => {
    setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    saveProduct(updated).catch((err) => console.warn("Server update failed:", err));
  };

  const handleIncrementClicks = useCallback((product: Product) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, whatsappClicks: (p.whatsappClicks || 0) + 1 } : p))
    );
    incrementClicks(product.id);
  }, []);

  const handleExportCatalog = () => {
    const blob = new Blob([JSON.stringify(products, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "catalog.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
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
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#08080c] text-slate-100 font-sans" id="main-applet-root">
      <Header config={config} onConfigChange={setConfig} onLogout={handleLogout} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <TabNav activeTab={activeTab} onTabChange={setActiveTab} />
        <StatsBar products={products} config={config} markup={aiMarkup} />

        <div className="space-y-6">
          {activeTab === "catalog" && (
            <Catalog
              products={products}
              config={config}
              onIncrementClicks={handleIncrementClicks}
              onDeleteProduct={handleDeleteProduct}
              onUpdateProduct={handleUpdateProduct}
            />
          )}

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

          {activeTab === "make_guide" && <MakeGuide copiedStates={copiedStates} onCopy={handleCopyText} />}

          {activeTab === "whatsapp_script" && (
            <WhatsAppScriptPanel copiedStates={copiedStates} onCopy={handleCopyText} />
          )}

          {activeTab === "deployment" && (
            <DeploymentPanel products={products} onExportCatalog={handleExportCatalog} />
          )}
        </div>
      </main>

      <footer className="bg-[#0b0b10] border-t border-zinc-900 py-8 mt-12 text-center text-xs text-zinc-500 font-mono">
        <div className="max-w-7xl mx-auto px-4 space-y-1">
          <p>© 2026 BLACK MARKET SINO-PREP SYSTEM // KOREAN STREET STYLE</p>
          <p>Toutes les images et vidéos prévisualisées reçoivent le filigrane indélébile obligatoire.</p>
        </div>
      </footer>
    </div>
  );
}
