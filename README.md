# BLACK MARKET — SINO-PREP Console

Plateforme **no-code de sourcing & précommandes depuis la Chine (Taobao, 1688, WeChat)** vers le marché
francophone / africain. Console d'administration sécurisée + catalogue public avec boutons de précommande
WhatsApp, traductions IA Gemini et synchronisation automatique via Make.com + Google Sheets + GitHub Pages.

## Stack
- **Frontend** : React 19 + Vite + Tailwind CSS v4 + Motion
- **Backend** : Express + `@google/genai` (Gemini API)
- **Persistance** : fichier JSON serveur `data/products.json` + `localStorage`

## Démarrage local

Prérequis : Node.js ≥ 18.

```bash
npm install
```

Créez un fichier `.env` (voir `.env.example`) :

```
GEMINI_API_KEY=ta_cle_gemini
ADMIN_PASSWORD=ton_mot_de_passe_admin
```

Lancez le serveur de développement :

```bash
npm run dev
# → http://localhost:3000
```

## Modes d'exécution

| Commande | Description |
|----------|-------------|
| `npm run dev` | Serveur de dev avec HMR Vite |
| `npm run build` | Build production (`dist/`) |
| `npm run start` | Sert le build production |
| `npm run lint` | Vérification TypeScript (`tsc --noEmit`) |

## Variables d'environnement

| Variable | Défaut | Rôle |
|----------|--------|------|
| `GEMINI_API_KEY` | — | Clé de l'API Gemini (traduction/copywriting/prix) |
| `ADMIN_PASSWORD` | `ADMIN99` | Mot de passe de la console admin (à changer en production) |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Modèle principal |
| `GEMINI_FALLBACK_MODEL` | `gemini-2.5-flash-lite` | Modèle de repli |
| `PORT` | `3000` | Port HTTP |

> ⚠️ **Sécurité** : `ADMIN_PASSWORD` par défaut `ADMIN99` sert uniquement de démo. Définissez un mot de passe fort dans `.env` avant toute mise en production. La clé Gemini et le mot de passe ne quittent jamais le serveur.

## Flux business (précommande WhatsApp + sourcing Chine)

1. **Sourcing** : copiez la fiche brute d'un fournisseur (Taobao / 1688 / WeChat) ou uploadez la photo d'usine.
2. **Traitement IA** : l'onglet `[ 2 ] GÉNÉRATEUR DE FICHES IA` traduit, rédige le pitch de vente et calcule les prix EUR/XOF.
3. **Catalogue** : injectez le produit → il est persistant côté serveur et réapparaît après rechargement.
4. **Ventes** : chaque produit porte un bouton `Commander` qui ouvre WhatsApp (`wa.me`) avec un bon de précommande pré-rempli (titre + prix + photo). Chaque clic est comptabilisé.
5. **Automatisation (optionnelle)** : un webhook Make.com (Google Sheets → Gemini → `catalog.json`) alimente le site public.

## Déploiement

- **Site client (GitHub Pages, gratuit)** : copiez le code de l'onglet `[ 4 ] SCRIPT BOUTON WHATSAPP` dans un `index.html`, déposez le `catalog.json` exporté (onglet `[ 5 ] DÉPLOYER EN LIVE`) à côté, activez GitHub Pages.
- **Console admin complète (Cloud Run / Vercel / Render)** : build + démarrage Node.js. Le serveur expose l'API protégée, la persistance `data/products.json` et `/catalog.json`.

## Sécurité implémentée

- Authentification admin **côté serveur** (token de session, rate-limit 6 tentatives/min, verrouillage 60 s après 3 échecs, auto-déconnexion après 15 min d'inactivité).
- Rate-limit sur l'endpoint Gemini (10 req/min) pour protéger les crédits API.
- Template client : échappement HTML systématique (`escapeHtml`), `rel="noopener noreferrer"` sur tous les liens externes, filigrane `BLACK MARKET` sur tous les visuels.
