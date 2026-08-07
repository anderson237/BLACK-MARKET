# Quant Lab — Status Board

> Tenue par : Lab Director — Dernière mise à jour : 2026-08-07

## Stratégies / Produits

| ID | Objet | Gate courant | Statut | Notes |
|----|-------|--------------|--------|-------|
| ST-001 | Rebranding BLACK MARKET → Deep Roots Logistics | LIVE | ✅ Déployé | Tagline « Votre ancre mondiale pour le commerce international », favicon/logo/SEO/meta mis à jour. |
| ST-002 | Renommage domaine Netlify → deeproots-importexport.netlify.app | LIVE | ✅ Déployé | Site Netlify renommé via API ; toutes les URL du code remplacées (robots, sitemap, og-image, social). |
| ST-003 | Nettoyage sourcing/Chine/EUR-RMB (images + descriptions live) | LIVE | ✅ Déployé | 16 produits nettoyés ; 3 images régénérées avec filigrane « DEEP ROOTS © 2026 » (prod_1, prod_1786019057166, prod_1786016492719). Aucune trace « BLACK MARKET » restante. |
| ST-004 | Fix login Google OAuth 2.0 | LIVE | ✅ Corrigé | Origine JavaScript `https://deeproots-importexport.netlify.app` ajoutée dans Google Cloud Console pour le client OAuth `809279866832-…`. Login fonctionnel. |
| ST-005 | Feature Promo / Réduction (badge %, prix barré, countdown) | LIVE | ✅ Déployé | Champs `discountPercent` + `discountEndsAt` sur Product ; éditeur admin ; badge `-X%` sur carte ; prix barré + prix promo ; countdown « Fin dans j h m s » (carte + fiche). |
| ST-006 | Devise configurable (XOF/EUR/USD) + sélecteur public | LIVE | ✅ Déployé | Devise par défaut persistée côté serveur (`/api/settings`) ; composable SSR-safe `useCurrency` (XOF unit canonique) ; sélecteur en header + drawer mobile ; conversion prix dynamique (cartes, fiche produit, compte client, WhatsApp). Préférence locale (localStorage) prioritaire. |
| ST-007 | Panier de précommandes + confirmation WhatsApp | LIVE | ✅ Déployé | Bouton PRÉCOMMANDER = ajouter au panier (API `/api/cart` persistée par utilisateur en blob) ; badge panier dans header + drawer ; dashboard client : onglet « Précommandes » avec **CONFIRMER** (par article) et **CONFIRMER TOUTES** (bouton global) → crée la commande + ouvre WhatsApp ; prix promo appliqué à l'ajout. |
| ST-008 | Admin : vue Paniers non confirmés (relance) | LIVE | ✅ Déployé | Page `/admin/carts` + route `/api/admin/carts` (joint comptes clients) : KPI (paniers/articles/valeur), recherche, détail des articles, bouton **RELANCER SUR WHATSAPP** avec message pré-rempli. Lecture panier en **consistance forte** (fix du flux client + admin). |
| ST-009 | Export CSV des paniers non confirmés | LIVE | ✅ Déployé | Bouton **⬇ EXPORTER CSV** sur `/admin/carts` : exporte la liste filtrée (client, email, téléphone, pays, articles, total F CFA, dernière activité, détail, lien WhatsApp) au format Excel FR (BOM UTF-8, séparateur `;`). |
| ST-010 | Rappel automatique des paniers abandonnés | LIVE | ✅ Déployé | Netlify Scheduled Function `netlify/functions/remind-carts.mjs` (`@hourly`) → POST `/api/admin/reminders/run` (auth par `x-task-secret` = `NUXT_TASK_SECRET`, ou session admin). Logique `server/utils/reminders.ts` : scan paniers inactifs ≥ 48 h, cooldown 72 h, journalisation `bm-reminders` anti-doublon. **Email réel ACTIF** (clé Resend configurée) : template percutant texte + HTML (branding rouge, images produits, bouton CTA « CONFIRMER MA PRÉCOMMANDE », ligne FOMO) ; sujet accrocheur. Bouton **⟳ LANCER LE RAPPEL** dans l'UI admin (dry-run sûr, résultats affichés). |
| ST-012 | Chat commandes / précommandes (client ↔ admin) | DESIGN | 🔵 En cours | Threads de discussion : `pre:<userId>` (précommandes/panier) + `ord:<orderId>` (commandes). Client écrit depuis `/compte` (onglets Précommandes & Commandes), admin répond depuis `/admin/carts` & `/admin/orders`. Badges non-lus des deux côtés (sidebar admin + onglets client). Conservation des messages à la confirmation de précommande (migration pre→ord). Email admin à la confirmation de commande. Design doc : `lab/handoffs/2026-08-07_ST-012_design_tech.md`. |

## Backlog

| ID | Objet | Priorité | Notes |
|----|-------|----------|-------|
| BL-001 | ~~Sélecteur de devise configurable~~ | — | ✅ **Fait** (ST-006). |
| BL-002 | ~~Suppression complète des références legacy `src/` (React)~~ | — | ✅ **Fait** (ST-011) : `src/`, `client-site/`, `server.ts`, `admin.html`, scripts legacy supprimés. Seed produits migré `server/data/products-seed.ts` (byte-exact, import updaté) ; constantes `server/utils/constants.ts` ; README/tsconfig/package.json nettoyés ; deps React/Express/Leaflet/Recharts/dotenv retirées. |
| BL-003 | ~~Nettoyage `client-site/` (ancien domaine + ancien branding)~~ | — | ✅ **Fait** (ST-011) : dossier entier supprimé du repo. |
| BL-004 | ~~Admin : voir les paniers non confirmés~~ | — | ✅ **Fait** (ST-008). |

## Historique des deploys

| Date | Deploy URL | Contenu |
|------|-----------|---------|
| 2026-08-07 | 6a761db4dad05aab57c58cc1 | Template email percutant + fix cooldown (build Nuxt) |
| 2026-08-07 | 6a761bae8e00e00d2bf33e26 | RESEND_API_KEY activée (redeploy) |
| 2026-08-07 | 6a761965b8374a89a48e06d7 | Nettoyage legacy + export CSV + rappel auto (build Nuxt) |
| 2026-08-07 | 6a7617b11a77aa7cf5a192cd | Secret NUXT_TASK_SECRET appliqué (redeploy) |
| 2026-08-07 | 6a761739dd545d5e2ead75a2 | Endpoint rappel + scheduled function (build Nuxt) |
| 2026-08-07 | 6a76168ddd545d57c5ad77b7 | Export CSV + rappel auto (build Nuxt) |
| 2026-08-07 | 6a76131cb2499c5d0de8bfe1 | Admin Paniers non confirmés + consistance forte (build Nuxt) |
| 2026-08-07 | 6a76105d5973314cddb374ce | Panier de précommandes + confirmation WhatsApp (build Nuxt) |
| 2026-08-07 | 6a75df55d31e83f0d26d1b | Devise configurable XOF/EUR/USD (build Nuxt) |
| 2026-08-07 | 6a75c245706fad2ea22fd4af | Rebrand + promo (build Nuxt) |
| 2026-08-07 | 6a75b9f09487b322ce4ca3b3 | Domaine renommé |
