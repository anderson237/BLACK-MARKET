// ---------------------------------------------------------------------------
// DeepRoots Import — popup.js (ST-020)
//
// Flux :
//   1. Au chargement : détecte l'onglet actif + host supporté (DR_PING) et
//      charge la clé/base depuis chrome.storage.local.
//   2. « Importer ce produit » : DR_CAPTURE → content-isolated renvoie un
//      payload → DR_IMPORT_DRAFT → background POSTe au serveur et renvoie le
//      draft complet (titre FR, prix FCFA, transport, catégorie, images).
//   3. Bouton « Ouvrir l'aperçu import » : le draft est PERSISTÉ côté serveur
//      (POST /api/admin/import/extension → blob bm-extension-drafts) ; on ouvre
//      /admin/import?ext=<draftId> qui charge l'aperçu pré-rempli pour publier.
//      « Copier le JSON » recopie le draft brut.
// ---------------------------------------------------------------------------
const $ = (id) => document.getElementById(id)

const state = { tab: null, payload: null, lastDraft: null, draftId: '' }

function fmtInt(n) {
  try {
    return new Intl.NumberFormat('fr-FR').format(Number(n) || 0)
  } catch (_) {
    return String(n)
  }
}

function setStatus(text, kind) {
  const el = $('status')
  el.textContent = text
  el.className = 'status' + (kind ? ' ' + kind : '')
}

function setBusy(busy) {
  $('btn-import').disabled = busy
  $('spinner').style.display = busy ? 'inline' : 'none'
  $('btn-label').textContent = busy ? 'Extraction…' : 'Importer ce produit'
}

async function currentTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  return tabs && tabs[0]
}

async function pingTab(tab) {
  try {
    return await chrome.tabs.sendMessage(tab.id, { type: 'DR_PING' })
  } catch (_) {
    return null
  }
}

async function init() {
  const { drExtKey = '', drExtBase = 'https://deeproots-importexport.netlify.app' } = await chrome.storage.local.get(['drExtKey', 'drExtBase'])
  $('key').value = drExtKey
  $('base').value = drExtBase

  state.tab = await currentTab()
  const ping = state.tab ? await pingTab(state.tab) : null
  const hint = $('hint')

  if (!state.tab) {
    setStatus('Aucun onglet actif.', 'err')
    return
  }
  if (!ping || !ping.platform) {
    const host = state.tab.url ? new URL(state.tab.url).hostname : state.tab.id
    setStatus(`Page non supportée (${host}).`, 'err')
    hint.textContent =
      "Ouvrez une page PRODUIT sur Taobao, Tmall, 1688, Amazon, Goofish, Douyin ou TikTok Shop.\n" +
      "Si l'extension vient d'être installée, rechargez la page une fois."
    $('btn-import').disabled = true
    return
  }
  setStatus(
    `Host détecté : ${ping.platform} (${ping.host})${drExtKey ? ' — prêt.' : ' — ⚠️ saisissez la clé ci-dessous.'}`,
    drExtKey ? 'ok' : ''
  )
  $('btn-import').disabled = !drExtKey
  hint.textContent = 'Sur une page produit : l\'extension intercepte les API (JSON) et envoie le draft au pipeline d\'import DeepRoots.'
}

$('btn-save').addEventListener('click', async () => {
  const key = $('key').value.trim()
  const base = $('base').value.trim() || 'https://deeproots-importexport.netlify.app'
  await chrome.storage.local.set({ drExtKey: key, drExtBase: base })
  $('btn-import').disabled = !key
  setStatus(key ? 'Clé et serveur enregistrés ✅' : 'Clé vide — import désactivé.', key ? 'ok' : 'err')
})

$('btn-import').addEventListener('click', async () => {
  if (!state.tab) return
  setBusy(true)
  setStatus('Extraction du produit (JSON capturé ou DOM)…')
  let res = null
  try {
    res = await chrome.tabs.sendMessage(state.tab.id, { type: 'DR_CAPTURE' })
  } catch (_) {
    res = null
  }
  if (!res || !res.payload) {
    setBusy(false)
    setStatus((res && res.error) || "Extraction impossible — rechargez la page produit puis réessayez.", 'err')
    return
  }
  state.payload = res.payload
  setStatus('Payload extrait — envoi au serveur DeepRoots…')
  try {
    const bg = await chrome.runtime.sendMessage({ type: 'DR_IMPORT_DRAFT', payload: res.payload })
    setBusy(false)
    if (bg && bg.ok && bg.draft) {
      state.lastDraft = bg.draft
      state.draftId = bg.draftId || ''
      renderDraft(bg.draft)
      setStatus('Draft reçu ✅ (consultez l\'aperçu).', 'ok')
    } else {
      setStatus((bg && bg.error) || 'Erreur serveur (voir console).', 'err')
    }
  } catch (err) {
    setBusy(false)
    setStatus('Erreur : ' + String((err && err.message) || err), 'err')
  }
})

