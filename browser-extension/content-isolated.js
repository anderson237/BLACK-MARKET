// ---------------------------------------------------------------------------
// DeepRoots Import — content-isolated.js (MONDE ISOLÉ, ST-020)
//
// Injecté à `document_start` en `world: "ISOLATED"` sur les marketplaces.
// Rôles :
//   1. Recevoir les captures réseau de content-main.js (world MAIN) via
//      `window.postMessage` et les garder dans un pool borne (Map url→objet).
//   2. Répondre aux messages du popup/background :
//        { type: 'DR_PING' }    → présence content script + host supporté
//        { type: 'DR_CAPTURE' } → extrait un payload produit (heuristique JSON,
//                                 sinon fallback DOM) → sendResponse({payload})
//
// Seul CE script parle à l'extension (chrome.runtime). Le script MAIN ne fait
// que postMessage — il ne touche jamais aux API Chrome.
//
// HOSTS supportés (miroir du manifest) :
//   taobao/tmall, 1688, amazon.*, goofish (xianyu), douyin/jinritemai (douyin-ec), tiktok
// ---------------------------------------------------------------------------
(() => {
  if (window.__DR_ISOLATED__) return
  window.__DR_ISOLATED__ = true

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function hasCjk(s) {
    return /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/.test(String(s || ''))
  }

  function detectPlatform(host) {
    const h = String(host || '')
    if (/(^|\.)taobao\.com$/i.test(h) || /(^|\.)tmall\.com$/i.test(h)) return 'taobao'
    if (/(^|\.)1688\.com$/i.test(h)) return '1688'
    if (/(\.amazon\.)/i.test(h)) return 'amazon'
    if (/(^|\.)goofish\.com$/i.test(h)) return 'xianyu'
    if (/(^|\.)douyin\.com$/i.test(h) || /(^|\.)jinritemai\.com$/i.test(h)) return 'douyin-ec'
    if (/(^|\.)tiktok\.com$/i.test(h)) return 'tiktok-shop'
    return null
  }

  function currencyFor(platform, url) {
    if (platform === 'amazon') {
      try {
        const u = new URL(String(url || ''))
        if (/\.amazon\.(fr|de|it|es|nl|se|pl)$|\.amazon\.co\.uk$/i.test(u.hostname)) return 'EUR'
      } catch (_) {}
      return 'USD'
    }
    if (platform === 'tiktok-shop') return 'USD'
    return 'CNY'
  }

  // ----- Deep find: premier primitive sous l'un des `keys` (préférence d'ordre) -----
  const INNER_OBJ_KEYS = ['amount', 'value', 'displayAmount', 'rawPrice', 'price', 'priceText', 'text', 'display', 'displayTitle', 'title', 'stringValue']
  function findByKeys(node, keys, depth) {
    if (node == null || typeof node !== 'object') return undefined
    if (depth > 20) return undefined
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) {
        const v = findByKeys(node[i], keys, depth + 1)
        if (v !== undefined && String(v).trim()) return v
      }
      return undefined
    }
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i]
      if (!Object.prototype.hasOwnProperty.call(node, k)) continue
      const val = node[k]
      if (val == null) continue
      if (typeof val !== 'object') {
        const s = String(val).trim()
        if (s) return s
      } else {
        const inner = findByKeys(val, INNER_OBJ_KEYS, depth + 1)
        if (inner !== undefined && String(inner).trim()) return inner
      }
    }
    for (const k of Object.keys(node)) {
      const v = findByKeys(node[k], keys, depth + 1)
      if (v !== undefined && String(v).trim()) return v
    }
    return undefined
  }

  // ----- Collecte d'URLs image depuis un objet JSON -----
  const IMG_KEYS = ['images', 'imgs', 'pics', 'pic', 'gallery', 'imageList', 'itemImages', 'mainImages', 'thumbs', 'imgList', 'galleryImages', 'photos', 'photo']
  function seemsImage(url) {
    return /\.(jpe?g|png|webp|gif|bmp)(\?|$)/i.test(url) || /image|img|pic|photo|thumb|gallery|cdn|alicdn|oss|aliyuncs|cloudfront|amazon/.test(String(url).toLowerCase())
  }
  function findImages(node, out, depth) {
    if (!node || typeof node !== 'object' || depth > 18 || out.length >= 12) return out
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) findImages(node[i], out, depth + 1)
      return out
    }
    if (typeof node === 'string') {
      if (/^https?:\/\//i.test(node) && seemsImage(node) && out.indexOf(node) === -1) out.push(node)
      return out
    }
    for (const k of Object.keys(node)) {
      if (IMG_KEYS.includes(k)) findImages(node[k], out, depth + 1)
    }
    for (const k of ['url', 'src', 'img', 'thumb', 'main', 'middle', 'picUrl']) {
      if (node[k] != null) findImages(node[k], out, depth + 1)
    }
    return out
  }

  function stripHtml(s) {
    return String(s || '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim()
  }

  // ----- parse nombre depuis un texte de prix diversifié (¥129, 1,299.00, EUR 12,99) -----
  function toNumber(text) {
    if (typeof text === 'number') return Number.isFinite(text) ? text : null
    const s = String(text == null ? '' : text)
    if (!s.trim()) return null
    const cleaned = s.replace(/[^0-9.,]/g, ' ').trim()
    const m = cleaned.match(/\d[\d.,]*/)
    if (!m) return null
    const raw = m[0]
    // 1.299,00 ou 1,299.00 → séparateurs mélangés
    if (raw.indexOf(',') !== -1 && raw.indexOf('.') !== -1) {
      const lastComma = raw.lastIndexOf(',')
      const lastDot = raw.lastIndexOf('.')
      if (Math.abs(lastComma - lastDot) === 3) {
        const n = parseFloat(raw.replace(/[,.]/g, '').replace(/(\d+)(\d{2})$/, '$1.$2'))
        if (Number.isFinite(n)) return n
      }
      const n2 = parseFloat(raw.replace(/,/g, ''))
      if (Number.isFinite(n2)) return n2
    }
    if (raw.indexOf(',') !== -1 && raw.indexOf('.') === -1) {
      // "129,00" (virgule décimale européenne) vs "1,299" (milliers)
      if (/,\d{2}$/.test(raw)) return parseFloat(raw.replace(',', '.'))
      return parseFloat(raw.replace(/,/g, ''))
    }
    return parseFloat(raw.replace(/,/g, ''))
  }

  function sourceIdFromUrl(url, platform) {
    try {
      const u = new URL(String(url || ''))
      if (platform === '1688') {
        const m = u.pathname.match(/offer[\/-](\d+)/i)
        if (m) return m[1]
      }
      if (platform === 'amazon') {
        const m = u.pathname.match(/\/dp\/([A-Z0-9]{8,})/i) || u.pathname.match(/\/gp\/product\/([A-Z0-9]{8,})/i)
        if (m) return m[1]
        for (const p of ['asins', 'asin', 'follow']) if (u.searchParams.get(p)) return u.searchParams.get(p)
      }
      for (const p of ['id', 'itemId', 'item_id', 'auctionId', 'offerId', 'productId', 'goodsId', 'item']) {
        const v = u.searchParams.get(p)
        if (v && /^\d+$/.test(v)) return v
      }
      const m = u.pathname.match(/(\d{6,})/)
      if (m) return m[1]
    } catch (_) {}
    return ''
  }

  // ---------------------------------------------------------------------------
  // Pool de captures réseau (depuis content-main.js en world MAIN)
  // ---------------------------------------------------------------------------
  const pool = new Map() // url → { status, obj }
  const MAX_POOL = 60
  window.addEventListener('message', (e) => {
    try {
      const d = e.data
      if (!d || d.source !== 'dr-ext' || d.type !== 'network') return
      if (!d.body || typeof d.body !== 'string') return
      let obj
      try {
        obj = JSON.parse(d.body)
      } catch (_) {
        return // on ne garde que du JSON (les pages produit exposent le JSON brut)
      }
      if (!obj || typeof obj !== 'object') return
      pool.set(String(d.url).slice(0, 1200), { status: Number(d.status) || 0, obj })
      if (pool.size > MAX_POOL) {
        const oldest = pool.keys().next().value
        if (oldest !== undefined) pool.delete(oldest)
      }
    } catch (_) {
      /* best-effort */
    }
  })

  // ---------------------------------------------------------------------------
  // Sélection du meilleur objet capturé (score produit)
  // ---------------------------------------------------------------------------
  function scoreObj(o) {
    const list = JSON.stringify(o).toLowerCase()
    let s = 0
    if (/title/.test(list)) s += 4
    if (/price/.test(list)) s += 4
    if (/image|pic|img|gallery|thumb/.test(list)) s += 3
    if (/seller|shop|store|nick/.test(list)) s += 2
    if (/desc|subtitle|detail/.test(list)) s += 1
    if (/condition|used|new/.test(list)) s += 1
    return s
  }
  function pickBest() {
    let best = null
    let bestScore = -1
    for (const entry of pool.values()) {
      if (entry.status >= 400) continue
      if (!entry.obj || typeof entry.obj !== 'object') continue
      const s = scoreObj(entry.obj)
      if (s > bestScore) {
        bestScore = s
        best = entry.obj
      }
    }
    return best
  }

  // ---------------------------------------------------------------------------
  // Fallback DOM (par plateforme) — quand aucune API n'est capturée
  // ---------------------------------------------------------------------------
  const DOM = {
    taobao: {
      title: ['h1', '[class*="mainTitle"]', '[class*="title"]'],
      price: ['[class*="currentPrice"]', '[class*="price"]'],
      images: ['[class*="Gallery"] img', '#J_UlThumb img', 'img[data-src]', '[class*="pics"] img'],
      condition: ['[class*="condition"]'],
    },
    1688: {
      title: ['h1', '[class*="title-text"]', '[class*="title"]'],
      price: ['[class*="price-text"]', '[class*="ladder-price"]', '[class*="price"]'],
      images: ['[class*="gallery"] img', '[class*="preview"] img', 'img[data-src]'],
      condition: ['[class*="condition"]'],
    },
    amazon: {
      title: ['#productTitle'],
      price: ['.a-price-whole'],
      images: ['#landingImage', '#imgTagWrapperId img'],
      condition: ['#productTitle'],
    },
    xianyu: {
      title: ['[class*="item-title"]', 'h1', '[class*="Title"]'],
      price: ['[class*="price"]', '[class*="Price"]'],
      images: ['[class*="swiper"] img', '[class*="carousel"] img', '[class*="picture"] img'],
      condition: ['[class*="condition"]'],
    },
    'douyin-ec': {
      title: ['[class*="title"]', 'h1'],
      price: ['[class*="price"]', '[class*="Price"]'],
      images: ['[class*="gallery"] img', '[class*="image"] img'],
      condition: ['[class*="condition"]'],
    },
    'tiktok-shop': {
      title: ['h1', '[class*="title"]'],
      price: ['[class*="price"]', '[class*="Price"]'],
      images: ['img[class*="product"]', '[class*="gallery"] img'],
      condition: ['[class*="condition"]'],
    },
  }

  function domText(platform, selectors) {
    for (const sel of selectors) {
      try {
        const el = document.body.querySelector(sel)
        if (el) {
          const t = blockText(el)
          if (t) return t
        }
      } catch (_) {}
    }
    return ''
  }

  // Texte direct d'un noeud (sans ses enfants éventuels trop bruités).
  function blockText(el) {
    if (!el) return ''
    let t = ''
    for (const node of el.childNodes) {
      if (node.nodeType === 3) t += node.textContent || ''
    }
    t = t.replace(/\s+/g, ' ').trim()
    return t || String(el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 400)
  }

  function domImages(platform) {
    const out = []
    const root = document
    for (const sel of DOM[platform].images) {
      try {
        for (const img of root.querySelectorAll(sel)) {
          const src = (img && (img.currentSrc || img.src || img.getAttribute('data-src') || img.getAttribute('data-lazyload'))) || ''
          if (/^https?:\/\//i.test(src) && out.indexOf(src) === -1) out.push(src)
          const srcset = (img && img.getAttribute('srcset')) || ''
          if (srcset) {
            const first = srcset.split(',')[0].trim().split(' ')[0]
            if (/^https?:\/\//i.test(first) && out.indexOf(first) === -1) out.push(first)
          }
          if (out.length >= 8) break
        }
      } catch (_) {}
      if (out.length >= 8) break
    }
    // dé-dup + cap
    const seen = []
    for (const u of out) {
      if (seemsImage(u) && seen.length < 5 && seen.indexOf(u) === -1) seen.push(u)
    }
    return seen
  }

  // ---------------------------------------------------------------------------
  // Extra DOM (ST-020 v2) — capture RICHE du produit : attributs (商品属性),
  // couleurs / tailles, emballage (包装信息), quantité minimum (起批量),
  // provenance expédition et compteurs de ventes. Le titre + les photos ne
  // suffisent pas pour un bon import : on récupère TOUT ce que la page expose.
  // Stratégie générique (fonctionne sur 1688 + fallback Taobao/Tmall) :
  //   - attributs : paires dt→dd et tr→th/td (2 cellules seulement, pour éviter
  //     de capter la table d'emballage à 7 colonnes)
  //   - couleurs / tailles : dérivées de l'attribut nommé 颜色 / 尺码
  //   - emballage : première ligne de la table dont l'en-tête contient 长/宽/高
  //     /体积/重量
  //   - moq : "≥2件", "2件混批", "起批量 N件"…
  //   - shipFrom : "发货 浙江金华"
  //   - sales : "50+人好评", "300+人已加购"
  // ---------------------------------------------------------------------------
  function textOf(el) {
    return (el && String(el.textContent || '').replace(/\s+/g, ' ').trim()) || ''
  }

  function extractAttributes() {
    const attrs = []
    const seen = new Set()
    const JUNK = /价格|划线|发布价|全网销量|内容声明|满.*包邮|晚发|退货|揽收|铺货|分销|达标率|留货率|发布时间|代发/
    const push = (name, value) => {
      name = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 60)
      value = String(value || '').replace(/\s+/g, ' ').trim().slice(0, 600)
      if (!name || !value || JUNK.test(name)) return
      const k = name + '|' + value
      if (seen.has(k)) return
      seen.add(k)
      attrs.push({ name, value })
    }
    try {
      for (const dl of document.querySelectorAll('dl')) {
        for (const dt of dl.querySelectorAll(':scope > dt')) {
          const dd = dt.nextElementSibling
          if (dd && /^dd$/i.test(dd.tagName)) push(textOf(dt), textOf(dd))
        }
      }
      for (const tr of document.querySelectorAll('table tr')) {
        const cells = tr.querySelectorAll('th, td')
        if (cells.length !== 2) continue
        push(textOf(cells[0]), textOf(cells[1]))
      }
    } catch (_) {}
    return attrs.slice(0, 30)
  }

  function splitList(value) {
    return String(value || '')
      .split(/[,，、\s]+/)
      .map((s) => String(s).trim().replace(/^[\u4e00-\u9fff]{1,4}\s*[:：]\s*/, '').trim())
      .filter(Boolean)
  }

  function extractPackaging() {
    try {
      for (const table of document.querySelectorAll('table')) {
        const rows = table.querySelectorAll('tr')
        if (rows.length < 2) continue
        const header = Array.from(rows[0].querySelectorAll('th, td')).map(textOf)
        if (!/(件重|长|宽|高|体积|重量|重量)/.test(header.join(' '))) continue
        const cells = Array.from(rows[1].querySelectorAll('th, td')).map(textOf)
        if (!cells.length) continue
        const num = (i) => toNumber(cells[i])
        const col = (re) => header.findIndex((h) => re.test(h))
        const li = col(/长/), wi = col(/宽/), hi = col(/高/), vi = col(/体积/), wgi = col(/重量|克/)
        const out = {}
        const unit = (cells[0] || '').slice(0, 30)
        if (unit) out.unit = unit
        if (li >= 0 && num(li) != null) out.lengthCm = num(li)
        if (wi >= 0 && num(wi) != null) out.widthCm = num(wi)
        if (hi >= 0 && num(hi) != null) out.heightCm = num(hi)
        if (vi >= 0 && num(vi) != null) out.volumeCm3 = num(vi)
        if (wgi >= 0 && num(wgi) != null) out.weightGrams = num(wgi)
        if (Object.keys(out).length > 1) return out
      }
    } catch (_) {}
    return null
  }

  function extractMoq() {
    try {
      const t = document.body.innerText
      let m = t.match(/≥\s*(\d{1,6})\s*(件|个|套|台|双|条|pcs)/)
      if (m) return Math.max(1, parseInt(m[1], 10))
      m = t.match(/(\d{1,6})\s*(件|个|套|台|双|条|pcs)\s*(混批|起批|起订)/)
      if (m) return Math.max(1, parseInt(m[1], 10))
      m = t.match(/(?:起批量|起订量|最低起订)\s*[:：]?\s*(\d{1,6})\s*(件|个|套|台|双|条|pcs)/)
      if (m) return Math.max(1, parseInt(m[1], 10))
    } catch (_) {}
    return 0
  }

  function extractShipFrom() {
    try {
      const m = document.body.innerText.match(/发货\s*\n\s*([\u4e00-\u9fff]{2,12}?)(?:\n|至|选择)/)
      return m ? String(m[1]).trim().slice(0, 200) : undefined
    } catch (_) {}
    return undefined
  }

  function extractSales() {
    try {
      const t = document.body.innerText
      const out = {}
      let m = t.match(/(\d{1,7})\+?\s*人\s*(?:好评|评价)/)
      if (m) out.goodReviews = parseInt(m[1], 10)
      m = t.match(/(\d{1,7})\+?\s*人\s*已加购/)
      if (m) out.addedToCart = parseInt(m[1], 10)
      return Object.keys(out).length ? out : undefined
    } catch (_) {}
    return undefined
  }

  /** Récupère TOUTES les infos structurelles de la page (attributs, variantes,
   *  emballage, moq, expédition, ventes). Retourne un objet partiel de payload. */
  function buildExtras() {
    const attributes = extractAttributes()
    const colors = []
    const sizes = []
    const rest = []
    for (const a of attributes) {
      if (/^(颜色|色彩|colour|color)/i.test(a.name)) colors.push(...splitList(a.value))
      else if (/^(尺码|码数|size)/i.test(a.name)) sizes.push(...splitList(a.value))
      else rest.push(a)
    }
    const uniq = (arr) => arr.filter((v, i) => v && arr.indexOf(v) === i)
    const out = {}
    const finalAttrs = rest.length ? rest : attributes
    if (finalAttrs.length) out.attributes = finalAttrs.slice(0, 30)
    const cs = uniq(colors).slice(0, 60)
    const ss = uniq(sizes).slice(0, 20)
    if (cs.length) out.colors = cs
    if (ss.length) out.sizes = ss
    const packaging = extractPackaging()
    if (packaging) out.packaging = packaging
    const moq = extractMoq()
    if (moq) out.moq = moq
    const shipFrom = extractShipFrom()
    if (shipFrom) out.shipFrom = shipFrom
    const sales = extractSales()
    if (sales) out.sales = sales
    return out
  }

  // ---------------------------------------------------------------------------
  // Construction du payload produit
  // ---------------------------------------------------------------------------
  const TITLE_KEYS = ['itemTitle', 'productTitle', 'goodsTitle', 'subject', 'titleText', 'title', 'name', 'goodsName', 'itemInfo']
  const DESC_KEYS = ['itemDesc', 'goodsDesc', 'desc', 'description', 'detailText', 'subtitle', 'longDesc']
  const PRICE_KEYS = ['priceText', 'salePrice', 'currentPrice', 'priceNow', 'finalPrice', 'price', 'itemPrice', 'lowestPrice', 'priceValue', 'amount', 'priceInfo']
  const COND_KEYS = ['condition', 'tradeCondition', 'useStatus', 'itemCondition', 'tradeStatus', 'goodsStatus', 'itemStatus']
  const CAT_KEYS = ['categoryName', 'category', 'leafCategory', 'storeCategory', 'mainCategory', 'cateName']
  const SELLER_KEYS = ['sellerInfo', 'seller', 'shopInfo', 'shop', 'storeInfo', 'sellerNick', 'nick']

  function buildPayload(platform) {
    const url = location.href
    const raw = pickBest() || {}
    const srcTitle = stripHtml(findByKeys(raw, TITLE_KEYS) || domText(platform, DOM[platform].title)) || ''
    const desc = stripHtml(findByKeys(raw, DESC_KEYS) || '')
    const priceNum = toNumber(findByKeys(raw, PRICE_KEYS) || domText(platform, DOM[platform].price))
    let images = findImages(raw, [], 0)
    if (!images.length) images = domImages(platform)

    // seller (capture JSON ou DOM)
    const sellerObj = findByKeys(raw, SELLER_KEYS)
    const seller = (() => {
      const nick = typeof sellerObj === 'object' && sellerObj !== null && typeof sellerObj !== 'string'
        ? findByKeys(sellerObj, ['nickV2', 'sellerNick', 'nick', 'name', 'sellerName', 'shopName']) || findByKeys(raw, ['sellerNick', 'nick'])
        : findByKeys(raw, ['sellerNick', 'nick'])
      const city = (typeof sellerObj === 'object' && sellerObj !== null)
        ? findByKeys(sellerObj, ['city', 'province', 'location', 'area'])
        : undefined
      const soldCount = toNumber((typeof sellerObj === 'object' && sellerObj !== null) ? findByKeys(sellerObj, ['soldCount', 'sales', 'sold']) : '')
      if (nick || city || soldCount !== null) {
        const s = {}
        if (nick) s.nick = String(nick).slice(0, 200)
        if (city) s.city = String(city).slice(0, 200)
        if (soldCount !== null && soldCount > 0) s.soldCount = soldCount
        return s
      }
      return undefined
    })()

    const condition = stripHtml(findByKeys(raw, COND_KEYS)).slice(0, 300) || domText(platform, DOM[platform].condition || []) || undefined
    const category = stripHtml(findByKeys(raw, CAT_KEYS)).slice(0, 120) || undefined
    const sourceId = sourceIdFromUrl(url, platform) || findByKeys(raw, ['itemId', 'id', 'offerId', 'goodsId', 'productId']) || ''

    const payload = {
      platform,
      sourceId: sourceId.slice(0, 120),
      url,
      title: srcTitle.slice(0, 500),
      chineseTitle: hasCjk(srcTitle) ? srcTitle.slice(0, 500) : undefined,
      description: desc.slice(0, 10000) || undefined,
      price: typeof priceNum === 'number' && Number.isFinite(priceNum) ? priceNum : 0,
      currency: currencyFor(platform, url),
      images: images.slice(0, 5),
    }
    if (seller) payload.seller = seller
    if (condition) payload.condition = condition
    if (category) payload.category = category

    // ST-020 v2 : attributs, variantes (couleurs/tailles), emballage, moq,
    // expédition, compteurs de ventes — directement depuis le DOM.
    Object.assign(payload, buildExtras())

    return payload
  }

  // ---------------------------------------------------------------------------
  // Messagerie extension
  // ---------------------------------------------------------------------------
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || typeof msg !== 'object') return
    if (msg.type === 'DR_PING') {
      sendResponse({ ok: true, url: location.href, host: location.hostname, platform: detectPlatform(location.hostname) })
      return
    }
    if (msg.type === 'DR_CAPTURE') {
      const platform = detectPlatform(location.hostname)
      if (!platform) {
        sendResponse({ ok: false, error: `Host non supporté : ${location.hostname}` })
        return
      }
      const payload = buildPayload(platform)
      if (!payload.sourceId && !payload.title && payload.price <= 0) {
        sendResponse({ ok: false, error: "Impossible d'extraire le produit de cette page (rechargez la page puis réessayez)." })
        return
      }
      sendResponse({ ok: true, platform, payload, url: location.href })
      return
    }
  })
})()