# Quant Lab — Status Board

> Tenue par : Lab Director — Dernière mise à jour : 2026-08-10

## Stratégies / Produits

| ID | Objet | Gate courant | Statut | Notes |
|----|-------|--------------|--------|-------|
| ST-001 | Rebranding BLACK MARKET → Deep Roots Logistics | 10 — LIVE | ✅ Déployé | Tagline « Votre ancre mondiale pour le commerce international », favicon/logo/SEO/meta mis à jour. |
| ST-002 | Renommage domaine Netlify → deeproots-importexport.netlify.app | 10 — LIVE | ✅ Déployé | Site Netlify renommé via API ; toutes les URL du code remplacées (robots, sitemap, og-image, social). |
| ST-003 | Nettoyage sourcing/Chine/EUR-RMB (images + descriptions live) | 10 — LIVE | ✅ Déployé | 16 produits nettoyés ; 3 images régénérées avec filigrane « DEEP ROOTS © 2026 » (prod_1, prod_1786019057166, prod_1786016492719). Aucune trace « BLACK MARKET » restante. |
| ST-004 | Fix login Google OAuth 2.0 | 10 — LIVE | ✅ Corrigé | Origine JavaScript `https://deeproots-importexport.netlify.app` ajoutée dans Google Cloud Console pour le client OAuth `809279866832-…`. Login fonctionnel. |
| ST-005 | Feature Promo / Réduction (badge %, prix barré, countdown) | 10 — LIVE | ✅ Déployé | Champs `discountPercent` + `discountEndsAt` sur Product ; éditeur admin ; badge `-X%` sur carte ; prix barré + prix promo ; countdown « Fin dans j h m s » (carte + fiche). |
| ST-006 | Devise configurable (XOF/EUR/USD) + sélecteur public | 10 — LIVE | ✅ Déployé | Devise par défaut persistée côté serveur (`/api/settings`) ; composable SSR-safe `useCurrency` (XOF unit canonique) ; sélecteur en header + drawer mobile ; conversion prix dynamique (cartes, fiche produit, compte client, WhatsApp). Préférence locale (localStorage) prioritaire. |
| ST-007 | Panier de précommandes + confirmation WhatsApp | 10 — LIVE | ✅ Déployé | Bouton PRÉCOMMANDER = ajouter au panier (API `/api/cart` persistée par utilisateur en blob) ; badge panier dans header + drawer ; dashboard client : onglet « Précommandes » avec **CONFIRMER** (par article) et **CONFIRMER TOUTES** → crée la commande + ouvre WhatsApp ; prix promo appliqué à l'ajout. |
| ST-008 | Admin : vue Paniers non confirmés (relance) | 10 — LIVE | ✅ Déployé | Page `/admin/carts` + route `/api/admin/carts` (joint comptes clients) : KPI, recherche, détail, bouton **RELANCER SUR WHATSAPP**. Lecture panier en consistance forte. |
| ST-009 | Export CSV des paniers non confirmés | 10 — LIVE | ✅ Déployé | Bouton **⬇ EXPORTER CSV** sur `/admin/carts` : exporte la liste filtrée au format Excel FR (BOM UTF-8, séparateur `;`). |
| ST-010 | Rappel automatique des paniers abandonnés | 10 — LIVE | ✅ Déployé | Netlify Scheduled Function `netlify/functions/remind-carts.mjs` (`@hourly`) → POST `/api/admin/reminders/run` (auth `x-task-secret`). Logique `server/utils/reminders.ts` : scan paniers inactifs ≥ 48 h, cooldown 72 h, journalisation `bm-reminders`. **Email réel ACTIF** (Resend). Bouton **⟳ LANCER LE RAPPEL** (dry-run). |
| ST-012 | Chat commandes / précommandes (client ↔ admin) | 10 — LIVE | ✅ Déployé | Threads `pre:<userId>`, `pre:<userId>:<productId>` (par article), `general:<userId>`, `ord:<orderId>`. Blob `bm-chat`. Badges non-lus. **Désactivation à la livraison** (fil `completed` verrouillé). **Migration** à la confirmation (fusion multi-fils + dédupe). **Temps réel** SSE + fallback poll 2 s. **Email admin** (Resend). Commits `29d090c`, `96e4954`, `c3da739`, `0083a1c` ; deploys `6a76231a…`, `6a762e1c…`, `6a76321e…`. |
| ST-013 | Temps réel site-wide + anti-flash + brouillon chat persistant | 10 — LIVE | ✅ Déployé | Fix flash/saisie `/compte` (squelettes au 1er chargement) ; brouillon persistant `ChatPanel` (sessionStorage) ; anti-FOUC thème ; re-renders poll réduits ; SSE site-wide (`server/utils/realtime.ts`, endpoint `/api/events` public, `useSiteEvents.ts`) ; fallbacks poll accueil 30 s / fiche 60 s. Commits `7b46e95` ; deploys `6a7639a0…`, `6a763bb6…`. |
| ST-014 | Fix suppression commandes + suppression comptes + UI dashboard client + sécurité admin | 10 — LIVE | ✅ Déployé | Modal confirmation suppression commande ; route `server/api/users/[id].delete.ts` (admin only) + nettoyage blobs ; **sécurité (gate 8)** : contrôle admin ajouté sur 9 routes (orders.get/put/delete, products.post/put/delete/permanent/restore, stats.get) ; fix light mode bulles chat. Deploy `6a7640ca…`. |
| ST-015 | Corbeille commandes + admin (admins/trésorerie/paniers) + partage + like persistant + temps réel | 10 — LIVE | ✅ Déployé | Soft-delete commandes + corbeille + restore/permanent ; verrou distribué `mutateOrders` (withBlobLock) ; consistance forte (loadUsers/loadAllOrders/loadTreasury…) ; retrait droits admin ; édition trésorerie (PUT /api/treasury/entries/:id) ; suppression panier (DELETE /api/admin/carts/:userId + purge threads) ; partage multi-réseaux ; like persistant ; highlight cartes. |
| ST-016 | Intégration PayUnit (paiement en ligne Mobile Money / carte) | 4 — Implémentation | 🚧 En cours | Hosted checkout PayUnit (`server/utils/payunit.ts`, `payment_country` selon pays) ; routes `/api/payments/initialize|status|webhook` ; blob `bm-payments` ; page `/paiement/retour` ; CONFIRMER lance le checkout (+ option WhatsApp). App DEEPROOTS créée (SANDBOX). **En attente API USER / API PASSWORD PayUnit** pour test e2e sandbox. Deploys `6a76a745…`, `6a76ffc5…`, `6a7700f8…`, `6a770274…`. |
| ST-017 | Pipeline d'import multi-plateforme (Xianyu/Goofish, 1688, Taobao, TikTok Shop, Amazon, Douyin) | 4 — Implémentation | 🚧 En cours (headless goofish LIVE) | Client JustOneAPI (`server/utils/justone.ts`) ; import par lien (`urlParser.ts` + `/api/admin/import/from-url`) ; taux modifiables (blob `bm-rates`, carte 💱) ; historique/cache ; 3 prix (¥/CFA/marché local) ; transport transitaire configurable ; **headless goofish browserless LIVE en prod** (BL-007) ; **traduction FR auto à l'import** + 2 prix côte à côte (deploy `6a78278b`) ; **URL source + seller persistés** (livré Squad 4, non encore déployé). |
| ST-018 | Mentions produit « Neuf / Occasion / Gros » + filtres vitrine | 10 — LIVE | ✅ Déployé `6a79a89b…` | Champ `mention?: 'neuf'\|'occasion'\|'gros'` sur Product ; constante `PRODUCT_MENTIONS` partagée ; allowlist stricte dans `sanitizeProduct` ; select en ajout manuel/import/édition ; **suggestion auto à l'import** (`suggestMention()` : 1688/B2B→gros, 二手/旧/used→occasion, 全新/brand new→neuf, sinon vide) — `condition` brut source inchangé et distinct ; badge coloré carte (Neuf=émeraude, Occasion=ambre, Gros=violet) ; pastille fiche produit ; **filtres vitrine combinables catégorie×mention×recherche** (`stores/catalog.ts` activeMention + `pages/index.vue`). Backward-compat produits anciens ✅ (aucune mention). Commit `0b056e6` ; test tsx 24/24 ✅. |
| ST-019 | Dashboard admin : gestionnaire de fournisseurs | 10 — LIVE | ✅ Déployé `6a79a89b…` | Blob `bm-suppliers`/`suppliers.json` + `Server.ts` : `listSuppliers`, `createSupplier`, `updateSupplier`, `deleteSupplier`, `upsertSupplierFromProduct` (dédup nom normalisé + fusion additive, productIds, productCount, stats, `manual` flag). Routes admin GET/POST/PUT/DELETE (auth admin, doublon 409, inconnu 404). **Capture auto** hook dans `publish.post.ts` (try/catch non bloquant). Page `/admin/suppliers` (liste, recherche, filtre auto/manuel, KPI, modal création/édition, accordéon produits) + lien sidebar. Test tsx 6 scénarios ✅ ; e2e prod CRUD ✅ (PUT édition 200, doublon 409, DELETE 200). Commit `0b056e6`. |

