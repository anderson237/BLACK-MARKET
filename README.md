# BLACK MARKET — SINO-PREP Console

> Plateforme **no-code de sourcing & précommandes depuis la Chine (Taobao, 1688, WeChat)**
> vers le marché francophone / africain. Console d'administration sécurisée + catalogue public
> avec boutons de précommande WhatsApp, traductions IA Gemini et persistance Netlify Blobs.

- **Boutique publique** : `https://blackmarket-import-export.netlify.app/`
- **Console admin** : `https://blackmarket-import-export.netlify.app/admin`

---

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Frontend (console) | React 19 + Vite + Tailwind CSS v4 + Motion + lucide-react |
| Boutique statique | HTML/JS vanilla auto-généré (`src/lib/template.ts`, `src/lib/productPage.ts`) |
| Backend | Express + `@google/genai` (Gemini API) exposé via Netlify Functions (`serverless-http`) |
| Persistance | Netlify Blobs (`bm-products`, `bm-images`) — fichier JSON `data/products.json` en local |
| Images filigranées | `sharp` à la génération (`scripts/build-site.ts`) + canvas côté client |
| Auth | Google OAuth (`GOOGLE_CLIENT_ID`) + clé `ADMIN_PASSWORD` (bearer token 12 h) |

## Démarrage local

Prérequis : **Node.js ≥ 18**.

```bash
npm install
```

Créez un fichier `.env` à partir de `.env.example` et renseignez au minimum :

```
GEMINI_API_KEY=ta_cle_gemini
ADMIN_PASSWORD=ton_mot_de_passe_admin_fort
```

Lancez le serveur de développement (HMR Vite + API Express sur le même port) :

```bash
npm run dev
# → http://localhost:3000   (boutique publique)
# → http://localhost:3000/admin (console admin)
```

## Commandes

| Commande | Description |
|----------|-------------|
| `npm run dev` | Serveur de dev avec HMR Vite (boutique + console + API) |
| `npm run build` | Build production complet : régénère la boutique statique (`tsx scripts/build-site.ts`), bundle React (`vite build`), bundle serveur (`esbuild`) et copie `client-site/` → `dist/` |
| `npm start` | Sert le build production (`dist/`) |
| `npm run lint` | Vérification TypeScript (`tsc --noEmit`) |
| `npx netlify deploy --prod --build` | Déploiement production Netlify |

## Variables d'environnement

Voir `.env.example` pour la liste exhaustive et les commentaires.

| Variable | Défaut | Rôle |
|----------|--------|------|
| `GEMINI_API_KEY` | — | Clé API Gemini (traduction / copywriting / prix) |
| `ADMIN_PASSWORD` | `ADMIN99` (⚠️ démo) | Clé d'accès console admin |
| `ADMIN_EMAILS` | `elomopatrick.pn@gmail.com` | Emails autorisés pour Google OAuth |
| `GOOGLE_CLIENT_ID` | — | Client ID Google OAuth |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Modèle Gemini principal |
| `GEMINI_FALLBACK_MODEL` | `gemini-2.5-flash-lite` | Modèle de repli |
| `PORT` | `3000` | Port HTTP local |
| `APP_URL` | — | URL publique (liens produits) |

## Flux business (précommande WhatsApp + sourcing Chine)

1. **Sourcing** : copiez une fiche brute fournisseur (Taobao / 1688 / WeChat) ou uploadez une photo d'usine.
2. **Traitement IA** : l'onglet `[ 2 ] GÉNÉRATEUR DE FICHES IA` traduit, rédige le pitch et calcule les prix EUR/XOF.
3. **Catalogue** : injectez le produit → persistance Netlify Blobs (survit aux rechargements/déploiements).
4. **Ventes** : chaque fiche porte un bouton `PRÉCOMMANDER` qui ouvre `wa.me` avec un bon de précommande pré-rempli. Chaque clic est comptabilisé.
5. **Pages produit** : chaque produit dispose d'une page `/p/<id>.html` statique (aperçu WhatsApp partagé, OG tags, image filigranée).

## Architecture du déploiement (Netlify)

```
netlify.toml
├── [build] command = "npm run build"  → publish = "dist"
├── redirects /admin → admin.html (SPA console)
├── redirects /api/* → /.netlify/functions/api/:splat
├── redirects /catalog.json → fonction API
├── headers de sécurité (CSP, X-Frame-Options, HSTS, ...) sur toutes les routes
└── règles de cache (assets immutables, img, pages produit, catalog no-store)
```

### Persistance & Netlify Blobs

- En **production Netlify** : les données produits (`bm-products`) et images (`bm-images`) vivent dans
  Netlify Blobs. La fonction `netlify/functions/api.ts` appelle `connectLambda(event)` en tête de chaque
  invocation — **indispensable** car le format Functions v1 (`export const handler`) n'injecte pas
  automatiquement la config Blobs (sinon `MissingBlobsEnvironmentError`).
- En **local** : repli sur `data/products.json` et `data/uploads/` (fichiers, gitignorés).

## Sécurité implémentée (voir `SECURITY.md` pour le détail)

- Authentification **côté serveur uniquement** (aucun fallback client). Bearer token 32 octets, TTL 12 h, logout invalide.
- Comparaison du mot de passe en **temps constant** (`crypto.timingSafeEqual`).
- **Rate limiting** par IP : login (6/min), Google (10/min), upload (30/min), produits (60/min), clics (120/min).
- **Verrouillage anti-bruteforce** côté client (60 s après 3 échecs) + auto-déconnexion après 15 min d'inactivité.
- **Headers de sécurité** sur chaque réponse (CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS).
- **CORS stricte** : toute requête avec un `Origin` qui ne correspond pas à notre host → 403.
- **Validation des uploads** : signature magique (JPEG/PNG/GIF/WebP/BMP) vérifiée côté serveur.
- **Echappement HTML** systématique dans la boutique (XSS) + filigrane `BLACK MARKET` sur tous les visuels.
- **Blobs** : pas de secret client exposé ; le runtime Netlify injecte `siteID`/`token`.

## Tests / validation

```bash
npm run lint   # TypeScript strict
npm run build  # build complet de bout en bout
```

---

© 2026 BLACK MARKET SINO-PREP SYSTEM. Toutes les images et vidéos reçoivent un filigrane indélébile.
