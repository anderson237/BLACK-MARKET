# DeepRoots Import — Extension Chrome scraper fournisseurs (ST-020)

Extension **Manifest V3** qui permet d'importer un produit **directement depuis
le navigateur connecté de l'admin** pour les plateformes non atteignables côté
serveur par URL (login / anti-bot) : **Taobao, Tmall, 1688, Amazon, Goofish
(Xianyu), Douyin, TikTok Shop**.

Le pipeline d'import standard (`/api/admin/import/from-url`) ne peut pas lire
ces pages : l'extension tourne dans votre session réelle (cookies + login), elle
intercepte les **API internes JSON** de la page produit et envoie le payload au
serveur DeepRoots qui le transforme en **brouillon** via le pipeline existant
(conversion FCFA, transport, catégorie auto, mention suggérée, contact
fournisseur).

**Gratuit** — aucune dépendance à browserless/JustOneAPI pour ces sites.

---

## Installation (Load unpacked)

1. Récupérez ce dossier `browser-extension/` sur votre machine (copie du repo).
2. Ouvrez `chrome://extensions`
3. Activez **Mode développeur** (coin haut droit).
4. **Charger l'extension non empaquetée** → sélectionnez le dossier
   `browser-extension/`.
5. (Optionnel) rechargez la page produit ouverte pour que le hook
   d'interception (`document_start`) soit bien installé.
6. Cliquez sur l'icône 📦 → **Réglages** → saisissez votre **clé d'extension** →
   **Enregistrer**.

### Configuration de la clé `EXTENSION_IMPORT_KEY` (côté serveur)

La route `POST /api/admin/import/extension` valide le header `x-ext-key` en
temps constant contre `EXTENSION_IMPORT_KEY` :

- **En local** : si absent, le fallback de dev `bm-ext-import-dev-key` est actif.
- **En production (Netlify)** : la variable DOIT être définie dans
  **Site settings → Environment variables**, sinon la route renvoie un `401`
  explicite même avec le fallback. Astuce :
  `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`

---

## Utilisation

1. Ouvrez une **page produit** sur une plateforme supportée.
2. Cliquez sur l'icône de l'extension : le host est détecté.
3. **Importer ce produit** :
   - l'extension intercepte les API JSON de la page (sinon repli DOM),
   - extrait titre / prix (devise auto : ¥ / € / $) / images / vendeur,
   - envoie au serveur → retour d'un **draft complet** (prix FCFA, transport,
     catégorie, mention).
4. Boutons : **Ouvrir l'aperçu import** (page `/admin/import`) ou **Copier le
   JSON** du draft.

> 🧪 Astuce : vous pouvez pointer l'extension vers un serveur local
> (`http://localhost:3000`) dans les réglages pour tester le flux complet en dev.

---

## Architecture

```
manifest.json            MV3 : permissions storage ; host_permissions
                         [taobao, tmall, 1688, amazon.*, goofish, douyin, tiktok,
                          deeproots-importexport.netlify.app]
                         content_scripts ×2 (world MAIN + ISOLATED) à document_start
                         background service_worker
content-main.js          world MAIN : monkey-patch window.fetch + XMLHttpRequest
                         → postMessage {source:'dr-ext', body JSON ≤ 64 Ko}
content-isolated.js      world ISOLATED : pool des captures, heuristique d'extraction
                         (JSON puis DOM fallback) → répond DR_PING / DR_CAPTURE
background.js            service worker : reçoit DR_IMPORT_DRAFT → fetch POST
                         /api/admin/import/extension (header x-ext-key) — CORS OK
                         des seuls ici (host_permissions), jamais depuis un content script
popup.html / popup.js    clé + base URL (chrome.storage.local), bouton importer,
                         affichage du draft + accès /admin/import
```

### Points de sécurité

- **`webRequest` ne lit jamais le body en MV3** → interception dans le monde
  MAIN via monkey-patch `fetch`/`XHR` (seule technique fiable, cf. handoff).
- **Le content script NE fetch JAMAIS le serveur** (CORS de la page) : tout
  passe par le service worker + `host_permissions`.
- **Aucun token session admin** dans l'extension : clé **dédiée** `x-ext-key`,
  limitée à l'import de brouillons, validée strictement côté serveur
  (allowlist plateformes, prix, images ≤ 5, hôtes par plateforme, temps
  constant).
- Images envoyées en **URLs** (pas de base64) → téléchargement local par
  `importRemoteImage` côté serveur.
- Body JSON capturé tronqué à **64 Ko** ; pool borné (60 entrées) ; pas de
  `<all_urls>`.

---

## Limites volontaires

- **Périmètre v1 : 1 produit par page détail**. La liste de recherche (plusieurs
  produits d'un coup) = v2.
- Les sélecteurs DOM de repli sont best-effort : sur les pages très obfuscées,
  c'est le **JSON d'API** qui porte l'essentiel (titre, prix, images, vendeur).
- La publication n'est **jamais** directe : vous validez via l'aperçu import
  existant (`/admin/import` → publier).