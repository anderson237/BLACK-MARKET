// ---------------------------------------------------------------------------
// BL-007 — Prototype headless goofish (ST-017) : remplacement JustOneAPI pour
// le détail produit Xianyu/Goofish pendant que le solde du compte est à zéro
// (code 601 INSUFFICIENT BALANCE).
//
// APPROCHE (validée par le Lab le 2026-08-09) :
//   1. Un navigateur headless GRATUIT (playwright-core) ouvre
//      https://www.goofish.com/item?id=<id> avec un profil "humain"
//      (Edge local en dev / chromium-headless-shell en prod / navigateur
//      distant browserless.io).
//   2. MODE DISTANT (BL-007 v2) : si la variable d'env
//      `GOOFISH_BROWSER_WS_ENDPOINT` est définie (ex. browserless.io,
//      `wss://chrome.browserless.io/playwright-chromium?token=...`), on se
//      connecte via `chromium.connect(wsEndpoint)` — pas de binaire à
//      embarquer en Netlify, le navigateur vit chez browserless.
//      SINON : `chromium.launch()` local (Edge dev / chromium-headless-shell)
//      — comportement v1 conservé.
//   3. APPROCHE PRÉFÉRÉE : on intercepte la réponse de l'API interne MTOP
//      `mtop.taobao.idle.pc.detail` (page.on('response') + r.json()) → JSON
//      structuré complet (itemDO / sellerDO / imageInfos / desc…).
//   4. FALLBACK : extraction DOM directe (titre via <title>, prix ¥ via regex
//      sur innerText, images alicdn via querySelectorAll, description).
//   5. Retry sur erreur temporaire RGV587 (anti-bot intermittent), borné par
//      un délai GLOBAL (`totalTimeoutMs`, défaut 45 s — contrainte ticket).
//
// CONTRAT DE SORTIE : objet normalisé au format JO Detail — IDENTIQUE au
// schéma produit par flattenXianyuDetail() dans server/utils/justone.ts
// (route /api/xianyu/get-item-detail/v1). draftBuilder.ts, la route from-url
// et l'UI admin restent donc INCHANGÉS : ce module est une source de détail
// interchangeable avec JustOneAPI.
//
// ⚠️ SÉCURITÉ : le token browserless (query string du WS endpoint) ne doit
// JAMAIS fuiter au client — il est lu côté serveur uniquement et masqué dans
// tous les logs via maskWsEndpoint().
//
// ENTREE :  sourceId (string) — identifiant item goofish, ex. "1072126350734"
// SORTIE :  Promise<JoDetail> (même shape que le flattener JustOneAPI)
// RISQUES : captcha anti-bot (RGV587), taux de blocage IP, surcoût temps
//           d'exécution serveur (~10-25 s local, ~10-30 s distant),
//           dépendance au rendu JS goofish.
// PARAMS :  (optionnel) { maxAttempts?, timeoutMs?, totalTimeoutMs?,
//            browserPath?, wsEndpoint?, headless? }
// ---------------------------------------------------------------------------

import { existsSync } from 'node:fs'
import { chromium, type Browser, type Page } from 'playwright-core'
import type { JoDetail } from './justone'

/** URL produit goofish (même forme que draftBuilder.sourceUrlFor). */
export function goofishItemUrl(sourceId: string): string {
  return `https://www.goofish.com/item?id=${encodeURIComponent(String(sourceId || ''))}`
}

// ---------------------------------------------------------------------------
// Mode distant browserless (BL-007 v2).
// GOOFISH_BROWSER_WS_ENDPOINT : endpoint WebSocket Playwright, ex.
//   wss://chrome.browserless.io/playwright-chromium?token=xxxxxxxx
// S'il est défini → `chromium.connect(wsEndpoint)` ; sinon lancement local.
// ---------------------------------------------------------------------------

