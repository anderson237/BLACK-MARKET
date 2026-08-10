# Handoff — Lab → Squad 4 (Chef) — ST-020 Extension Chrome scraper fournisseurs

- **Date** : 2026-08-10
- **De** : Lab Director
- **À** : Squad 4 (Stratégie / Dev produit)
- **Tickets liés** : BL-010. **Recherche préalable faite (Squad 3, gate 2 ✅)** — sources datées 2026 consignées dans ce handoff.

## Demande utilisateur (verbatim)

> PR LES SITE non atteignable par url, on peux pas avoir une extension chrome? pour scrapper?

## Problème résolu

Taobao (redirection login), Amazon (anti-bot 404) et 1688 (redirection home) ne sont pas scrapables côté serveur (headless sans session). **Une extension Manifest V3 tourne dans le navigateur CONNECTÉ de l'admin** → session + cookies réels → plus de login/anti-bot. Données envoyées au pipeline d'import existant. **Gratuit** (pas de browserless ni JustOneAPI).

## Recherche (faite, à ne pas refaire)

1. **Interception réseau MV3** : `chrome.webRequest` ne donne JAMAIS le body en MV3 (même observationnel) ; `declarativeNetRequest` ne lit pas le body. **Seule technique fiable : injection MAIN world + monkey-patch `window.fetch`/`XMLHttpRequest`** (`"world": "MAIN"`, `run_at: "document_start"`, `res.clone()` pour ne pas consommer la réponse, cap ~64 Ko, `window.postMessage` vers le content script isolé). Sources : BugMojo (2026-05), NeoFetchSpy (GitHub), icceey/request-helper (GitHub), RequestBridge (dev.to 2026-06). → **Même pattern que notre MTOP goofish headless, mais côté navigateur.**
2. **CORS extension → serveur** : avec `host_permissions` incluant `https://deeproots-importexport.netlify.app/*`, le **service worker** peut fetch DeepRoots en same-origin SANS CORS ni préflight. **Le content script**, lui, reste soumis au CORS de la page → **ne JAMAIS fetch le serveur depuis le content script** : il envoie le payload via `chrome.runtime.sendMessage` au service worker qui fait le fetch serveur. (Chrome for Developers — Cross-origin network requests ; SO 68411923.)
3. **Auth** : ne pas stocker le token session admin dans l'extension. **Clé d'extension dédiée** `x-ext-key` (chrome.storage.local, saisie une fois dans le popup) ; le serveur la valide + limite aux actions d'import. (Chrome security recommendations.)
4. **Images** : l'extension envoie les **URLs** (pas de base64) → le serveur utilise `importRemoteImage` existant (déjà le cas pour goofish headless). Payload léger.
5. **Distribution** : usage admin solo → **Load unpacked** (`chrome://extensions` → Developer mode) ; packaging zip en bonus. Pas besoin de Chrome Web Store.
6. **Périmètre v1 recommandé** : **1 produit par page détail** (clic bouton extension → extraction → aperçu → envoi). Liste de recherche = v2.

## Spec technique

### A. Côté serveur (Nuxt) — 1 route + 1 helper

- **Clé d'extension configurable** : nouvelle clé admin `EXTENSION_IMPORT_KEY` (env) + valeur par défaut fallback documentée ; route de vérification de la clé au lancement (ou retour 401 clair si absente en prod).
- **Route** `server/api/admin/import/extension.post.ts` (auth = header `x-ext-key` OU Bearer admin) :
  - Body : `{ platform, sourceId, url, title, chineseTitle?, description?, chineseDescription?, price (number, devise source), currency, images: string[] (≤5), seller?, condition?, category?, mention? }`
  - Réutilise `draftBuilder.ts` pour TOUT : conversion prix (via `priceToXof`/rates), transport, catégorie auto, contact fournisseur (`getSupplierContact`), mention suggérée (`suggestMention`). Ne PAS dupliquer la logique. Si possible appeler le pipeline draft avec un objet source unifié (à adapter légèrement).
  - Retour : le **draft complet** (`{ platform, sourceId, title, priceXof, transport, suggestedCategory, imageUrl, gallery, ... }`) identique au format de `/api/admin/import/from-url` → l'UI import existante peut l'afficher.
  - Pas de publication directe : l'admin valide via l'aperçu import existant (`publish.post.ts` inchangé). Optionnel : querystring `?auto=false`.
  - **Sécurité (gate 8)** : validation stricte du body (allowlist), `x-ext-key` comparé en temps constant (`safeEqual`), rate-limit.