function renderDraft(d) {
  const box = $('draft-box')
  box.hidden = false
  const proto = d.imageUrl || (d.gallery && d.gallery[0]) || ''
  const price = fmtInt(d.priceXof ? Math.round(d.priceXof) : 0)
  $('draft').innerHTML = `
    <h3>${escapeHtml(d.title || 'Sans titre')}</h3>
    <div class="meta">${escapeHtml((d.platform || '') + ' · ' + (d.sourceId || ''))}</div>
    <div class="price">${price} FCFA${d.price ? ' <small style="color:#8fb6d3">(from ' + fmtInt(d.price) + ' ' + (d.currency || '') + ')</small>' : ''}</div>
    ${d.transport && d.transport.airXof ? '<div class="meta">Transport estimé : <b>' + fmtInt(Math.round(d.transport.airXof)) + ' FCFA</b>' + (d.transport.weightKg ? ' · poids ' + String(d.transport.weightKg).replace('.', ',') + ' kg' : '') + '</div>' : ''}
    ${d.suggestedCategory ? '<div class="meta">Catégorie suggérée : <b>' + escapeHtml(d.suggestedCategory) + '</b></div>' : ''}
    ${d.suggestedMention ? '<div class="meta">Mention : <b>' + escapeHtml(d.suggestedMention) + '</b></div>' : ''}
    ${(d.colors && d.colors.length) || (d.sizes && d.sizes.length) ? '<div class="meta">Variantes : <b>' + (d.colors && d.colors.length ? d.colors.length + ' couleurs' : '') + (d.colors && d.colors.length && d.sizes && d.sizes.length ? ' · ' : '') + (d.sizes && d.sizes.length ? d.sizes.length + ' tailles' : '') + '</b></div>' : ''}
    ${d.moq ? '<div class="meta">MOQ : <b>' + d.moq + ' pièce(s)</b></div>' : ''}
    ${d.packaging && (d.packaging.weightGrams || d.packaging.volumeCm3) ? '<div class="meta">Colis : <b>' + (d.packaging.weightGrams ? d.packaging.weightGrams + ' g' : '') + (d.packaging.weightGrams && d.packaging.volumeCm3 ? ' · ' : '') + (d.packaging.volumeCm3 ? d.packaging.volumeCm3 + ' cm³' : '') + '</b></div>' : ''}
    ${d.shipFrom ? '<div class="meta">Expédition : <b>' + escapeHtml(d.shipFrom) + '</b></div>' : ''}
    ${d.attributes && d.attributes.length ? '<div class="meta">Attributs : <b>' + d.attributes.length + '</b>' + (d.attributesTranslated && d.attributesTranslated.length ? ' — ' + d.attributesTranslated.slice(0, 6).map((a) => escapeHtml(a.name) + ' : ' + escapeHtml(a.value)).join(' · ') + (d.attributes.length > 6 ? ' …' : '') : '') + '</div>' : ''}
    ${d.videoUrl ? '<div class="meta">🎬 <a href="' + escapeAttr(d.videoUrl) + '" target="_blank" rel="noopener" style="color:#e879f9">Vidéo produit</a></div>' : ''}
    <div class="thumbs">${(d.gallery || []).slice(0, 5).map((u) => '<img src="' + escapeAttr(u) + '" alt="" loading="lazy" />').join('')}</div>
  `
  $('btn-details').hidden = false
  $('btn-copy').hidden = false
  $('btn-details').dataset.base = $('base').value.trim() || 'https://deeproots-importexport.netlify.app'
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]),
  )
}
function escapeAttr(s) {
  return escapeHtml(String(s || ''))
}

$('btn-details').addEventListener('click', () => {
  const base = $('btn-details').dataset.base || 'https://deeproots-importexport.netlify.app'
  // Deep link : ouvre la page Import avec le draft extension pré-chargé
  // (persisté côté serveur) → aperçu pré-rempli, aucune ressaisie.
  const q = state.draftId ? '?ext=' + encodeURIComponent(state.draftId) : ''
  chrome.tabs.create({ url: `${base.replace(/\/+$/, '')}/admin/import${q}` })
})

$('btn-copy').addEventListener('click', async () => {
  if (!state.lastDraft) return
  const json = JSON.stringify(state.lastDraft, null, 2)
  try {
    await navigator.clipboard.writeText(json)
    setStatus('JSON du draft copié 📋', 'ok')
  } catch (_) {
    setStatus('Impossible de copier (permission clipboard).', 'err')
  }
})

init().catch((err) => setStatus('Erreur init : ' + String((err && err.message) || err), 'err'))