## Tickets Lab (BL)

| ID | Objet | Priorité | Notes |
|----|-------|----------|-------|
| BL-001 | ~~Sélecteur de devise configurable~~ | — | ✅ **Fait** (ST-006). |
| BL-002 | ~~Suppression complète des références legacy `src/` (React)~~ | — | ✅ **Fait** (ST-011) : `src/`, `client-site/`, `server.ts`, `admin.html` supprimés ; deps React/Express/Leaflet/Recharts/dotenv retirées (**leaflet restauré ensuite** — utilisé par `components/GeoMap.vue`/`pages/admin/audience.vue`). |
| BL-003 | ~~Nettoyage `client-site/` (ancien domaine + ancien branding)~~ | — | ✅ **Fait** (ST-011). |
| BL-004 | ~~Admin : voir les paniers non confirmés~~ | — | ✅ **Fait** (ST-008). |
| BL-005 | **Solde JustOne API insuffisant** (code 601) | 🚧 Contournement testé | Solde épuisé (search + détail → 601). **Solution headless TESTÉE (2026-08-09)** : Playwright + Edge headless → goofish détail ✅ (API interne mtop.taobao.idle.pc.detail + DOM), Amazon ❌, Taobao ❌, 1688 ⚠️. **Décision** : source toggleable JustOneAPI ↔ headless par plateforme. |
| BL-006 | **Scrapabilité de DeepRoots** (constat, non bloquant) | ℹ️ Info | DeepRoots est SSR — le HTML brut contient tout le catalogue. Si protection requise : rate-limiting / protection `catalog.json` / obfuscation prix, en préservant le SEO. Décision utilisateur requise ; pas de ticket ouvert. |
| BL-007 | **Headless goofish (browserless)** (ST-017) | ✅ **LIVE** — testé en prod | Import par lien goofish via **browserless.io Free** (GOOFISH_BROWSER_WS_ENDPOINT en env prod). E2E prod : HTTP 200 en 15 s, engine: headless, iPhone 16 Pro Max, vendeur 小南科技数码 (深圳), 5300 ¥ → 503 500 FCFA, 5 images locales. **Toggle par plateforme** (Réglages → SOURCE D'IMPORT) + **fallback auto JustOneAPI**. Volume Free ≈ 500-800 extractions/mois (besoin ≈ 600). Commits `2e1e3aa`, `29dd454`, `e914058` ; deploys `6a78170d`, `6a781ab2`. |
| BL-008 | **Dashboard admin : gestionnaire de fournisseurs** | ✅ **Fait** (ST-019, deploy `6a79a89b…`) | Blob bm-suppliers + routes CRUD + capture auto à l'import + page /admin/suppliers. |
| BL-009 | **Mentions produit Neuf/Occasion/Gros** | ✅ **Fait** (ST-018, deploy `6a79a89b…`) | Champ mention normalisé + suggestion auto import + badge vitrine + filtres combinables. |

## Ressources IA mémorisées (2026-08-09)

| Source | URL | Usage |
|---|---|---|
| OpenRouter | https://github.com/OpenRouterTeam | Agrégateur multi-modèles IA (LLM) — API unifiée, à considérer pour traduction/vision si GEMINI_API_KEY limite |
| Paperclip AI | https://github.com/paperclipai | Dépend de la découverte ; à évaluer |
| Reverse Skill | https://github.com/zhaoxuya520/reverse-skill | À évaluer (scraping/reverse engineering ?) |
| free-ai-models | https://github.com/ClawLabsAI/free-ai-models | Liste quotidienne de modèles IA/LLM sans barrière payante |
| no-cost-ai | https://github.com/zebbern/no-cost-ai | 80+ services IA gratuits (chat, image, vidéo, voix, API) |
| ai-collection | https://github.com/ai-collection | Outils IA pratiques + générateurs visuels open source |

> À piocher au besoin (traduction auto, enrichissement IA, vision). Priorité : traduction FR des descriptions produit via Gemini (GEMINI_API_KEY déjà configurée).

## Historique des deploys

| Date | Deploy URL | Contenu |
|------|-----------|---------|
| 2026-08-10 | 6a79a89b2a9fd0b6923ed9d6 | **ST-018 + ST-019** : mentions produit (neuf/occasion/gros) — champ édition/ajout/import avec suggestion auto, badge carte + fiche, filtres vitrine combinables ; + gestionnaire de fournisseurs dashboard — blob bm-suppliers, routes CRUD admin, capture auto à l'import, page /admin/suppliers. Commit `0b056e6`. |
| 2026-08-09 | 6a78278b | ST-017 : **traduction FR auto à l'import** (Gemini, draftBuilder `hasCjk()`, dégradé si clé absente) + 2 prix côte à côte (¥ source + FCFA) + `aiEnrich` polish FR. |
| 2026-08-09 | 6a781ab2821d4e591ff2b19f | ST-017/BL-007 : headless goofish EN PROD via browserless — clé configurée ; fix endpoint `/chromium/playwright`. **E2E prod RÉUSSI** (200 en 15 s, engine headless, 5300 ¥ → 503 500 FCFA). |
| 2026-08-09 | 6a78170d5f6cf15b623e3e77 | ST-017/BL-007 : headless v2 — mode browserless WSS + toggle source par plateforme (`server/utils/sources.ts`, routes GET/PUT `/api/admin/import/sources`, carte SOURCE D'IMPORT) + engine.ts fallback auto JustOneAPI + badge moteur ; fix build leaflet ; fix UX 601. |
| 2026-08-09 | 6a77fcbd1a77aa05a2a192bf | ST-017 : importer depuis un lien produit (urlParser, /api/admin/import/from-url, draftBuilder partagé, hints non-supportés) + taux de conversion persistants modifiables (blob `bm-rates`, carte 💱) + fix upload vidéo (.click() programmatique). |
| 2026-08-08 | 6a77908003f222a3008f75d4 | Import : fix images Taobao en recherche (`g.search[N].alicdn.com` → `img.alicdn.com/imgextra/`). |
| 2026-08-08 | 6a778b4d43195056ebc77567 | Vitrine : barre de recherche produit (titre/chinois/description/catégorie, combinée avec filtre catégorie). |
| 2026-08-08 | 6a7789332187baadc65f4dbe | Admin : infos fournisseur visibles et éditables dans le catalogue (fix `supplierContact` perdu à l'édition ; section « 📇 Contact fournisseur » éditable ; badge + Fiche fournisseur). |
| 2026-08-08 | 6a7786a7b8374abde18e079e | Vitrine : badge « ❤️ J'aime » retiré des cards produit (recouvrait la photo) — badge « 💬 Commenté » et glow restent. |
| 2026-08-08 | 6a7782992187ba912b5f4db0 | ST-017 : fix filtres catégorie vitrine (resetAndSlice/loadMore/refresh) + catégories auto à l'import (detectCategory, datalist transport+produits+seed ; nouvelle catégorie = filtre vitrine auto). |
| 2026-08-08 | 6a777f78bb09f7875a55c5f9 | ST-017 : fiche vendeur sur toutes les fiches produit (country/sellerName ajoutés) + filtres prix source ¥/$/€ + 🔥 BEST uniquement (Amazon). |
| 2026-08-08 | 6a777991db3b906e53abdb56 | ST-017 : nombre de résultats configurable (10/20/30/50/custom) + filtres prix min/max FCFA, ventes min, note min (avant troncature). |
| 2026-08-08 | 6a77769f1830de2889e19acd | ST-017 : tris universels prix ↑/↓ + 🔥 Produits du moment (ventes) + ⭐ Top note (TikTok/Douyin/1688) ; libellés SORTS harmonisés. |
| 2026-08-08 | 6a7772e6dc70690ae2e772f2 | ST-017 : MOQ + barème 1688, stock Taobao, contacts fournisseurs (blob bm-supplier-contacts), bouton fiche vendeur, suppression individuelle historique. |
| 2026-08-08 | 6a776dcdb2499cde21e8bf73 | ST-017 : fix images CDN anti-hotlink (referrerpolicy no-referrer) + fix inputs transport débordants. |
| 2026-08-08 | 6a776a86ced1266aa4f8cd67 | ST-017 : impl multi-plateforme cycle 2 — justone.ts 6 plateformes, région US/FR, taux EUR 655,957 fixe + USD 700 configurable, tris + métriques trending UI. |
| 2026-08-08 | 6a77626ac56797f450e8e330 | ST-017 : historique/cache recherches, 3 prix (yuan/CFA/marché local), estimation transport transitaire configurable (aérien/maritime). |
| 2026-08-08 | 6a775a80eeb48ffff222cc3d | ST-017 : traduction auto titres (batch Gemini au search) + prix ¥/CFA (1¥=95F) + fix modal Aperçu. |
| 2026-08-08 | 6a77574dff6f042f164ebbac | ST-017 : fix 401 import — headers Authorization (Bearer token) ajoutés aux appels search/draft/publish. |
| 2026-08-08 | 6a771a61f45a1a8b520bfad6 | ST-017 : import Xianyu/1688 — client JustOneAPI + routes admin import + UI /admin/import (token JUSTONE_API_KEY en prod). |
| 2026-08-08 | 6a7719f076ec248dc93898e1 | ST-017 : import Xianyu/1688 — premières routes + page. |
| 2026-08-08 | 6a767555da82b49d57adbe7f | ST-015 : like temps réel + idempotence par user + réparation like perdu au refresh. |
| 2026-08-08 | 6a76730e8c5929089bbea0d3 | ST-015 : corbeille visible partout — carte alerte Dashboard + lien sidebar + ancre `#corbeille` + resync store. |
| 2026-08-07 | 6a765397c56797b024e8e272 | ST-015 : loadTreasury en consistance forte — fix 404 édition trésorerie. |
| 2026-08-07 | 6a7651fd099a2b01744a7d77 | ST-015 : mutateOrders (verrou distribué) réécrit toutes les écritures orders. |
| 2026-08-07 | 6a7650ab6a27aff983a22c0e | ST-015 : corbeille commandes + retrait admins + édition trésorerie + suppression panier + partage multi-réseaux + like persistant + highlight cartes. |
| 2026-08-07 | 6a7640ca49ba94bd44e2538a | ST-014 : fix suppression commandes + suppression comptes + UI dashboard client + sécurité admin 9 routes + fix light mode bulles chat. |
| 2026-08-07 | 6a763bb6821d4e73c8f2b3a2 | ST-013 : fallbacks poll catalogue (accueil 30 s, fiche produit 60 s). |
| 2026-08-07 | 6a7639a013f8270ecd94957e | ST-013 : SSE site-wide (catalog/orders/stats) + anti-flash `/compte` + brouillon chat + anti-FOUC thème. |
| 2026-08-07 | 6a76321eda82b423bfadd203 | Chat par article + général + lock livraison (ST-012) — threads `pre:<userId>:<productId>` / `general:<userId>`, migration multi-fils. |
| 2026-08-07 | 6a762e1c327b4f22a3fca706 | Chat temps réel ST-012 : SSE push instantané + fallback poll 2 s. |
| 2026-08-07 | 6a76231a6a27afd09fa22933 | Chat commandes/précommandes (ST-012) — threads client↔admin, badges, migration, email admin. |
| 2026-08-07 | 6a761db4dad05aab57c58cc1 | Template email percutant + fix cooldown (ST-010). |
| 2026-08-07 | 6a761bae8e00e00d2bf33e26 | RESEND_API_KEY activée (redeploy). |
| 2026-08-07 | 6a761965b8374a89a48e06d7 | Nettoyage legacy + export CSV + rappel auto (build Nuxt). |
| 2026-08-07 | 6a7617b11a77aa7cf5a192cd | Secret NUXT_TASK_SECRET appliqué (redeploy). |
| 2026-08-07 | 6a761739dd545d5e2ead75a2 | Endpoint rappel + scheduled function (build Nuxt). |
| 2026-08-07 | 6a76168ddd545d57c5ad77b7 | Export CSV + rappel auto (build Nuxt). |
| 2026-08-07 | 6a76131cb2499c5d0de8bfe1 | Admin Paniers non confirmés + consistance forte (build Nuxt). |
| 2026-08-07 | 6a76105d5973314cddb374ce | Panier de précommandes + confirmation WhatsApp (build Nuxt). |
| 2026-08-07 | 6a75df55d31e83f0d26d1b | Devise configurable XOF/EUR/USD (build Nuxt). |
| 2026-08-07 | 6a75c245706fad2ea22fd4af | Rebrand + promo (build Nuxt). |
| 2026-08-07 | 6a75b9f09487b322ce4ca3b3 | Domaine renommé. |
