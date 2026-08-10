// ---------------------------------------------------------------------------
// DeepRoots Import — background.js (service worker MV3, ST-020)
//
// Rôle : recevoir `{ type: 'DR_IMPORT_DRAFT', payload }` du popup et poster le
// payload vers la route `POST /api/admin/import/extension` du serveur DeepRoots
// avec la clé d'extension `x-ext-key`.
//
// ⚠️ CORS : le fetch CROISÉ doit partir du service worker (host_permissions
// dans le manifest) — JAMAIS depuis un content script, qui reste soumis au
// CORS de la page. Endpoint + hôtes autorisés par host_permissions.
//
// ⚠️ Garde-fous serveur : la route fait une validation STRICTE du payload
// (allowlist plateformes, prix, images ≤ 5, hôtes autorisés par plateforme).
// Ici on ré-aplique une vérification minimale (défense en profondeur) avant
// tout envoi réseau.
// ---------------------------------------------------------------------------
const DEFAULT_BASE = 'https://deeproots-importexport.netlify.app'
const PLATFORMS = ['xianyu', '1688', 'taobao', 'tiktok-shop', 'amazon', 'douyin-ec']

function storageGet(key, def) {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(key, (o) => resolve(o && o[key] !== undefined ? o[key] : def))
    } catch (_) {
      resolve(def)
    }
  })
}

async function sendToServer(payload) {
  const [base, key] = await Promise.all([
    storageGet('drExtBase', DEFAULT_BASE),
    storageGet('drExtKey', ''),
  ])
  if (!key) return { ok: false, error: "Clé d'extension manquante — saisissez-la dans le popup (réglages)." }

  const res = await fetch(`${base.replace(/\/+$/, '')}/api/admin/import/extension`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-ext-key': key,
    },
    body: JSON.stringify(payload),
  })
  let data = null
  try {
    data = await res.json()
  } catch (_) {
    /* réponse non-JSON */
  }
  if (!res.ok) {
    const msg = (data && (data.statusMessage || data.message)) || `HTTP ${res.status}`
    return { ok: false, status: res.status, error: msg }
  }
  return { ok: true, draft: data && data.draft }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.type !== 'DR_IMPORT_DRAFT') return false

  const payload = msg.payload || {}
  if (!PLATFORMS.includes(payload.platform)) {
    sendResponse({ ok: false, error: 'Plateforme non supportée.' })
    return false
  }
  if (!/^https?:\/\//i.test(String(payload.url || ''))) {
    sendResponse({ ok: false, error: 'URL source invalide.' })
    return false
  }
  if (!(Number(payload.price) > 0)) {
    sendResponse({ ok: false, error: 'Prix invalide (strictement positif requis).' })
    return false
  }
  if (!Array.isArray(payload.images) || payload.images.length > 5) {
    sendResponse({ ok: false, error: 'Images : de 0 à 5 URLs attendues.' })
    return false
  }

  // Réponse asynchrone → canal maintenu ouvert (return true).
  sendToServer(payload)
    .then((result) => sendResponse(result))
    .catch((err) => sendResponse({ ok: false, error: String((err && err.message) || err) }))
  return true
})