function browserWsEndpoint(): string {
  return String(process.env.GOOFISH_BROWSER_WS_ENDPOINT || '').trim()
}

/** `true` quand un navigateur distant (browserless) est configuré. */
export function isRemoteBrowserConfigured(): boolean {
  return Boolean(browserWsEndpoint())
}

/**
 * Masque un endpoint WebSocket avant journalisation : le token browserless
 * vit dans la query string et ne doit jamais apparaître dans les logs.
 */
export function maskWsEndpoint(ws: string): string {
  try {
    const u = new URL(ws)
    u.search = ''
    u.hash = ''
    return u.toString().replace(/\/+$/, '')
  } catch {
    return '<ws endpoint>'
  }
}

// ---------------------------------------------------------------------------
// Navigateur : Edge local (dev Windows) / chromium-headless-shell (prod) /
// chrome/chromium système. GOOFISH_BROWSER_PATH force un chemin explicite
// (utilisé par le futur pipeline Netlify qui téléchargera headless-shell).
// ---------------------------------------------------------------------------

const BROWSER_CANDIDATES = [
  process.env.GOOFISH_BROWSER_PATH || '',
  // Edge installé (dev, Windows) — chemin validé par le Lab.
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  // Linux / container Netlify — chromium-headless-shell ou chrome système.
  '/opt/chromium-headless-shell/chrome-linux/headless_shell',
  '/usr/bin/chromium-headless-shell',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/microsoft-edge',
]

export function findBrowserExecutable(): string | undefined {
  for (const p of BROWSER_CANDIDATES) {
    if (!p) continue
    try {
      if (existsSync(p)) return p
    } catch {
      /* ignore fs errors */
    }
  }
  return undefined
}

export interface ScraperGoofishOptions {
  /** Nombre de tentatives totales (retry sur RGV587 / rendu vide). Défaut 2. */
  maxAttempts?: number
  /** Timeout par navigation, ms. Défaut 40 000 (contrainte ticket ~40 s). */
  timeoutMs?: number
  /**
   * Délai GLOBAL de scrapeGoofishDetail, ms. Défaut 45 000 (~45 s max, comme
   * demandé au ticket BL-007 v2). Les retries s'arrêtent dès que ce budget est
   * consommé — le message d'erreur le dit explicitement.
   */
  totalTimeoutMs?: number
  /** Chemin explicite vers un navigateur (outrepasse la détection locale). */
  browserPath?: string
  /**
   * Endpoint WebSocket d'un navigateur distant (browserless.io…). Défaut :
   * variable d'env GOOFISH_BROWSER_WS_ENDPOINT. Prioritaire sur le lancement
   * local dès qu'il est non vide.
   */
  wsEndpoint?: string
  /** Défaut true. Mis à false pour débugger (fenêtre visible, local only). */
  headless?: boolean
}

const DEFAULT_OPTIONS: Required<Pick<ScraperGoofishOptions, 'maxAttempts' | 'timeoutMs' | 'totalTimeoutMs' | 'headless'>> = {
  maxAttempts: 2,
  timeoutMs: 40_000,
  totalTimeoutMs: 45_000,
  headless: true,
}

async function connectRemoteBrowser(opts: ScraperGoofishOptions): Promise<Browser> {
  const ws = (opts.wsEndpoint || browserWsEndpoint() || '').trim()
  const masked = maskWsEndpoint(ws)
  const connectTimeout = Math.min(opts.timeoutMs || DEFAULT_OPTIONS.timeoutMs, 30_000)
  console.log(`[scraper-goofish] connexion navigateur DISTANT (browserless): ${masked} (timeout ${connectTimeout} ms)`)
  try {
    // chromium.connect -> Browser connecté (le contexte/les pages vivent chez
    // browserless). Timeout borné pour ne pas dépasser le budget global.
    return await chromium.connect(ws, { timeout: connectTimeout })
  } catch (err) {
    throw new Error(
      `scraperGoofish: impossible de se connecter au navigateur distant ${masked} ` +
        `(${String(err?.message || err).slice(0, 180)}). Vérifiez GOOFISH_BROWSER_WS_ENDPOINT (token valide, quota browserless).`,
    )
  }
}

