# Handoff — Lab → Squad 4 (Chef) — ST-018 Mentions produit « Neuf / Occasion / Gros »

- **Date** : 2026-08-09
- **De** : Lab Director
- **À** : Squad 4 (Stratégie / Dev produit)
- **Tickets liés** : BL-009 (mentions), ST-018 (stratégie). ST-019 (fournisseurs dashboard) reste en attente pour un prochain handoff.

## Demande utilisateur (verbatim)

> pour les produit du site on peux avoir en edition et en ajout les mentions occasion gros neuf, etant donné que je touche à tout ça de part mes sites fournisseurs, et ces mentions devront apparaitre en vitrine
>
> etant donné les nouvelles option neuf gros et tout, en vitrine on pourras les utiliser comme filtres aussi, tout comme les filtre de categorie

## Exigences fonctionnelles

1. **Champ produit** : chaque produit a **une mention** parmi `neuf` | `occasion` | `gros` (optionnelle → pas de mention).
2. **Édition ET ajout** : la mention doit être sélectionnable
   - en **ajout manuel** (`ProductEditorModal` en mode création) ;
   - en **ajout via import** (brouillon `/admin/import`, avant publication) — avec **suggestion auto** depuis le contenu source (cf. mapping ci-dessous) mais toujours modifiable ;
   - en **édition** (`ProductEditorModal` existant, champs déjà présents `category`/`stockStatus` → ajouter à côté).
3. **Vitrine — affichage** :
   - **carte produit** (`components/ProductCard.vue`) : badge visible (ex: pastille colorée « NEUF » / « OCCASION » / « GROS ») ;
   - **fiche produit** (`pages/p/[id].vue`) : mention affichée (près de la catégorie).
4. **Vitrine — filtres** : un second ensemble de filtres (à côté des onglets catégorie) « Tous / Neuf / Occasion / Gros », **combinable** avec le filtre catégorie existant ET la recherche.
5. **Rétrocompatibilité** : produits sans mention → aucun badge, aucun filtre ne les exclut (sauf si on filtre par une mention, évidemment).

## Spec technique proposée

- **Type** (`types/index.ts`) : ajouter sur `Product` :
  ```ts
  /** Mention produit vitrine : neuf / occasion / gros (optionnelle). */
  mention?: 'neuf' | 'occasion' | 'gros'
  ```
- **Constante partagée** des mentions + libellés FR (ex. dans `types/index.ts` ou `server/utils/constants.ts`) :
  ```ts
  export const PRODUCT_MENTIONS = [
    { value: 'neuf', label: 'Neuf' },
    { value: 'occasion', label: 'Occasion' },
    { value: 'gros', label: 'Gros' },
  ] as const
  export type ProductMention = typeof PRODUCT_MENTIONS[number]['value']
  ```
- **Persistance** :
  - `server/utils/product.ts` `sanitizeProduct()` : accepter `mention` si elle est dans la liste autorisée, sinon `undefined` ;
  - `server/api/admin/import/publish.post.ts` : lire `body.mention` du brouillon et le persister ;
  - `server/api/admin/products.post.ts` / `products.put.ts` (ou l'endpoint d'édition existant) : passer `mention` ;
  - **backward compat** : les anciens produits sans `mention` restent valides (champ optionnel).
- **Import — suggestion auto** (draftBuilder / aperçu) : mapper depuis la source quand l'info est disponible :
  - goofish `condition` (`itemStatusStr`, ex. `在线`) — si le texte/`condition` contient `二手`/`旧`/`used` → `occasion` ; `全新`/`new` → `neuf` ;
  - plateformes 1688 (gros/B2B) : le champ **source.gros / wholesale** ou la nature 1688 peut pré-suggérer `gros` ;
  - sinon pas de suggestion (champ vide, l'admin choisit).
  - ⚠️ Ne pas casser `condition` existant (texte brut source) : `mention` est un champ **distinct, normalisé FR**.
- **Éditeur produit** (`components/ProductEditorModal.vue`) : `draft.mention` initialisé depuis `props.product?.mention`, select à 4 options (« — » / Neuf / Occasion / Gros), enregistré dans `buildProduct()` (à côté de `category`/`stockStatus`).
- **Import UI** (`pages/admin/import.vue`) : ajouter le même select dans le brouillon (section produits/catégorie), pré-rempli par la suggestion auto.
- **Carte produit** (`components/ProductCard.vue`) : badge top-zone (attention à ne pas recouvrir photo/vidéo — un badge compact en haut à gauche/droite selon les badges existants). Styles distincts par valeur (ex. Neuf=émeraude, Occasion=ambre, Gros=violet/rouge).
- **Fiche produit** (`pages/p/[id].vue`) : pastille/texte à côté de la catégorie.
- **Filtres vitrine** :
  - `stores/catalog.ts` : ajouter `activeMention = ref('Tous')` + `mentions` computed (`['Tous','Neuf','Occasion','Gros']`) + intégrer le filtre dans `filtered()` (combiné catégorie × mention × recherche) + `setMention()` qui appelle `resetAndSlice()` ;
  - `pages/index.vue` : ligne d'onglets mention sous les onglets catégorie (même style de pastilles, éventuellement plus compacte) ;
  - état vide adapté (« AUCUN DROP EN « {{ mention }} » »).
- **Exports/retours** : rien d'autre ne doit casser (le champ est optionnel partout).

## Critères d'acceptation (vérifiables)

1. En `/admin/catalog` (ajout manuel) : je peux choisir Neuf / Occasion / Gros → badge apparaît en vitrine.
2. En `/admin/import` : brouillon propose une mention auto (ex. produit 1688 → Gros ; produit goofish contenant 二手 → Occasion) et je peux la changer avant publication → persiste sur le produit publié.
3. En édition d'un produit existant : la mention est modifiable et conservée après sauvegarde.
4. Vitrine : les 3 mentions + « Tous » filtrent correctement, **combinés** avec catégorie et recherche.
5. Les produits anciens (sans `mention`) s'affichent toujours normalement.
6. Build ✅ (`npm run build`) et tests tsx éventuels (script `scripts/test-product-mention.ts` recommandé, même pattern que `test-publish-source-seller.ts`).

## Livrables attendus

- Code modifié + fichier `lab/iterations/2026-08-09_ST-018_cycle_1.md` (ou cycle conforme) avec preuves (tests tsx, build OK).
- Handoff retour `lab/handoffs/2026-08-09_ST-018_Squad04_to_Lab.md` signé (ce qui a été fait, fichiers touchés, preuves, limites).
- **Ne pas committer/déployer** : le Lab validera puis déploiera (gate 9-10).
