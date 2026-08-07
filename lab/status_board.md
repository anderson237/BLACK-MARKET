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
| ST-012 | Chat commandes / précommandes (client ↔ admin) | LIVE | ✅ Déployé | Threads : `pre:<userId>` (panier), `pre:<userId>:<productId>` (**par article**, accordéon « style commentaires »), `general:<userId>` (**chat général**, onglet Chat du compte client), `ord:<orderId>` (commandes). Blob `bm-chat`. Client écrit depuis `/compte` (Précommandes : bouton **Message** par article → discussion dépliée, historique + post ; onglet **Chat** général ; Commandes), admin répond depuis `/admin/carts` (par article + panier + général) & `/admin/orders` (modal détail). Badges non-lus des deux côtés. **Désactivation à la livraison** : fil de commande `completed` verrouillé (lecture seule, 400 serveur client+admin, prop `locked` ChatPanel). **Migration** à la confirmation : tous les fils pre (legacy + par article) fusionnés dans le fil ordre avec dédupe par id, `clientReadTs`/`adminReadTs` max conservés. **Temps réel** : SSE + fallback poll 2 s. **Email admin** (Resend) à la confirmation. Test e2e prod OK (général, par article, lock livraison, migration multi-fils). Commits `29d090c`, `96e4954`, `c3da739`, `0083a1c` ; deploys `6a76231a6a27afd09fa22933`, `6a762e1c327b4f22a3fca706`, `6a76321eda82b423bfadd203`. |
| ST-013 | Temps réel site-wide + anti-flash + brouillon chat persistant | LIVE | ✅ Déployé | Répond à « le chat marche bien mais il y a un refresh qui flashe dans tout le site » (message détruit pendant la frappe) + « pourquoi le chat est instantané mais pas les stats/produits ». **Fix flash/saisie** : `/compte` squelettes seulement au 1er chargement (`v-if="loadingData && !data"`). **Brouillon persistant** : `ChatPanel` draftKey `bm_chat_draft_<side>_<threadId>` (sessionStorage, restaure au setup, clear après envoi). **Anti-FOUC thème** : script head inline avant premier paint (`bm_theme === 'light'` → classe `.light`). **Re-renders poll réduits** : stores chat/adminChat ne mutent que si `JSON.stringify` diffère. **SSE site-wide** : `server/utils/realtime.ts` → `publishSiteUpdate('catalog'|'orders'|'stats')` sur canal `site` ; endpoint public `server/api/events.get.ts` (sans auth, ping 15 s) ; mutations produits (post/put/delete/permanent/restore) et commandes (post/put/delete) publient ; client `composables/useSiteEvents.ts` (fetch SSE, backoff 0.5s..5s, dispatch `bm:site`), démarré depuis `app.vue`. Écouteurs : accueil (`store.refresh()` kind catalog), fiche produit (`refresh()` kind catalog + navigateTo si disparu), `/compte` (kind orders → reload silencieux 400 ms), layout admin (`loadOrders`+`loadStats` sur orders, `loadProducts` sur catalog). **Fallbacks poll** (limite Netlify push intra-instance constatée en e2e) : accueil 30 s, fiche produit 60 s (admin garde ses 12 s). Deploys `6a7639a013f8270ecd94957e`, `6a763bb6821d4e73c8f2b3a2`. |

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
| 2026-08-07 | 6a763bb6821d4e73c8f2b3a2 | ST-013 : fallbacks poll catalogue (accueil 30 s, fiche produit 60 s) — limite push intra-instance Netlify (build Nuxt) |
| 2026-08-07 | 6a7639a013f8270ecd94957e | ST-013 : SSE site-wide (catalog/orders/stats) + anti-flash `/compte` + brouillon chat + anti-FOUC thème (build Nuxt) |
| 2026-08-07 | 6a76321eda82b423bfadd203 | Chat par article + général + lock livraison (ST-012) — accordéons, threads `pre:<userId>:<productId>` / `general:<userId>`, migration multi-fils (build Nuxt) |
| 2026-08-07 | 6a762e1c327b4f22a3fca706 | Chat temps réel ST-012 : SSE push instantané + fallback poll 2 s (build Nuxt) |
| 2026-08-07 | 6a76231a6a27afd09fa22933 | Chat commandes/précommandes (ST-012) — threads client↔admin, badges, migration, email admin (build Nuxt) |
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