async function launchHeadless(opts: ScraperGoofishOptions): Promise<Browser> {
  const executablePath = opts.browserPath || findBrowserExecutable()
  const args = [
    '--disable-blink-features=AutomationControlled', // ne pas lever l'anti-bot goofish
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage', // containers Linux à /dev/shm réduit
  ]
  console.log(
    `[scraper-goofish] lancement navigateur${executablePath ? `: ${executablePath}` : ' (registry playwright par défaut)'}`,
  )
  try {
    return await chromium.launch({
      executablePath: executablePath || undefined,
      headless: opts.headless,
      args,
    })
  } catch (err) {
    throw new Error(
      `scraperGoofish: impossible de lancer le navigateur headless (${String(err?.message || err).slice(0, 180)}). ` +
        'En dev, Edge doit être installé. En prod, définissez GOOFISH_BROWSER_WS_ENDPOINT (browserless) ' +
        'ou GOOFISH_BROWSER_PATH vers chromium-headless-shell.',
    )
  }
}

/**
 * Dispatcher navigateur : mode distant browserless si un WS endpoint est
 * disponible (option ou env), sinon lancement local (v1).
 */
async function openBrowser(opts: ScraperGoofishOptions): Promise<Browser> {
  const ws = (opts.wsEndpoint || browserWsEndpoint() || '').trim()
  if (ws) return connectRemoteBrowser(opts)
  return launchHeadless(opts)
}

// ---------------------------------------------------------------------------
// Normalisation images alicdn — miroir de taobaoImageUrl() dans justone.ts :
// les URL g.search[N].alicdn.com/img/bao/uploaded/<bucket>/<seller>/<file>
// (bloquées) sont réécrites vers img.alicdn.com/imgextra/<bucket>/<file>
// (CDN qui répond). Forcer https pour les URL http:// d'imageInfos.
// ---------------------------------------------------------------------------

export function normalizeAlicdnImage(url: string): string {
  const raw = String(url || '').trim()
  if (!raw) return ''
  const m = raw.match(/^https?:\/\/g\.search\d?\.alicdn\.com\/img\/bao\/uploaded\/(?:[^/]+\/)?(i[1-4])\/(i[1-4])\/(.+)$/)
  if (m) return `https://img.alicdn.com/imgextra/${m[2]}/${m[3]}`
  if (raw.startsWith('//')) return `https:${raw}`
  if (raw.startsWith('http://')) return `https://${raw.slice(7)}`
  return raw
}

/**
 * Retire le suffixe de retaillage CDN alicdn (ex. `xy_item.jpg_450x10000Q90.jpg_.webp`
 * -> `xy_item.jpg`) pour dédupliquer les variantes d'une même image.
 */
export function cleanImageSizeSuffix(url: string): string {
  return String(url || '')
    .replace(/_\d+x\d+Q\d+\.(?:jpg|jpeg|png)_?\.webp$/i, '')
    .replace(/_Q\d+\.(?:jpg|jpeg|png)_?\.webp$/i, '')
    .replace(/_\d+x\d+\.(?:jpg|jpeg|png)$/i, '')
}

function mergeImages(...lists: (string[] | undefined)[]): string[] {
  // key = URL de base (sans suffixe CDN) ; on garde la variante plein format :
  // quand une URL porte un suffixe de retaillage (_110x10000Q90…), on émet
  // l'URL de base (vérifié : les bases ...-0-mtopupload.jpg répondent 200).
  const best = new Map<string, string>()
  for (const list of lists) {
    for (const url of list || []) {
      const u = normalizeAlicdnImage(url)
      if (!u) continue
      const cleaned = cleanImageSizeSuffix(u)
      const preferred = cleaned === u ? u : cleaned
      const existing = best.get(cleaned)
      if (!existing || preferred.length < existing.length) best.set(cleaned, preferred)
    }
  }
  return Array.from(best.values())
}

