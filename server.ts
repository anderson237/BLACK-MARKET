import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Enable JSON bodies with higher limits for base64 image uploads
app.use(express.json({ limit: "15mb" }));

// ---------------------------------------------------------------------------
// CONFIG (env-driven, safe defaults)
// ---------------------------------------------------------------------------
const apiKey = process.env.GEMINI_API_KEY;
const adminPassword = process.env.ADMIN_PASSWORD || "ADMIN99";
const geminiModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const geminiFallbackModel = process.env.GEMINI_FALLBACK_MODEL || "gemini-2.5-flash-lite";

if (!process.env.ADMIN_PASSWORD) {
  console.warn(
    "[SECURITY] ADMIN_PASSWORD non défini -> mot de passe de démo 'ADMIN99' actif. Définissez-le dans .env avant toute mise en production."
  );
}
if (!apiKey) {
  console.warn("[WARN] GEMINI_API_KEY non définie -> l'endpoint IA renverra 503 tant qu'elle n'est pas configurée.");
}

// Initialize GoogleGenAI client (only if key exists to prevent crash on startup)
const ai: GoogleGenAI | null = apiKey
  ? new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { "User-Agent": "aistudio-build" } },
    })
  : null;

// ---------------------------------------------------------------------------
// DATA PERSISTENCE (JSON file on disk)
// ---------------------------------------------------------------------------
const DATA_DIR = path.join(process.cwd(), "data");
const PRODUCTS_FILE = path.join(DATA_DIR, "products.json");

