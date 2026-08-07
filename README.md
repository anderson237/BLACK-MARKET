# DEEP ROOTS LOGISTICS — Import/Export & Précommandes

> Plateforme **import-export / précommande WhatsApp** : catalogue public de produits tendance,
> console d'administration sécurisée, traduction & copywriting IA (Gemini) et persistance Netlify Blobs.
> Stack **Nuxt 3 (SSR) + Nitro** déployée sur Netlify.

- **Boutique publique** : `https://deeproots-importexport.netlify.app/`
- **Console admin** : `https://deeproots-importexport.netlify.app/admin`

---

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Frontend + API | Nuxt 3 (SSR) + Nitro — `server/api/*` (h3 handlers), Pinia stores |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite`) |
| IA | `@google/genai` (Gemini API) : traduction / copywriting / génération de fiches |
| Persistance | Netlify Blobs (`bm-products`, `bm-images`, `bm-orders`, `bm-cart`, `bm-reminders`, …) — repli JSON local `data/` |
| Auth | Comptes (email/phone/mot de passe ou Google OAuth) + sessions ; admin via `ADMIN_PASSWORD`/`ADMIN_EMAILS` |
| Tâches planifiées | Netlify Scheduled Function `remind-carts` (rappel paniers abandonnés) → endpoint sécurisé `/api/admin/reminders/run` |

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

Lancez le serveur de développement (SSR Nuxt + API sur le même port) :

```bash
npm run dev
# → http://localhost:3000   (boutique publique)
# → http://localhost:3000/admin (console admin)
```

## Commandes

| Commande | Description |
|----------|-------------|
| `npm run dev` | Serveur de dev Nuxt (SSR + API) |
| `npm run build` | Build production Nuxt (`dist/` + fonctions Nitro) |
| `npm start` | Sert le build production (`nuxt preview`) |
| `npm run lint` | Vérification TypeScript (`nuxi typecheck`) |
| `node scripts/copy-scheduled-functions.mjs` | Copie `netlify/functions/*.mjs` vers `.netlify/functions-internal` (après build, avant deploy) |
| `npx netlify deploy --prod --dir="dist" --functions=".netlify/functions-internal"` | Déploiement production Netlify |

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
| `RESEND_API_KEY` | — | **Optionnel** — active l'envoi réel des emails de rappel paniers abandonnés |
| `NUXT_TASK_SECRET` | — | Secret partagé entre la scheduled function et l'endpoint de rappel |

## Flux business (précommande WhatsApp + sourcing Chine)

1. **Sourcing** : copiez une fiche brute fournisseur (Taobao / 1688 / WeChat) ou uploadez une photo d'usine.
2. **Traitement IA** : l'onglet admin `Génération IA` traduit, rédige le pitch et calcule les prix F CFA.
3. **Catalogue** : injectez le produit → persistance Netlify Blobs (survit aux rechargements/déploiements).
4. **Ventes** : chaque fiche porte un bouton `PRÉCOMMANDER` qui ajoute l'article au **panier** du client
   (compte connecté). Le client confirme depuis son dashboard → ouverture `wa.me` avec le bon pré-rempli.
5. **Relance** : la vue admin `Paniers` liste les paniers non confirmés ; un bouton **RELANCER SUR WHATSAPP**
   ouvre un message ciblé, et le rappel automatique (scheduled function) relance par email si `RESEND_API_KEY` est définie.

## Architecture du déploiement (Netlify)

```
netlify.toml
├── [build] command = "npm run build && node scripts/copy-scheduled-functions.mjs" → publish = "dist"
├── [functions] directory = ".netlify/functions-internal" (fichier serveur Nuxt + scheduled function copiée)
├── redirects /* → /.netlify/functions/server (SSR Nuxt)
├── headers de sécurité (CSP, X-Frame-Options, HSTS, ...) sur toutes les routes
└── règles de cache (assets immutables, img, pages produit, catalog no-store)
```

### Persistance & Netlify Blobs

- En **production Netlify** : produits, images, commandes, paniers, rappels, événements… vivent dans
  Netlify Blobs (`bm-*`). Lecture en **consistance forte** pour les données critiques (paniers, social).
- En **local** : repli sur `data/*.json` (fichiers, gitignorés).

### Rappel automatique des paniers abandonnés

- **Déclencheur** : Netlify Scheduled Function `netlify/functions/remind-carts.mjs` (`@hourly`) qui POST
  `/api/admin/reminders/run` avec le header `x-task-secret` (`NUXT_TASK_SECRET`).
- **Logique** : `server/utils/reminders.ts` — scanne les paniers inactifs depuis ≥ 48 h, respecte un
  cooldown de 72 h, journalise dans `bm-reminders`. **Dry-run par défaut** : aucun email tant que
  `RESEND_API_KEY` n'est pas configurée (l'UI admin permet de lancer un pass manuellement).

#### Activer l'envoi réel des emails (Resend)

1. Créez un compte sur **https://resend.com** (gratuit, ~100 emails/jour).
2. **API Keys** → Create API Key → copiez la clé (`re_…`).
3. Optionnel mais recommandé : **Domains** → Add Domain → suivez la vérification DNS (SPF/DKIM)
   pour expédier depuis votre propre domaine. Sans domaine vérifié, utilisez l'adresse de test
   `onboarding@resend.dev` pour valider le flux.
4. Définissez les variables dans **Netlify → Site settings → Environment variables** :
   - `RESEND_API_KEY` = `re_…`
   - `RESEND_FROM` = `"Deep Roots Logistics <no-reply@votre-domaine.com>"` (ou `"onboarding@resend.dev"` pour tester)
5. Redéployez (`netlify deploy --prod --dir="dist" --functions=".netlify/functions-internal"`).
   Le panneau « LANCER LE RAPPEL » de `/admin/carts` affiche alors **Mode ACTIF** et les emails partent réellement.

## Sécurité implémentée (voir `SECURITY.md` pour le détail)

- Authentification **côté serveur uniquement** (aucun fallback client). Sessions persistées côté serveur.
- Rate limiting par IP sur les endpoints sensibles (login, Google, upload, produits, clics).
- **Headers de sécurité** sur chaque réponse (CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS).
- **Validation des uploads** : signature magique (JPEG/PNG/GIF/WebP/BMP) vérifiée côté serveur.
- **Blobs** : pas de secret client exposé ; le runtime Netlify injecte `siteID`/`token`.

## Tests / validation

```bash
npm run lint   # TypeScript strict (nuxi typecheck)
npm run build  # build complet de bout en bout
```

---

© 2026 DEEP ROOTS LOGISTICS. Toutes les images et vidéos reçoivent un filigrane indélébile.
