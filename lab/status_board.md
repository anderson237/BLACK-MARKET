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

## Backlog

| ID | Objet | Priorité | Notes |
|----|-------|----------|-------|
| BL-001 | ~~Sélecteur de devise configurable~~ | — | ✅ **Fait** (ST-006). |
| BL-002 | Suppression complète des références legacy `src/` (React) | Basse | `client-site/` et `src/` restent dans le repo mais ne sont plus déployés (le build Nuxt `dist/` est la prod). |
| BL-003 | Nettoyage `client-site/` (ancien domaine + ancien branding) | Basse | Non déployé, mais git-tracked. À régénérer via `build:legacy` si jamais utilisé. |
| BL-004 | Admin : voir les paniers non confirmés (abandon de précommande) | Moyenne | Le panier vit côté client ; une vue admin « Paniers » permettrait de relancer les clients inactifs. |

## Historique des deploys

| Date | Deploy URL | Contenu |
|------|-----------|---------|
| 2026-08-07 | 6a76105d5973314cddb374ce | Panier de précommandes + confirmation WhatsApp (build Nuxt) |
| 2026-08-07 | 6a75df55d31e83f0d26d1b | Devise configurable XOF/EUR/USD (build Nuxt) |
| 2026-08-07 | 6a75c245706fad2ea22fd4af | Rebrand + promo (build Nuxt) |
| 2026-08-07 | 6a75b9f09487b322ce4ca3b3 | Domaine renommé |