async function loadProducts(): Promise<any[]> {
  try {
    const raw = await fs.promises.readFile(PRODUCTS_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveProducts(products: any[]): Promise<void> {
  await fs.promises.mkdir(DATA_DIR, { recursive: true });
  await fs.promises.writeFile(PRODUCTS_FILE, JSON.stringify(products, null, 2), "utf-8");
}

function sanitizeProduct(body: any): any {
  const clean = (v: unknown) => String(v ?? "").slice(0, 4000);
  return {
    ...body,
    title: clean(body?.title),
    description: clean(body?.description),
    originalDescription: clean(body?.originalDescription),
    chineseDescription: clean(body?.chineseDescription),
    chineseTitle: clean(body?.chineseTitle),
    imageUrl: clean(body?.imageUrl),
    videoUrl: body?.videoUrl ? clean(body.videoUrl) : undefined,
    category: clean(body?.category),
    id: clean(body?.id),
    features: Array.isArray(body?.features)
      ? body.features.slice(0, 12).map((f: unknown) => clean(f))
      : [],
    priceEur: Number(body?.priceEur) || 0,
    priceXof: Number(body?.priceXof) || 0,
    sourceRmb: body?.sourceRmb ? Number(body.sourceRmb) : undefined,
    whatsappClicks: Number(body?.whatsappClicks) || 0,
    createdAt: clean(body?.createdAt) || new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// AUTH (in-memory bearer tokens)
// ---------------------------------------------------------------------------
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const sessions = new Map<string, number>(); // token -> expiry

function extractToken(req: express.Request): string {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = extractToken(req);
  const expiry = sessions.get(token);
  if (!expiry || expiry < Date.now()) {
    if (expiry) sessions.delete(token);
    return res.status(401).json({ error: "Session invalide ou expirée. Veuillez vous reconnecter." });
  }
  next();
}

// ---------------------------------------------------------------------------
// RATE LIMITING (simple in-memory, per IP)
// ---------------------------------------------------------------------------
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function rateLimit(maxRequests: number, windowMs: number) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    let bucket = rateBuckets.get(ip);
    if (!bucket || bucket.resetAt < now) {
      bucket = { count: 0, resetAt: now + windowMs };
      rateBuckets.set(ip, bucket);
    }
    bucket.count += 1;
    if (bucket.count > maxRequests) {
      return res.status(429).json({ error: "Trop de requêtes. Veuillez patienter quelques secondes." });
    }
    next();
  };
}

// Periodically flush expired rate buckets
setInterval(() => {
  const now = Date.now();
  for (const [ip, bucket] of rateBuckets) {
    if (bucket.resetAt < now) rateBuckets.delete(ip);
  }
}, 60_000).unref?.();

// ---------------------------------------------------------------------------
// AUTH ENDPOINTS
// ---------------------------------------------------------------------------
app.post("/api/auth/login", rateLimit(6, 60_000), (req, res) => {
  const password = typeof req.body?.password === "string" ? req.body.password.trim() : "";
  if (!password) {
    return res.status(400).json({ error: "Veuillez saisir la clé d'accès." });
  }
  if (password === adminPassword) {
    const token = crypto.randomBytes(32).toString("hex");
    sessions.set(token, Date.now() + SESSION_TTL_MS);
    return res.json({ success: true, token, expiresIn: SESSION_TTL_MS });
  }
  return res.status(401).json({ error: "Clé d'accès incorrecte." });
});

app.post("/api/auth/logout", (req, res) => {
  const token = extractToken(req);
  if (token) sessions.delete(token);
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// PRODUCTS CRUD (protected)
// ---------------------------------------------------------------------------
app.get("/api/products", requireAuth, async (_req, res) => {
  const products = await loadProducts();
  res.json({ success: true, products });
});

app.post("/api/products", requireAuth, rateLimit(60, 60_000), async (req, res) => {
  const product = sanitizeProduct(req.body);
  if (!product.title) {
    return res.status(400).json({ error: "Le produit doit avoir un titre." });
  }
  const products = await loadProducts();
  const idx = products.findIndex((p) => p.id === product.id);
  if (idx >= 0) products[idx] = product;
  else products.unshift(product);
  await saveProducts(products);
  res.json({ success: true });
});

app.put("/api/products", requireAuth, rateLimit(30, 60_000), async (req, res) => {
  if (!Array.isArray(req.body)) {
    return res.status(400).json({ error: "Le corps doit être un tableau de produits." });
  }
  const products = req.body.map(sanitizeProduct);
  await saveProducts(products);
  res.json({ success: true });
});

app.delete("/api/products/:id", requireAuth, async (req, res) => {
  const products = await loadProducts();
  const next = products.filter((p) => p.id !== req.params.id);
  if (next.length === products.length) {
    return res.status(404).json({ error: "Produit introuvable." });
  }
  await saveProducts(next);
  res.json({ success: true });
});

app.post("/api/products/:id/clicks", rateLimit(120, 60_000), async (req, res) => {
  const products = await loadProducts();
  const idx = products.findIndex((p) => p.id === req.params.id);
  if (idx < 0) {
    return res.status(404).json({ error: "Produit introuvable." });
  }
  products[idx] = { ...products[idx], whatsappClicks: (Number(products[idx].whatsappClicks) || 0) + 1 };
  await saveProducts(products);
  res.json({ success: true, whatsappClicks: products[idx].whatsappClicks });
});

// Public catalog JSON consumed by the static client template (GitHub Pages flow)
app.get("/catalog.json", async (_req, res) => {
  const products = await loadProducts();
  res.setHeader("Cache-Control", "no-store");
  res.json(products.length ? products : []);
});

// ---------------------------------------------------------------------------
// GEMINI AI: translate / copywriting / pricing
// ---------------------------------------------------------------------------
async function generateContentWithRetry(
  ai: GoogleGenAI,
  params: { model: string; contents: any; config?: any },
  fallbackModel: string,
  retries = 3,
  delayMs = 1500
): Promise<any> {
  let lastError: any = null;
  const modelsToTry = [params.model, fallbackModel];

  for (const model of modelsToTry) {
    let currentDelay = delayMs;
    const attemptParams = { ...params, model };

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        console.log(`Calling Gemini API using model: ${model} (Attempt ${attempt + 1}/${retries})...`);
        return await ai.models.generateContent(attemptParams);
      } catch (error: any) {
        lastError = error;
        const errorString = JSON.stringify(error) + " " + (error.message || "");
        const isTemporary =
          errorString.includes("503") ||
          errorString.includes("UNAVAILABLE") ||
          errorString.includes("demand") ||
          error.status === 503;

        if (isTemporary && attempt < retries - 1) {
          console.warn(`Gemini API returned 503 (temporary high demand) for model ${model}. Retrying in ${currentDelay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, currentDelay));
          currentDelay *= 2; // Exponential backoff
          continue;
        }

        // Non-temporary error, or retries exhausted: try the next model
        break;
      }
    }
  }

  throw lastError || new Error("Failed to generate content after trying multiple models and retries.");
}

app.post("/api/translate-product", rateLimit(10, 60_000), async (req, res) => {
  try {
    if (!apiKey || !ai) {
      return res.status(503).json({
        error: "Le service d'IA n'est pas configuré. Veuillez ajouter votre clé API GEMINI_API_KEY dans le fichier .env / Secrets.",
      });
    }

    const { chineseDescription, imageBase64, imageMimeType, customMarkup, basePriceRmb } = req.body;

    if (!chineseDescription && !imageBase64) {
      return res.status(400).json({
        error: "Veuillez fournir une description en chinois ou une image de produit.",
      });
    }

    const contents: any[] = [];

    if (imageBase64) {
      const mime = imageMimeType || "image/jpeg";
      contents.push({
        inlineData: { mimeType: mime, data: String(imageBase64) },
      });
    }

    const markup = Number(customMarkup) > 0 ? Number(customMarkup) : 60;
    const rmb = Number(basePriceRmb) > 0 ? Number(basePriceRmb) : null;

    let textPrompt = "Analyse ce produit chinois.";
    if (chineseDescription) {
      textPrompt += ` Voici la description textuelle fournie : "${String(chineseDescription)}".`;
    }

    textPrompt += `
Tu es un copywriter d'élite et expert en sourcing de produits en Chine.
Fais le travail suivant :
1. Extrais et traduis tout texte écrit sur l'image (le cas échéant) et traduis la description de chinois à français de manière claire et précise.
2. Crée un Titre produit accrocheur en français, adapté au marché francophone.
3. Rédige un Argumentaire de vente premium en français (Copywriting captivant, orienté bénéfices clients, ton enthousiaste mais crédible).
4. Extrais 3 à 5 caractéristiques techniques ou points forts clés (Features).
5. Suggère un prix de vente en EUR et XOF. ${rmb ? `Prix d'achat de base en RMB fourni : ${rmb} yuan. Convertis-le (taux 1 RMB ≈ 85 XOF ≈ 0.13 EUR) et applique un multiplicateur d'importation réaliste (marge de ${markup}% + frais d'envoi 5-10€ / 3000-6000 XOF).` : "Aucun prix d'achat fourni : estime un prix de détail réaliste pour ce produit importé sur le marché francophone/africain."}

Tu dois impérativement renvoyer la réponse au format JSON conforme au schéma demandé.
`;

    contents.push({ text: textPrompt });

    const response = await generateContentWithRetry(
      ai,
      {
        model: geminiModel,
        contents,
        config: {
          systemInstruction:
            "Tu es un assistant de commerce international No-Code spécialisé dans le sourcing de produits en Chine (Taobao, 1688, WeChat) et le copywriting e-commerce de précommande.",
          temperature: 0.7,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              translatedTitle: { type: Type.STRING, description: "Titre commercial accrocheur et élégant en Français." },
              translatedDescription: { type: Type.STRING, description: "Traduction claire et fidèle des détails/spécificités d'origine en Français." },
              salesPitch: { type: Type.STRING, description: "Argumentaire de vente captivant et structuré en Français (Copywriting e-commerce)." },
              features: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3 à 5 caractéristiques clés ou bénéfices majeurs du produit." },
              priceEur: { type: Type.NUMBER, description: "Prix de vente public suggéré en Euros (EUR)." },
              priceXof: { type: Type.NUMBER, description: "Prix de vente public suggéré en Francs CFA (XOF)." },
              priceExplanation: { type: Type.STRING, description: "Explication courte du calcul de prix (conversion, marge, frais d'envoi)." },
            },
            required: ["translatedTitle", "translatedDescription", "salesPitch", "features", "priceEur", "priceXof"],
          },
        },
      },
      geminiFallbackModel
    );

    const resultText = response.text || "{}";
    let resultJson: any;
    try {
      resultJson = JSON.parse(resultText);
    } catch {
      return res.status(502).json({ error: "Réponse de l'IA au format invalide. Veuillez réessayer." });
    }

    // Coerce types defensively before returning
    const data = {
      ...resultJson,
      translatedTitle: String(resultJson.translatedTitle || "").slice(0, 200),
      translatedDescription: String(resultJson.translatedDescription || ""),
      salesPitch: String(resultJson.salesPitch || ""),
      features: Array.isArray(resultJson.features) ? resultJson.features.slice(0, 8).map((f: unknown) => String(f)) : [],
      priceEur: Number(resultJson.priceEur) || 0,
      priceXof: Number(resultJson.priceXof) || 0,
      priceExplanation: String(resultJson.priceExplanation || ""),
    };

    return res.json({ success: true, data });
  } catch (error: any) {
    console.error("Gemini Translation Error:", error);
    return res.status(500).json({
      error: error.message || "Une erreur est survenue lors de la traduction par l'IA.",
    });
  }
});

// ---------------------------------------------------------------------------
// Static serving (dev via Vite middleware, prod via dist)
// ---------------------------------------------------------------------------
async function setupServer() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in development mode with Vite middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in production mode...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

setupServer();
