// ---------------------------------------------------------------------------
// DeepRoots Import — content-main.js (MONDE MAIN, ST-020)
//
// Injecté à `document_start` en `world: "MAIN"` sur les marketplaces
// supportées (Taobao/Tmall, 1688, Amazon, Goofish, Douyin, TikTok Shop).
//
// Pourquoi MAIN ? En Manifest V3 `chrome.webRequest` ne fournit JAMAIS le body
// des réponses et `declarativeNetRequest` ne le lit pas. La seule technique
// fiable pour intercepter les API internes (mtop / detail / offer / item…) est
// de monkey-patcher `window.fetch` et `XMLHttpRequest` DANS le monde de la
// page, puis de transmettre le body au content script isolé via
// `window.postMessage`.
//
// ⚠️ Garde-fous :
//   - `res.clone()` pour ne PAS consommer la réponse originale de l'application.
//   - body tronqué à 64 Ko (les API produit font rarement plus).
//   - seuls les body JSON (ou texte) sont transmis + `response.clone().text()`.
//   - hook posé UNE SEULE fois (flag `window.__DR_EXT_HOOKED__`).
// ---------------------------------------------------------------------------
(() => {
  if (window.__DR_EXT_HOOKED__) return
  window.__DR_EXT_HOOKED__ = true

  const MAX_BODY = 64 * 1024 // 64 Ko
  const SEND = (msg) => {
    try {
      window.postMessage({ source: 'dr-ext', type: 'network', ...msg }, '*')
    } catch (_) {
      /* best-effort : window en cours de démolition */
    }
  }

  // Sous-domaines/clés des API internes de détail produit des plateformes.
  const INTEREST = /mtop|detail|offer|item|price|stock|goofish|h5api|uh_|aweme|alisdk|commodity|shop|spec|product|tradeCondition|useStatus/i

  // ----- window.fetch -------------------------------------------------------
  const origFetch = window.fetch
  if (typeof origFetch === 'function') {
    window.fetch = function (input, init) {
      const req = origFetch.apply(this, arguments)
      const url = String((typeof input === 'string' ? input : input && input.url) || '')
      if (!INTEREST.test(url)) return req
      const original = arguments.length ? arguments[0] : null
      void original
      void init
      req
        .then((res) => {
          try {
            const ct = String((res.headers && res.headers.get && res.headers.get('content-type')) || '')
            if (!/json|text/i.test(ct)) return
            res
              .clone()
              .text()
              .then((text) => {
                if (text && text.length <= MAX_BODY) SEND({ url, status: res.status, body: text })
              })
              .catch(() => {})
          } catch (_) {
            /* headers/clone non disponibles */
          }
        })
        .catch(() => {})
      return req
    }
  }

  // ----- XMLHttpRequest ------------------------------------------------------
  const XHR = window.XMLHttpRequest
  if (XHR && XHR.prototype) {
    const origOpen = XHR.prototype.open
    const origSend = XHR.prototype.send
    XHR.prototype.open = function (method, url) {
      try {
        this.__drUrl = String(url || '')
      } catch (_) {
        this.__drUrl = ''
      }
      return origOpen.apply(this, arguments)
    }
    XHR.prototype.send = function () {
      const self = this
      this.addEventListener('loadend', () => {
        try {
          const url = self.__drUrl || ''
          if (!INTEREST.test(url)) return
          const ct = String((self.getResponseHeader && self.getResponseHeader('content-type')) || '')
          if (!/json|text/i.test(ct)) return
          const body = typeof self.responseText === 'string' ? self.responseText : ''
          if (body && body.length <= MAX_BODY) SEND({ url, status: self.status || 0, body })
        } catch (_) {
          /* best-effort */
        }
      })
      return origSend.apply(this, arguments)
    }
  }
})()