// ---------------------------------------------------------------------------
// Flatten du payload MTOP `mtop.taobao.idle.pc.detail` -> JoDetail.
// Même SCHÉMA DE SORTIE que flattenXianyuDetail() (justone.ts) : platform,
// sourceId, title, desc, images, price, currency, condition, features,
// seller{nick,city,soldCount,goodRemarkCnt,badRemarkCnt,replyRatio24h,
// newGoodRatioRate,zhimaVerified,itemCount}, wantCnt, browseCnt, favorCnt,
// extra. (Les champs internes MTOP diffèrent : itemDO/sellerDO/picDetailDO.)
// ---------------------------------------------------------------------------

export function flattenMtopDetail(payload: any, fallbackSourceId: string): JoDetail | null {
  const d = payload?.data
  const item = d?.itemDO || {}
  if (!item?.itemId && !item?.title) return null
  const seller = d?.sellerDO || {}

  const images: string[] = []
  for (const img of Array.isArray(item.imageInfos) ? item.imageInfos : []) {
    images.push(normalizeAlicdnImage(String(img?.url || '')))
  }

  const features: { name: string; value: string }[] = []
  for (const l of Array.isArray(item.cpvLabels) ? item.cpvLabels : []) {
    features.push({ name: String(l?.propertyName || ''), value: String(l?.valueName || '') })
  }

  // Prix : soldPrice (prix de vente réel) > defaultPrice (si nombre) >
  // originalPrice. defaultPrice peut être `false` (boolean) sur goofish -> exclu.
  const defaultPrice = item?.defaultPrice && typeof item?.defaultPrice !== 'boolean' ? item.defaultPrice : ''
  const rawPrice = String(item?.soldPrice ?? defaultPrice ?? item?.originalPrice ?? '')
  const price = Number(rawPrice.replace(/[^0-9.]/g, ''))

  return {
    platform: 'xianyu',
    sourceId: String(item.itemId || fallbackSourceId),
    title: String(item.title || ''),
    desc: String(item.desc || item.richTextDesc || ''),
    images,
    price: Number.isFinite(price) ? price : 0,
    currency: 'CNY',
    condition: String(item.itemStatusStr || ''),
    features,
    seller: {
      nick: String(seller.nick || seller.uniqueName || ''),
      city: String(seller.city || seller.publishCity || ''),
      soldCount: Number(seller.hasSoldNumInteger) || undefined,
      goodRemarkCnt: Number(seller.remarkDO?.sellerGoodRemarkCnt) || undefined,
      badRemarkCnt: Number(seller.remarkDO?.sellerBadRemarkCnt) || undefined,
      replyRatio24h: String(seller.replyRatio24h || ''),
      newGoodRatioRate: String(seller.newGoodRatioRate || ''),
      zhimaVerified: Boolean(seller.zhimaAuth),
      itemCount: Number(seller.itemCount) || undefined,
    },
    wantCnt: Number(item.wantCnt) || undefined,
    browseCnt: Number(item.browseCnt) || undefined,
    favorCnt: Number(item.favorCnt) || undefined,
    extra: { item },
  }
}

// ---------------------------------------------------------------------------
// Extraction DOM (fallback quand l'API MTOP n'a pas été interceptée ou est
// en échec) : titre <title>, prix ¥ via regex innerText, images alicdn,
// description (tranche de texte entre le titre et « 为你推荐 »).
// ---------------------------------------------------------------------------

