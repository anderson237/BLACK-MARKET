import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import dotenv from "dotenv";
import { getStore } from "@netlify/blobs";
import { GoogleGenAI, Type } from "@google/genai";
import { INITIAL_PRODUCTS } from "./data";
import { getProductPageHtml } from "./lib/productPage";

dotenv.config();

export function createApp() {
  const app = express();

  const PUBLIC_BASE_URL = "https://blackmarket-import-export.netlify.app/";
  const PHONE_NUMBER = "237683963007";

  // Enable JSON bodies with higher limits for base64 image uploads
  app.use(express.json({ limit: "15mb" }));

  // Trust Netlify's proxy headers so req.ip reflects the real client IP
  // (required for accurate per-IP rate limiting behind the CDN / load balancer).
  app.set("trust proxy", true);
  app.disable("x-powered-by");

  // ---------------------------------------------------------------------------
  // SECURITY HEADERS (defense in depth: harden every response)
  // ---------------------------------------------------------------------------
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    // A permissive-but-safe CSP. Inline styles/scripts are allowed because the
    // generated client pages and React bundles rely on them; we still block
    // third-party framing, plugin-src and object-src (flash/java).
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; img-src 'self' data: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https:; connect-src 'self' https:; font-src 'self' data: https:; frame-ancestors 'none'; object-src 'none'; base-uri 'self'"
    );
    next();
  });

  // CORS / CSRF defense-in-depth: only same-origin callers may use the API.
  // Bearer tokens already make cross-origin calls harmless (Authorization is a
  // non-simple header => browsers block it without preflight), but we also
  // reject requests whose Origin does not match our own host.
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      let originHost = origin;
      try {
        originHost = new URL(origin).host;
      } catch {
        // invalid origin -> treat as untrusted
        return res.status(403).json({ error: "Origine non autorisée." });
      }
      const host = req.headers.host || "";
      if (originHost !== host) {
        return res.status(403).json({ error: "Origine non autorisée." });
      }
    }
    next();
  });

  // ---------------------------------------------------------------------------
  // CONFIG (env-driven, safe defaults)
  // ---------------------------------------------------------------------------
  const apiKey = process.env.GEMINI_API_KEY;
  const adminPassword = process.env.ADMIN_PASSWORD || "ADMIN99";
  const adminEmails = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || "elomopatrick.pn@gmail.com")
    .toLowerCase()
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const googleClientId = process.env.GOOGLE_CLIENT_ID || "";
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
  // DATA PERSISTENCE (Netlify Blobs in production, JSON file on disk locally)
  // ---------------------------------------------------------------------------
  const DATA_DIR = path.join(process.cwd(), "data");
  const PRODUCTS_FILE = path.join(DATA_DIR, "products.json");
  const ORDERS_FILE = path.join(DATA_DIR, "orders.json");
  const USERS_FILE = path.join(DATA_DIR, "users.json");
  const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
  const BLOBS_STORE_NAME = "bm-products";
  const BLOBS_KEY = "products.json";
  const BLOBS_IMG_STORE = "bm-images";
  const BLOBS_VIDEO_STORE = "bm-videos";
  const BLOBS_ORDERS_STORE = "bm-orders";
  const BLOBS_ORDERS_KEY = "orders.json";
  const BLOBS_USERS_STORE = "bm-users";
  const BLOBS_USERS_KEY = "users.json";

  async function saveImage(id: string, buffer: Buffer): Promise<void> {
    if (isNetlifyRuntime()) {
      const store = getStore({ name: BLOBS_IMG_STORE });
      await store.set(id + ".jpg", buffer);
      return;
    }
    await fs.promises.mkdir(UPLOADS_DIR, { recursive: true });
    await fs.promises.writeFile(path.join(UPLOADS_DIR, id + ".jpg"), buffer);
  }

  async function loadImage(id: string): Promise<Buffer | null> {
    if (isNetlifyRuntime()) {
      try {
        const store = getStore({ name: BLOBS_IMG_STORE });
        const data = await store.get(id + ".jpg", { type: "arrayBuffer" });
        if (data) return Buffer.from(data);
      } catch (err) {
        console.error("[BLOBS] image read failed:", err);
      }
      return null;
    }
    try {
      return await fs.promises.readFile(path.join(UPLOADS_DIR, id + ".jpg"));
    } catch {
      return null;
    }
  }

  async function saveVideo(id: string, buffer: Buffer): Promise<void> {
    if (isNetlifyRuntime()) {
      const store = getStore({ name: BLOBS_VIDEO_STORE });
      await store.set(id + ".mp4", buffer);
      return;
    }
    await fs.promises.mkdir(UPLOADS_DIR, { recursive: true });
    await fs.promises.writeFile(path.join(UPLOADS_DIR, id + ".mp4"), buffer);
  }

  async function loadVideo(id: string): Promise<Buffer | null> {
    if (isNetlifyRuntime()) {
      try {
        const store = getStore({ name: BLOBS_VIDEO_STORE });
        const data = await store.get(id + ".mp4", { type: "arrayBuffer" });
        if (data) return Buffer.from(data);
      } catch (err) {
        console.error("[BLOBS] video read failed:", err);
      }
      return null;
    }
    try {
      return await fs.promises.readFile(path.join(UPLOADS_DIR, id + ".mp4"));
    } catch {
      return null;
    }
  }

  function isNetlifyRuntime(): boolean {
    return Boolean(process.env.NETLIFY) || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);
  }

  async function loadProducts(): Promise<any[]> {
    if (isNetlifyRuntime()) {
      try {
        const store = getStore({ name: BLOBS_STORE_NAME });
        const raw = await store.get(BLOBS_KEY, { type: "text" });
        if (raw != null) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) return parsed;
        }
        const seed = JSON.parse(JSON.stringify(INITIAL_PRODUCTS));
        await store.set(BLOBS_KEY, JSON.stringify(seed, null, 2));
        return seed;
      } catch (err) {
        console.error("[BLOBS] load failed, falling back to seed:", err);
        return JSON.parse(JSON.stringify(INITIAL_PRODUCTS));
      }
    }
    try {
      const raw = await fs.promises.readFile(PRODUCTS_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async function saveProducts(products: any[]): Promise<void> {
    if (isNetlifyRuntime()) {
      const store = getStore({ name: BLOBS_STORE_NAME });
      await store.set(BLOBS_KEY, JSON.stringify(products, null, 2));
      return;
    }
    await fs.promises.mkdir(DATA_DIR, { recursive: true });
    await fs.promises.writeFile(PRODUCTS_FILE, JSON.stringify(products, null, 2), "utf-8");
  }

  async function loadOrders(): Promise<any[]> {
    if (isNetlifyRuntime()) {
      try {
        const store = getStore({ name: BLOBS_ORDERS_STORE });
        const raw = await store.get(BLOBS_ORDERS_KEY, { type: "text" });
        if (raw != null) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) return parsed;
        }
        return [];
      } catch (err) {
        console.error("[BLOBS] orders load failed:", err);
        return [];
      }
    }
    try {
      const raw = await fs.promises.readFile(ORDERS_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async function saveOrders(orders: any[]): Promise<void> {
    if (isNetlifyRuntime()) {
      const store = getStore({ name: BLOBS_ORDERS_STORE });
      await store.set(BLOBS_ORDERS_KEY, JSON.stringify(orders, null, 2));
      return;
    }
    await fs.promises.mkdir(DATA_DIR, { recursive: true });
    await fs.promises.writeFile(ORDERS_FILE, JSON.stringify(orders, null, 2), "utf-8");
  }

  // Users: { admins: string[], logins: { email, name, picture, loggedInAt }[] }
  const OWNER_EMAIL = adminEmails[0] || "";

  async function loadUsers(): Promise<{ admins: string[]; logins: any[] }> {
    const seed = () => ({
      admins: Array.from(new Set([...adminEmails])),
      logins: [] as any[],
    });
    if (isNetlifyRuntime()) {
      try {
        const store = getStore({ name: BLOBS_USERS_STORE });
        const raw = await store.get(BLOBS_USERS_KEY, { type: "text" });
        if (raw != null) {
          const parsed = JSON.parse(raw);
          if (parsed && Array.isArray(parsed.logins) && Array.isArray(parsed.admins)) {
            return parsed;
          }
        }
        const initial = seed();
        await store.set(BLOBS_USERS_KEY, JSON.stringify(initial, null, 2));
        return initial;
      } catch (err) {
        console.error("[BLOBS] users load failed:", err);
        return seed();
      }
    }
    try {
      const raw = await fs.promises.readFile(USERS_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.logins) && Array.isArray(parsed.admins)) return parsed;
      return seed();
    } catch {
      return seed();
    }
  }

  async function saveUsers(users: { admins: string[]; logins: any[] }): Promise<void> {
    if (isNetlifyRuntime()) {
      const store = getStore({ name: BLOBS_USERS_STORE });
      await store.set(BLOBS_USERS_KEY, JSON.stringify(users, null, 2));
      return;
    }
    await fs.promises.mkdir(DATA_DIR, { recursive: true });
    await fs.promises.writeFile(USERS_FILE, JSON.stringify(users, null, 2), "utf-8");
  }

  async function recordLogin(email: string, name: string, picture: string): Promise<void> {
    const users = await loadUsers();
    const existing = users.logins.find((l) => l.email === email);
    const entry = { email, name: name || email, picture: picture || "", loggedInAt: new Date().toISOString() };
    if (existing) {
      existing.name = entry.name;
      existing.picture = entry.picture;
      existing.loggedInAt = entry.loggedInAt;
    } else {
      users.logins.unshift(entry);
    }
    users.logins = users.logins.slice(0, 200);
    await saveUsers(users);
  }

  function sanitizeProduct(body: any): any {
    const clean = (v: unknown) => String(v ?? "").slice(0, 4000);
    const id = clean(body?.id);
    // Restrict IDs to a safe charset to avoid path/HTML injection via IDs.
    const safeId = /^[a-zA-Z0-9_-]+$/.test(id) ? id : "";
    return {
      ...body,
      id: safeId,
      title: clean(body?.title),
      description: clean(body?.description),
      originalDescription: clean(body?.originalDescription),
      chineseDescription: clean(body?.chineseDescription),
      chineseTitle: clean(body?.chineseTitle),
      imageUrl: clean(body?.imageUrl),
      gallery: Array.isArray(body?.gallery)
        ? body.gallery.slice(0, 12).map((u: unknown) => clean(u)).filter(Boolean)
        : [],
      videoUrl: body?.videoUrl ? clean(body.videoUrl) : undefined,
      category: clean(body?.category),
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

  // Validate the magic bytes so we never store arbitrary binary content
  // (prevents using the upload endpoint as a free hosting/malware proxy).
  const IMAGE_SIGNATURES: { magic: number[]; offset: number }[] = [
    { magic: [0xff, 0xd8, 0xff], offset: 0 }, // JPEG
    { magic: [0x89, 0x50, 0x4e, 0x47], offset: 0 }, // PNG
    { magic: [0x47, 0x49, 0x46, 0x38], offset: 0 }, // GIF
    { magic: [0x52, 0x49, 0x46, 0x46], offset: 0 }, // WEBP (RIFF....WEBP)
    { magic: [0x42, 0x4d], offset: 0 }, // BMP
  ];
  function looksLikeImage(buffer: Buffer): boolean {
    for (const { magic, offset } of IMAGE_SIGNATURES) {
      if (buffer.length >= offset + magic.length) {
        let ok = true;
        for (let i = 0; i < magic.length; i++) {
          if (buffer[offset + i] !== magic[i]) { ok = false; break; }
        }
        if (ok) return true;
      }
    }
    return false;
  }

  // Validate MP4 (ftyp), WebM/Matroska (EBML), QuickTime (ftypqt), MOV.
  function looksLikeVideo(buffer: Buffer): boolean {
    if (buffer.length < 12) return false;
    // MP4 / QuickTime: offset 4 = "ftyp"
    const ascii = (from: number, len: number) =>
      buffer.slice(from, from + len).toString("latin1");
    if (ascii(4, 4) === "ftyp") {
      const brand = ascii(8, 4).toLowerCase();
      return /^(isom|mp4|avc1|qt|heic|m4v|3gp)/.test(brand);
    }
    // WebM / MKV: EBML header 1A 45 DF A3
    if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
      return buffer.toString("latin1").includes("webm") || buffer.toString("latin1").includes("matroska");
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  // AUTH (signed stateless bearer tokens)
  //
  // The token is an HMAC-signed payload (email, name, picture, exp). Because it
  // is self-contained, it survives the serverless cold starts that wiped the
  // old in-memory Map and caused "Session invalide ou expirée" errors.
  //
  // The HMAC secret is PERSISTED in the blob store (key "session-secret") so it
  // survives redeploys and env-var changes. If ADMIN_PASSWORD ever changed, the
  // old fallback secret would invalidate every active token; persisting a
  // dedicated secret fixes that permanently.
  // ---------------------------------------------------------------------------
  const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

  async function getSessionSecret(): Promise<string> {
    const envSecret = process.env.SESSION_SECRET;
    if (envSecret) return envSecret;
    try {
      if (isNetlifyRuntime()) {
        const store = getStore({ name: BLOBS_STORE_NAME });
        const raw = await store.get("session-secret", { type: "text" });
        if (raw) return raw;
        const generated = crypto.randomBytes(32).toString("hex");
        await store.set("session-secret", generated);
        return generated;
      }
      const file = path.join(DATA_DIR, "session-secret");
      try {
        const existing = await fs.promises.readFile(file, "utf-8");
        if (existing.trim()) return existing.trim();
      } catch {
        // file does not exist yet
      }
      const generated = crypto.randomBytes(32).toString("hex");
      await fs.promises.mkdir(DATA_DIR, { recursive: true });
      await fs.promises.writeFile(file, generated, "utf-8");
      return generated;
    } catch {
      // Blob layer unavailable: fall back to a stable-enough derivation that does
      // not break existing sessions when ADMIN_PASSWORD is unchanged.
      return process.env.ADMIN_PASSWORD || "bm-dev-session-secret";
    }
  }

  let sessionSecretPromise: Promise<string> | null = null;
  function sessionSecret(): Promise<string> {
    if (!sessionSecretPromise) sessionSecretPromise = getSessionSecret();
    return sessionSecretPromise;
  }

  async function signToken(payload: { email?: string; name?: string; picture?: string; exp: number }): Promise<string> {
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const secret = await sessionSecret();
    const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
    return `${body}.${sig}`;
  }

  async function verifyToken(token: string): Promise<{ email?: string; name?: string; picture?: string; exp: number } | null> {
    try {
      const [body, sig] = token.split(".");
      if (!body || !sig) return null;
      const secret = await sessionSecret();
      const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url");
      const a = Buffer.from(sig);
      const b = Buffer.from(expected);
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
      const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
      if (!payload || typeof payload.exp !== "number") return null;
      return payload;
    } catch {
      return null;
    }
  }

  // Small in-memory denylist (best-effort) so logout still revokes the token
  // within a single function instance; expired entries are pruned lazily.
  const revokedTokens = new Map<string, number>(); // token -> expiresAt

  // Constant-time comparison to avoid leaking password length/timing via timing attacks.
  function safeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(String(a));
    const bufB = Buffer.from(String(b));
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  }

  function extractToken(req: express.Request): string {
    const header = req.headers.authorization || "";
    return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  }

  async function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
    const token = extractToken(req);
    const revokedAt = revokedTokens.get(token);
    if (revokedAt && revokedAt > Date.now()) {
      return res.status(401).json({ error: "Session invalide ou expirée. Veuillez vous reconnecter." });
    }
    if (revokedAt) revokedTokens.delete(token);
    const session = await verifyToken(token);
    if (!session || session.exp < Date.now()) {
      return res.status(401).json({ error: "Session invalide ou expirée. Veuillez vous reconnecter." });
    }
    (res as any).locals.session = session;
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
  app.post("/api/auth/login", rateLimit(6, 60_000), async (req, res) => {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body?.password === "string" ? req.body.password.trim() : "";
    if (!password) {
      return res.status(400).json({ error: "Veuillez saisir la clé d'accès." });
    }
    if (email && !adminEmails.includes(email)) {
      return res.status(401).json({ error: "Email administrateur non reconnu." });
    }
    if (safeEqual(password, adminPassword)) {
      const token = await signToken({ email: email || undefined, exp: Date.now() + SESSION_TTL_MS });
      return res.json({ success: true, token, expiresIn: SESSION_TTL_MS });
    }
    return res.status(401).json({ error: "Clé d'accès incorrecte." });
  });

  app.post("/api/auth/google", rateLimit(10, 60_000), async (req, res) => {
    try {
      const credential = typeof req.body?.credential === "string" ? req.body.credential.trim() : "";
      if (!credential) {
        return res.status(400).json({ error: "Jeton Google manquant." });
      }
      const infoRes = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`,
        { signal: AbortSignal.timeout(15000) }
      );
      if (!infoRes.ok) {
        return res.status(401).json({ error: "Jeton Google invalide." });
      }
      const info: any = await infoRes.json();
      if (!info || info.error) {
        return res.status(401).json({ error: "Jeton Google invalide." });
      }
      if (googleClientId && info.aud && info.aud !== googleClientId) {
        return res.status(401).json({ error: "Jeton émis pour une autre application." });
      }
      if (info.email_verified !== "true" && info.email_verified !== true) {
        return res.status(401).json({ error: "Email non vérifié." });
      }
      const email = String(info.email || "").toLowerCase();
      const name = String(info.name || email);
      const picture = String(info.picture || "");

      // Google sign-in is restricted to declared admins (env) OR admins promoted
      // through the Users manager (persisted). Everyone else is refused.
      const users = await loadUsers();
      const isAllowedAdmin = users.admins.includes(email);
      if (!isAllowedAdmin) {
        return res.status(401).json({ error: "Email non reconnu comme administrateur." });
      }
      await recordLogin(email, name, picture);
      const token = await signToken({ email, name, picture, exp: Date.now() + SESSION_TTL_MS });
      return res.json({ success: true, token, email, name, picture, expiresIn: SESSION_TTL_MS });
    } catch (err: any) {
      console.error("Google auth error:", err);
      return res.status(500).json({ error: "Erreur lors de la vérification Google." });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    const token = extractToken(req);
    if (token) revokedTokens.set(token, Date.now() + SESSION_TTL_MS);
    res.json({ success: true });
  });

  // ---------------------------------------------------------------------------
  // USERS MANAGEMENT (list Gmail sign-ins, promote/demote admins)
  // ---------------------------------------------------------------------------
  app.get("/api/users", requireAuth, async (_req, res) => {
    const users = await loadUsers();
    const session = (res as any).locals.session as { email?: string } | undefined;
    res.json({
      success: true,
      users: {
        owner: OWNER_EMAIL,
        admins: users.admins,
        currentEmail: session?.email || "",
        logins: users.logins,
      },
    });
  });

  app.put("/api/users/admins", requireAuth, rateLimit(10, 60_000), async (req, res) => {
    const session = (res as any).locals.session as { email?: string } | undefined;
    const caller = String(session?.email || "").toLowerCase();
    // Only the owner may promote/demote admins.
    if (!caller || caller !== OWNER_EMAIL) {
      return res.status(403).json({ error: "Seul le propriétaire peut gérer les administrateurs." });
    }
    const emails = Array.isArray(req.body?.emails)
      ? req.body.emails.map((e: unknown) => String(e).trim().toLowerCase()).filter(Boolean)
      : [];
    const next = Array.from(new Set([OWNER_EMAIL, ...emails]));
    const users = await loadUsers();
    users.admins = next;
    await saveUsers(users);
    res.json({ success: true, admins: next });
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
    if (!product.id) {
      return res.status(400).json({ error: "Identifiant produit manquant ou invalide (alphanumérique, tirets et underscores uniquement)." });
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
    if (req.body.length > 500) {
      return res.status(400).json({ error: "Trop de produits dans une seule requête (max 500)." });
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

  // ---------------------------------------------------------------------------
  // ORDERS (protected CRUD) + AGGREGATED STATS for the admin dashboard
  // ---------------------------------------------------------------------------
  app.get("/api/orders", requireAuth, async (_req, res) => {
    const orders = await loadOrders();
    res.json({ success: true, orders });
  });

  app.post("/api/orders", requireAuth, rateLimit(30, 60_000), async (req, res) => {
    const body = req.body || {};
    const id = String(body.id || `ord_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
    const order = {
      id,
      productId: String(body.productId || ""),
      productTitle: String(body.productTitle || "").slice(0, 200),
      productImage: String(body.productImage || ""),
      customerName: String(body.customerName || "Client WhatsApp").slice(0, 120),
      customerPhone: String(body.customerPhone || "").slice(0, 40),
      customerLocation: String(body.customerLocation || "—").slice(0, 120),
      quantity: Math.max(1, Number(body.quantity) || 1),
      priceXof: Number(body.priceXof) || 0,
      priceEur: Number(body.priceEur) || 0,
      status: ["pending", "processing", "completed", "shipped", "cancelled"].includes(body.status)
        ? body.status
        : "pending",
      createdAt: String(body.createdAt || new Date().toISOString()),
    };
    const orders = await loadOrders();
    const idx = orders.findIndex((o) => o.id === id);
    if (idx >= 0) orders[idx] = order;
    else orders.unshift(order);
    await saveOrders(orders);
    res.json({ success: true, order });
  });

  app.put("/api/orders/:id", requireAuth, rateLimit(30, 60_000), async (req, res) => {
    const orders = await loadOrders();
    const idx = orders.findIndex((o) => o.id === req.params.id);
    if (idx < 0) return res.status(404).json({ error: "Commande introuvable." });
    const body = req.body || {};
    const next = { ...orders[idx] };
    if (body.status && ["pending", "processing", "completed", "shipped", "cancelled"].includes(body.status)) {
      next.status = body.status;
    }
    if (body.customerName) next.customerName = String(body.customerName).slice(0, 120);
    if (body.customerPhone) next.customerPhone = String(body.customerPhone).slice(0, 40);
    if (body.customerLocation) next.customerLocation = String(body.customerLocation).slice(0, 120);
    if (body.quantity) next.quantity = Math.max(1, Number(body.quantity) || 1);
    orders[idx] = next;
    await saveOrders(orders);
    res.json({ success: true, order: next });
  });

  app.delete("/api/orders/:id", requireAuth, async (req, res) => {
    const orders = await loadOrders();
    const next = orders.filter((o) => o.id !== req.params.id);
    if (next.length === orders.length) return res.status(404).json({ error: "Commande introuvable." });
    await saveOrders(next);
    res.json({ success: true });
  });

  // ---------------------------------------------------------------------------
  // PUBLIC LEAD CAPTURE (client site -> real order data in the admin dashboard)
  // A visitor clicking "PRÉCOMMANDER" creates a pending order (lead) that the
  // admin can complete with the customer's real details from WhatsApp.
  // ---------------------------------------------------------------------------
  app.post("/api/lead", rateLimit(30, 60_000), async (req, res) => {
    const productId = String(req.body?.productId || "");
    const quantity = Math.max(1, Number(req.body?.quantity) || 1);
    if (!productId) return res.status(400).json({ error: "Identifiant produit manquant." });

    const products = await loadProducts();
    const p = products.find((pp) => pp.id === productId);
    if (!p) return res.status(404).json({ error: "Produit introuvable." });

    // Increment the product's click counter (feeds top products / total clicks)
    products[products.findIndex((pp) => pp.id === productId)] = {
      ...p,
      whatsappClicks: (Number(p.whatsappClicks) || 0) + 1,
    };
    await saveProducts(products);

    const order = {
      id: `ord_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      productId: p.id,
      productTitle: String(p.title || "").slice(0, 200),
      productImage: String(p.imageUrl || ""),
      customerName: "Nouveau lead WhatsApp",
      customerPhone: "",
      customerLocation: "À confirmer",
      quantity,
      priceXof: Number(p.priceXof) || 0,
      priceEur: Number(p.priceEur) || 0,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    const orders = await loadOrders();
    orders.unshift(order);
    await saveOrders(orders);
    res.json({ success: true, order });
  });

  // ---------------------------------------------------------------------------
  // DYNAMIC PRODUCT PAGES (client site) — rendered live from the catalog so new
  // products added in the admin get a shareable /p/<id>.html page immediately,
  // with current price / description / WhatsApp number.
  // ---------------------------------------------------------------------------
  app.get(["/p/:id", "/p/:id.html"], async (req, res) => {
    const id = String(req.params.id || "").replace(/\.html$/i, "");
    if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
      return res.status(404).send("Produit introuvable.");
    }
    const products = await loadProducts();
    const p = products.find((pp) => pp.id === id);
    if (!p) {
      return res.status(404).send("Produit introuvable.");
    }
    // The local watermarked copy img/<id>.jpg only exists for the products baked
    // into the static build. Prefer the live stored image URL whenever the admin
    // changed/uploaded/AI-generated a new image (it is already watermarked
    // client-side), otherwise fall back to the static watermarked copy.
    const seedProduct = INITIAL_PRODUCTS.find((pp) => pp.id === p.id);
    const imageChanged = !seedProduct || String(seedProduct.imageUrl) !== String(p.imageUrl);
    const html = getProductPageHtml(p, PUBLIC_BASE_URL, PHONE_NUMBER, {
      ogImage: imageChanged ? p.imageUrl : undefined,
      useLiveImage: imageChanged,
    });
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=300");
    res.send(html);
  });

  app.get("/api/stats", requireAuth, async (_req, res) => {
    const [products, orders] = await Promise.all([loadProducts(), loadOrders()]);
    const totalClicks = products.reduce((s: number, p: any) => s + (Number(p.whatsappClicks) || 0), 0);
    const totalRevenueXof = orders.reduce((s: number, o: any) => s + (Number(o.priceXof) || 0) * (Number(o.quantity) || 1), 0);
    const totalRevenueEur = orders.reduce((s: number, o: any) => s + (Number(o.priceEur) || 0) * (Number(o.quantity) || 1), 0);

    const salesByCategory: Record<string, number> = {};
    orders.forEach((o: any) => {
      const p = products.find((pp: any) => pp.id === o.productId);
      const cat = (p?.category || "Autres") as string;
      salesByCategory[cat] = (salesByCategory[cat] || 0) + 1;
    });

    const revenueSeries = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const key = d.toISOString().slice(0, 10);
      const dayOrders = orders.filter((o: any) => (o.createdAt || "").slice(0, 10) === key);
      const label = d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
      return {
        label,
        revenueXof: dayOrders.reduce((s: number, o: any) => s + (Number(o.priceXof) || 0) * (Number(o.quantity) || 1), 0),
        revenueEur: dayOrders.reduce((s: number, o: any) => s + (Number(o.priceEur) || 0) * (Number(o.quantity) || 1), 0),
        orders: dayOrders.length,
      };
    });

    const topProducts = products
      .map((p: any) => ({
        id: p.id,
        title: p.title,
        imageUrl: p.imageUrl,
        clicks: Number(p.whatsappClicks) || 0,
        revenueXof: orders
          .filter((o: any) => o.productId === p.id)
          .reduce((s: number, o: any) => s + (Number(o.priceXof) || 0) * (Number(o.quantity) || 1), 0),
        revenueEur: orders
          .filter((o: any) => o.productId === p.id)
          .reduce((s: number, o: any) => s + (Number(o.priceEur) || 0) * (Number(o.quantity) || 1), 0),
      }))
      .sort((a: any, b: any) => b.clicks - a.clicks)
      .slice(0, 8);

    res.json({
      success: true,
      stats: {
        totalProducts: products.length,
        totalOrders: orders.length,
        totalClicks,
        totalRevenueXof,
        totalRevenueEur,
        salesByCategory: Object.entries(salesByCategory).map(([category, orders]) => ({ category, orders, revenueXof: 0 })),
        revenueSeries,
        topProducts,
      },
    });
  });

  // Public catalog JSON consumed by the static client template (GitHub Pages flow)
  app.get("/catalog.json", async (_req, res) => {
    const products = await loadProducts();
    res.setHeader("Cache-Control", "no-store");
    res.json(products.length ? products : []);
  });

  // ---------------------------------------------------------------------------
  // IMAGE UPLOAD (already watermarked client-side) + SERVING
  // ---------------------------------------------------------------------------
  app.post("/api/upload-image", requireAuth, rateLimit(30, 60_000), async (req, res) => {
    try {
      const { imageBase64 } = req.body || {};
      if (!imageBase64 || typeof imageBase64 !== "string") {
        return res.status(400).json({ error: "Aucune image reçue (base64 manquant)." });
      }
      const base64Data = imageBase64.split(",").pop() || "";
      const input = Buffer.from(base64Data, "base64");
      if (!input.length || input.length > 15 * 1024 * 1024) {
        return res.status(400).json({ error: "Image invalide ou trop volumineuse (max 15 Mo)." });
      }
      if (!looksLikeImage(input)) {
        return res.status(400).json({ error: "Le fichier n'est pas une image valide (JPEG/PNG/GIF/WebP/BMP)." });
      }
      const id = crypto.randomBytes(8).toString("hex");
      await saveImage(id, input);
      res.json({ success: true, url: `/api/img/${id}.jpg` });
    } catch (err: any) {
      console.error("Upload image error:", err);
      return res.status(500).json({ error: "Erreur lors de l'upload de l'image." });
    }
  });

  app.get("/api/img/:id", async (req, res) => {
    const id = String(req.params.id || "").replace(/\.jpg$/i, "");
    if (!id || !/^[a-f0-9]{16}$/i.test(id)) {
      return res.status(404).json({ error: "Image introuvable." });
    }
    const buffer = await loadImage(id);
    if (!buffer) {
      return res.status(404).json({ error: "Image introuvable." });
    }
    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(buffer);
  });

  app.post("/api/upload-video", requireAuth, rateLimit(10, 60_000), async (req, res) => {
    try {
      const { videoBase64 } = req.body || {};
      if (!videoBase64 || typeof videoBase64 !== "string") {
        return res.status(400).json({ error: "Aucune vidéo reçue (base64 manquant)." });
      }
      const base64Data = videoBase64.split(",").pop() || "";
      const input = Buffer.from(base64Data, "base64");
      if (!input.length || input.length > 60 * 1024 * 1024) {
        return res.status(400).json({ error: "Vidéo invalide ou trop volumineuse (max 60 Mo)." });
      }
      if (!looksLikeVideo(input)) {
        return res.status(400).json({ error: "Le fichier n'est pas une vidéo valide (MP4/WebM/MOV)." });
      }
      const id = crypto.randomBytes(8).toString("hex");
      await saveVideo(id, input);
      res.json({ success: true, url: `/api/vid/${id}.mp4` });
    } catch (err: any) {
      console.error("Upload video error:", err);
      return res.status(500).json({ error: "Erreur lors de l'upload de la vidéo." });
    }
  });

  app.get("/api/vid/:id", async (req, res) => {
    const id = String(req.params.id || "").replace(/\.mp4$/i, "");
    if (!id || !/^[a-f0-9]{16}$/i.test(id)) {
      return res.status(404).json({ error: "Vidéo introuvable." });
    }
    const buffer = await loadVideo(id);
    if (!buffer) {
      return res.status(404).json({ error: "Vidéo introuvable." });
    }
    // The recorder may produce WebM (Chrome/Edge) even though it was stored with
    // a .mp4 key. Serve the real MIME so browsers can actually play it.
    const isWebM =
      buffer.length > 4 &&
      buffer[0] === 0x1a &&
      buffer[1] === 0x45 &&
      buffer[2] === 0xdf &&
      buffer[3] === 0xa3;
    res.setHeader("Content-Type", isWebM ? "video/webm" : "video/mp4");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(buffer);
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
  // AI REFINE: rewrite/improve the sales pitch ("argument de vente") or the
  // technical fiche ("fiche technique") for a product, returning clean HTML
  // that can be dropped directly into the WYSIWYG editors.
  // ---------------------------------------------------------------------------
  app.post("/api/ai-refine", requireAuth, rateLimit(10, 60_000), async (req, res) => {
    try {
      if (!apiKey || !ai) {
        return res.status(503).json({
          error: "Le service d'IA n'est pas configuré. Veuillez ajouter votre clé API GEMINI_API_KEY dans le fichier .env / Secrets.",
        });
      }
      const { field, title, category, currentText } = req.body || {};
      const target = field === "technical" ? "technical" : "description";
      const cleanTitle = String(title || "").slice(0, 300);
      const cleanCategory = String(category || "").slice(0, 80);
      const cleanCurrent = String(currentText || "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 4000);

      const instructions =
        target === "description"
          ? `Tu es un copywriter d'élite pour la marque de précommande BLACK MARKET (import Chine, marché francophone).
Rédige ou optimise l'ARGUMENTAIRE DE VENTE du produit « ${cleanTitle} » (catégorie : ${cleanCategory || "non précisée"}).
${cleanCurrent ? `Reprends les informations utiles de l'argumentaire actuel et optimise-le pour le rendre plus percutant, plus structuré et plus orienté bénéfices clients : "${cleanCurrent}".` : "Crée un argumentaire de vente premium de toutes pièces."}
Exigences :
- 2 à 4 paragraphes courts et percutants, ton enthousiaste mais crédible.
- Une liste à puces de 3 à 5 bénéfices clients concrets.
- Mise en avant de l'exclusivité, de la qualité d'import direct et du filigrane de marque.
- Ne jamais inventer de caractéristiques techniques fausses. Reste général si l'info manque.
Renvoie du HTML propre : <p>, <h3>, <ul><li>. Sans balise <html>, <body> ni texte hors HTML.`
          : `Tu es un expert en fiches techniques e-commerce (import Chine, marché francophone).
Présente la FICHE TECHNIQUE du produit « ${cleanTitle} » (catégorie : ${cleanCategory || "non précisée"}).
${cleanCurrent ? `Reprends les informations actuelles, réorganise-les, corrige-les et complète intelligemment : "${cleanCurrent}".` : "Crée une fiche technique structurée à partir du nom du produit."}
Exigences :
- Structure claire : <h3> pour chaque bloc (par ex. "Caractéristiques", "Matériaux & Qualité", "Expédition & Livraison").
- Liste à puces <ul><li> pour les caractéristiques, concrètes et numérotées quand c'est possible.
- Qualité et quantité d'informations adaptées : détaillé mais jamais inventé. Indique clairement les points non confirmés.
Renvoie du HTML propre : <h3>, <p>, <ul><li>. Sans balise <html>, <body> ni texte hors HTML.`;

      const response = await generateContentWithRetry(
        ai,
        {
          model: geminiModel,
          contents: [{ text: instructions }],
          config: {
            systemInstruction:
              "Tu génères exclusivement du contenu HTML propre (balises <p>, <h3>, <ul>, <li>) pour une interface d'édition produit. Aucune balise <html>, <body> ni texte hors HTML.",
            temperature: 0.7,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                html: { type: Type.STRING, description: "Contenu HTML final à insérer directement dans l'éditeur." },
              },
              required: ["html"],
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
      return res.json({ success: true, html: String(resultJson.html || "").slice(0, 12000) });
    } catch (error: any) {
      console.error("AI Refine Error:", error);
      return res.status(500).json({
        error: error.message || "Une erreur est survenue lors de la génération par l'IA.",
      });
    }
  });

  return app;
}
