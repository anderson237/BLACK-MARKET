# Handoff — Lab → Squad 4 (Chef) — ST-019 Dashboard admin : Gestionnaire de fournisseurs

- **Date** : 2026-08-09
- **De** : Lab Director
- **À** : Squad 4 (Stratégie / Dev produit)
- **Tickets liés** : BL-008 (fournisseurs), ST-019. ST-018 (mentions neuf/occasion/gros) fait l'objet d'un handoff séparé — **les deux tickets sont indépendants mais touchent l'éditeur produit ; se coordonner pour éviter les conflits sur `ProductEditorModal.vue`**.

## Demande utilisateur (verbatim)

> dashboard admin : section liste de fournisseurs (catégorie, infos) — ajout auto ou manuel

## Exigences fonctionnelles

1. **Section fournisseurs dans le dashboard admin** (nouvelle page ou onglet, ex. `/admin/suppliers`) :
   - **liste** des fournisseurs avec **catégorie** (produits/types fournis) et **informations** (nom, pays, WeChat/WhatsApp/email/téléphone/site, note) ;
   - **ajout manuel** : formulaire de création d'un fournisseur ;
   - **ajout auto** : tout fournisseur détecté à l'import (scraping seller + contact fournisseur) doit apparaître automatiquement dans la liste.
2. **Données déjà disponibles à exploiter** (aucun nouveau scraping requis) :
   - `Product.seller` (persisté à l'import : `nick`, `city`, `soldCount`, `replyRatio24h`, `newGoodRatioRate`, `zhimaVerified`) ;
   - `Product.supplierContact` (éditable par produit : `platform`, `sourceId`, `sellerName`, `country`, `wechat`, `email`, `whatsapp`, `phone`, `website`, `note`) ;
   - blob `bm-supplier-contacts` (`server/utils/storage.ts`, `getSupplierContact`/`mutateGeneric`) — contacts pré-capturés par plateforme+sourceId.
3. **Unification** : un fournisseur = une entrée unique (dédupliquée par nom/nick ou sourceId), enrichie à chaque rencontre (fusion des infos).
4. **Lien produit ↔ fournisseur** : cliquer sur un fournisseur → voir la liste des produits qui lui sont associés.

## Spec technique proposée

- **Modèle fournisseur** (blob `bm-suppliers`, fichier `suppliers.json` — à côté de `bm-supplier-contacts`) :
  ```ts
  interface Supplier {
    id: string                 // slug/nick unique (ex. 'xiao-nan-tech' ou sha1 du nom)
    name: string               // sellerName || seller.nick || 'Fournisseur inconnu'
    category?: string          // principale (ex. 'Électronique', 'Mode') — suggestion depuis les catégories produits
    country?: string
    platforms?: string[]       // xianyu, 1688, taobao… rencontrés
    sourceIds?: string[]
    wechat?: string
    email?: string
    whatsapp?: string
    phone?: string
    website?: string
    note?: string
    productIds?: string[]      // produits associés (liens)
    productCount: number
    stats?: { soldCount?: number; replyRatio24h?: string; newGoodRatioRate?: string; zhimaVerified?: boolean; lastSeenAt?: string }
    manual: boolean            // true = ajout manuel, false = auto (scraping)
    createdAt: string
    updatedAt: string
  }
  ```
- **Routes admin** : `server/api/admin/suppliers.get.ts`, `suppliers.post.ts` (création manuelle), `suppliers/[id].put.ts` (édition), `suppliers/[id].delete.ts` (optionnel) — auth admin (pattern `requireAdmin`).
- **Capture auto** : hook dans `publish.post.ts` (après persistance d'un produit avec `seller`/`supplierContact`) → `upsertSupplierFromProduct(product)` (dédup par nom, fusion, ajout du productId). Idéalement via `withBlobLock` pour éviter les écritures concurrentes (pattern `mutateOrders`/`mutateGeneric`).
- **Page admin** : `/admin/suppliers` — liste (nom, catégorie, pays, plateformes, nb produits, contacts), recherche, filtre auto/manuel, modal édition, bouton création manuelle, lien vers les produits du fournisseur. Lien dans la sidebar admin (ex. sous « Catalogue »).
- **Vue produits par fournisseur** : soit dans la page fournisseurs (accordéon), soit lien `/admin/catalog?supplier=<id>` (filtre côté client).
- **Backward compat** : aucune rupture attendue — fonctionnalité additive.

## Critères d'acceptation (vérifiables)

1. Un produit importé avec `seller.nick` + contact apparaît automatiquement dans la liste fournisseurs (dédup : 2 produits du même vendeur → 1 fournisseur, productCount=2).
2. Ajout manuel d'un fournisseur possible (tous champs).
3. Édition d'un fournisseur (nom, contacts, catégorie, note) persistée.
4. Filtres + recherche fonctionnels ; liste des produits du fournisseur accessible.
5. Build ✅ + test tsx (recommandé : `scripts/test-suppliers.ts` — upsert, dédup, fusion, manual).
6. Handoff retour `lab/handoffs/2026-08-09_ST-019_Squad04_to_Lab.md` signé (fichiers, preuves, limites).
- **Ne pas committer/déployer** : le Lab validera puis déploiera (gate 9-10).