export async function collectDomImages(page: Page): Promise<string[]> {
  return page
    .evaluate(() => {
      const out: string[] = []
      for (const img of document.querySelectorAll('img')) {
        const src = String(img.currentSrc || img.src || img.getAttribute('data-src') || img.getAttribute('data-lazyload') || '')
        if (!src) continue
        if (!src.includes('alicdn')) continue
        if (src.includes('-tps-')) continue
        if (/[.-](logo|nopic|favicon|placeholder)/i.test(src)) continue
        if (!/(img\.alicdn\.com\/(?:bao\/uploaded|imgextra)|gw\.alicdn\.com\/imgextra)/i.test(src)) continue
        out.push(src)
      }
      return Array.from(new Set(out))
    })
    .catch(() => [])
}

interface DomExtract {
  title: string
  price: string
  desc: string
  sellerNick: string
}

export async function extractFromDom(page: Page): Promise<DomExtract | null> {
  const data = await page
    .evaluate(() => {
      const txt = document.body ? document.body.innerText : ''
      const priceMatch = txt.match(/¥\s*([\d,]+(?:\.\d+)?)/)
      const title = document.title.replace(/_?闲鱼.*$/, '').replace(/_+$/, '').trim()
      let desc = ''
      const idx = txt.indexOf(title)
      let end = txt.indexOf('为你推荐')
      if (idx > -1) {
        const start = idx + title.length
        if (end <= start) end = Math.min(start + 800, txt.length)
        desc = txt.slice(start, end).slice(0, 800)
      } else if (end > -1) {
        desc = txt.slice(0, end).slice(0, 800)
      }
      const nickMatch = txt.match(/(?:卖家|掌柜|昵称|芝麻信用)[:：]?\s*([\u4e00-\u9fa5A-Za-z0-9_]{2,24})/)
      // Exclut les libellés de crédibilité (faux positifs) du champ vendeur.
      let sellerNick = nickMatch ? nickMatch[1] : ''
      if (/信用|芝麻|钻石|皇冠|好评|实名|极好|良好/.test(sellerNick)) sellerNick = ''
      return { title, price: priceMatch ? priceMatch[1] : '', desc, sellerNick }
    })
    .catch(() => null)
  if (!data) return null
  if (!data.title && !data.price) return null
  return data
}

// ---------------------------------------------------------------------------
// Une tentative : interception MTOP puis fallback DOM. Lance une erreur quand
// l'anti-bot RGV587 est détecté (la boucle de retry de scrapeGoofishDetail
// relance alors une nouvelle navigation).
// ---------------------------------------------------------------------------

async function scrapeOnce(
  browser: Browser,
  url: string,
  sourceId: string,
  timeoutMs: number,
): Promise<JoDetail | null> {
  const ctx = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    locale: 'zh-CN',
    viewport: { width: 1280, height: 900 },
    extraHTTPHeaders: { 'Accept-Language': 'zh-CN,zh;q=0.9' },
  })
  try {
    await ctx.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
    })
    const page = await ctx.newPage()

    // --- Interception de l'API interne MTOP (approche préférée) -----------
    let payload: any = null
    let payloadRet: string[] | null = null
    page.on('response', (r) => {
      if (!r.url().includes('mtop.taobao.idle.pc.detail')) return
      r.json()
        .then((j) => {
          payload = j
          payloadRet = Array.isArray(j?.ret) ? j.ret.map(String) : null
          console.log(
            `[scraper-goofish] MTOP detail capturé, ret=${JSON.stringify(payloadRet || []).slice(0, 80)}`,
          )
        })
        .catch(() => {
          /* réponse non-JSON (preflight/erreur) — ignorée */
        })
    })

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs })

    // Attente du rendu : titre goofish + prix ¥ dans le DOM.
    try {
      await page.waitForFunction(
        () => document.title.includes('闲鱼') && document.body?.innerText.includes('¥'),
        { timeout: Math.min(15_000, timeoutMs) },
      )
    } catch {
      /* on continue : le payload MTOP peut quand même être arrivé */
    }
    // Petite stabilisation : laisse les dernières imageInfos se poser.
    await page.waitForTimeout(2_000)

    const isRgv =
      Array.isArray(payloadRet) && payloadRet.some((x) => String(x).includes('RGV587'))

    if (payload?.data?.itemDO && !isRgv) {
      const detail = flattenMtopDetail(payload, sourceId)
      if (detail) {
        // Enrichit la galerie avec les images du DOM (le Lab a mesuré ~130
        // URLs alicdn ; imageInfos n'en contient souvent qu'1 seule).
        const domImages = await collectDomImages(page)
        detail.images = mergeImages(detail.images, domImages)
        return detail
      }
    }

    // --- Fallback DOM -------------------------------------------------------
    const dom = await extractFromDom(page)
    if (dom) {
      const price = Number(dom.price.replace(/[^0-9.]/g, ''))
      return {
        platform: 'xianyu',
        sourceId,
        title: dom.title,
        desc: dom.desc,
        images: await collectDomImages(page),
        price: Number.isFinite(price) ? price : 0,
        currency: 'CNY',
        condition: '',
        features: [],
        seller: dom.sellerNick ? { nick: dom.sellerNick } : undefined,
      }
    }

    if (isRgv) throw new Error('RGV587_ERROR (anti-bot goofish temporaire) — retry')
    return null
  } finally {
    await ctx.close().catch(() => {})
  }
}