### B. Côté extension (dossier `browser-extension/` à la racine du repo, hors build Nuxt)

Structure :

```
browser-extension/
  manifest.json          MV3 : permissions [storage, scripting?], host_permissions
                         [https://*.taobao.com/*, https://*.tmall.com/*, https://*.1688.com/*,
                          https://*.amazon.*/*, https://*.goofish.com/*, https://*.douyin.com/*,
                          https://*.tiktok.com/*, https://deeproots-importexport.netlify.app/*]
                         content_scripts (document_start, world ISOLATED) sur ces domaines
                          + world MAIN pour le hook réseau (2 entrées content_scripts)
                         background: service_worker
  content-main.js        MAIN world : monkey-patch fetch+XHR sur les URL API internes
                         (ex. mtop*, detail*, item*, goofish) → postMessage {source:'dr-ext', {url, status, body}}
  content-isolated.js    recoit via window.message, filtre par host, garde capturés en mémoire
                         + écoute le message "capture" du background, extrait le payload
                         (titre/prix/images/desc/seller selon platform) depuis le JSON capturé
                         OU fallback DOM (sélecteurs par site)
  background.js          reçoit {type:'IMPORT_DRAFT', payload} via runtime.onMessage
                         fetch POST https://deeproots-importexport.netlify.app/api/admin/import/extension
                         headers: {'Content-Type':'application/json', 'x-ext-key': key}
                         renvoie le draft à la popup
  popup.html/js          champ clé x-ext-key (storage.local), bouton "Importer ce produit",
                         état (capture OK / draft reçu / erreur), lien vers /admin/import
  README.md              installation Load unpacked + config clé
```

- **Déclenchement** : clic sur l'icône d'extension (popup) sur une page produit → content-isolated collecte le JSON capté (sinon DOM) → envoie à background → draft serveur → affiché dans la popup (titre, prix FCFA, images) → bouton **Ouvrir l'aperçu import** (lien `/admin/import?draft=...` — à définir) OU envoyer à publish. Périmètre minimal v1 : l'extension retourne le draft, l'admin le retrouve dans `/admin/import` (ré-utiliser le stockage de draft si existe, sinon affiche le JSON dans la popup avec bouton copier).

- ⚠️ **Garde-fous** : ne jamais laisser un site malveillant forger le message (le background ne fetch QUE des URLs prédéfinies sinon refuse) ; le body JSON capté est tronqué à 64 Ko ; pas de permissions `<all_urls>` inutiles.

### C. Critères d'acceptation (vérifiables)

1. Route extension POST : retourne un draft complet pour un payload Taobao simulé (= champ titre, priceXof converti via rates, transport, suggestedCategory, contact, mention) — test tsx `scripts/test-extension-import.ts`.
2. Route extension : 401 si `x-ext-key` manquant/incorrect ; 400 si payload invalide ; rate-limit OK.
3. Extension : installable via Load unpacked (manifest valide), hook MAIN world capte un fetch exemple (test manuel sur un site de test), popup affiche le draft.
4. Backward-compat : AUCUN changement sur `from-url.post.ts`, `draftBuilder.ts` sortie inchangée (adaptation additive seulement), `publish.post.ts` inchangé, UI import inchangée.
5. Build Nuxt ✅ (l'extension est hors build — un `./browser-extension` extra ne casse rien).
6. Handoff retour `lab/handoffs/2026-08-10_ST-020_Squad04_to_Lab.md` + itération `lab/iterations/2026-08-10_ST-020_cycle_1.md`.

## Livrables attendus
- Code serveur + extension + README + tests tsx + itération + handoff retour. **Ne pas committer/déployer** (le Lab valide). Si le volume est trop important, livrer d'abord la partie serveur (route+test) et le manifest/extension au minimum V1 fonctionnel.