// ---------------------------------------------------------------------------
// API publique : scrape un détail goofish et retourne un JoDetail normalisé.
// Boucle de retry (RGV587 / rendu vide) puis erreur claire.
// ---------------------------------------------------------------------------

export async function scrapeGoofishDetail(
  sourceId: string,
  opts: ScraperGoofishOptions = {},
): Promise<JoDetail> {
  const options = { ...DEFAULT_OPTIONS, ...opts }
  const url = goofishItemUrl(sourceId)
  const mode = browserWsEndpoint() ? 'distant (browserless)' : 'local'
  console.log(`[scraper-goofish] scrape ${sourceId} — mode ${mode} — budget ${options.totalTimeoutMs} ms`)
  let lastErr: unknown = null

  // Budget global (~45 s par défaut) : le retry RGV587 s'arrête dès que le
  // délai total est consommé, pour ne jamais dépasser le timeout serveur.
  const deadline = Date.now() + options.totalTimeoutMs

  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    const remaining = deadline - Date.now()
    if (remaining <= 5_000) {
      lastErr = new Error(`délai global dépassé (${options.totalTimeoutMs} ms)`)
      break
    }
    // Timeout de navigation borné par le temps restant (garde 3 s de marge).
    const navTimeout = Math.min(options.timeoutMs, Math.max(10_000, remaining - 3_000))

    let browser: Browser | null = null
    try {
      browser = await openBrowser(options)
      const detail = await scrapeOnce(browser, url, String(sourceId), navTimeout)
      if (detail) {
        console.log(
          `[scraper-goofish] SUCCÈS ${sourceId} — "${detail.title}" — ${detail.price} CNY — ${detail.images.length} image(s)`,
        )
        return detail
      }
      lastErr = new Error('aucun détail utilisable (payload MTOP absent et fallback DOM vide)')
    } catch (err) {
      lastErr = err
      console.warn(`[scraper-goofish] tentative ${attempt}/${options.maxAttempts} échouée: ${String(err?.message || err).slice(0, 160)}`)
    } finally {
      if (browser) await browser.close().catch(() => {})
    }
    if (attempt < options.maxAttempts) {
      await new Promise((r) => setTimeout(r, 1_500 * attempt))
    }
  }

  const msg =
    lastErr instanceof Error
      ? lastErr.message
      : String(lastErr || 'erreur inconnue')
  throw new Error(`scraperGoofish: échec après ${options.maxAttempts} tentative(s) (budget ${options.totalTimeoutMs} ms) pour ${sourceId} — ${msg}`)
}
