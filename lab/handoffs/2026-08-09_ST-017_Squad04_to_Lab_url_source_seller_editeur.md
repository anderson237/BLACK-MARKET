# HANDOFF RETOUR — ST-017 : Persister + afficher URL source & infos vendeur (éditeur produit)

| Champ | Valeur |
|---|---|
| **Date** | 2026-08-09 |
| **De** | Squad 4 — Chef Strategy Development |
| **À** | Lab Director |
| **Stratégie** | ST-017 — Pipeline d'import Xianyu/Goofish |
| **Statut** | ✅ Livré — code + test + rapport (aucun déploiement effectué) |

---

## 1. Fichiers modifiés / ajoutés

| Fichier | Changement |
|---|---|
| `types/index.ts` | Type `Product` : ajout `sourceUrl?: string` et `seller?: { nick, city, soldCount, replyRatio24h, newGoodRatioRate, zhimaVerified }` (docstring « lecture seule, scraping ») |
| `server/utils/product.ts` | `sanitizeProduct` : ajout `sourceUrl` (clean, `undefined` si vide) + `seller` nettoyé limité aux **6 champs** demandés (`nick`, `city`, `soldCount`, `replyRatio24h`, `newGoodRatioRate`, `zhimaVerified`) — aucun champ géant, `undefined` si aucun info exploitable. Rien d'existant modifié |
| `server/api/admin/import/publish.post.ts` | Lecture `body.url` (alias `sourceUrl` accepté) → passé comme `sourceUrl` ; `body.seller` (objet) → passé tel quel à `sanitizeProduct`. Header du body documenté. `supplierContact` inchangé |
| `pages/admin/import.vue` | `doPublish` : ajout `url: draft.value.url` et `seller: draft.value.seller` au payload publié (le front n'envoyait pas encore ces 2 champs malgré l'énoncé) |
| `components/ProductEditorModal.vue` | `draft` : `sourceUrl` + `seller` (préservés à la sauvegarde). Template : section **« 🔗 Source du produit »** (lien « Ouvrir la source ↗ », `target=_blank rel=noopener`, masquée si absente) + section **« 🛍️ Vendeur (scraping) »** (lecture seule, masquée si absente) — distinctes de « 📇 Contact fournisseur » |
| `pages/p/[id].vue` | Fiche vitrine : ajout du seller **nick + ville** en tête de la section « FICHE VENDEUR » existante ; bloc contact protégé (`v-if="supplierInfo"`) pour ne pas crasher quand seul le seller existe |
| `scripts/test-publish-source-seller.ts` | (nouveau) Test tsx du contrat publish → sanitizeProduct (4 scénarios) |

**Non touchés** : pipeline headless/justone/fallback (`scraperGoofish.ts`, `engine.ts`, `justone.ts`), recherche, `supplierContact` (contact editable), édition produit existante, `catalog.json` (les champs passent tels quels, `normalizeProduct` ne les retire pas).

---

## 2. Comportement implémenté

- **Persistance** : à la publication d'un draft import, `sourceUrl` (URL plateforme, ex. Goofish) et `seller` (objet court nettoyé) sont persistés dans le blob produits.
- **Sanitization** : `sourceUrl` → `String(...).trim().slice(0,4000)` sinon `undefined`. `seller` → seuls `{ nick, city, soldCount, replyRatio24h, newGoodRatioRate, zhimaVerified }` sont conservés (strings/`number`/`boolean` propres, `Math.round` sur `soldCount`), tout le reste (goodRemarkCnt, badRemarkCnt, itemCount, objets imbriqués) est **jeté**. `seller` est `undefined` si aucun champ exploitable.
- **Éditeur admin** : URL source visible en lecture seule avec lien cliquable ; infos vendeur affichées en lecture seule (nick, ville, ventes, taux de réponse 24 h, % neuf, badge Zhima) dans une section séparée du contact fournisseur éditable. Les deux sont **préservés** à la sauvegarde (un produit importé réédité ne les perd plus).
- **Fiche vitrine** : bonus fait — le seller (nick/ville) apparaît dans la section « FICHE VENDEUR » publique existante.

---

## 3. Preuves (test tsx — `scripts/test-publish-source-seller.ts`)

Commande : `npx tsx --tsconfig .nuxt/tsconfig.json scripts/test-publish-source-seller.ts`

### Scénario 1 — Publish avec url + seller (draft Goofish complet)
```
✅ sourceUrl persisté — https://www.goofish.com/item?id=1072126350734
✅ seller persisté         ✅ seller.nick — 赛博配件店
✅ seller.city — 深圳      ✅ seller.soldCount (nombre) — 842
✅ seller.replyRatio24h — 99%   ✅ seller.newGoodRatioRate — 98.6%
✅ seller.zhimaVerified (booléen) — true
✅ seller limité aux 6 champs propres (pas d'objets géants) — extra: aucun
✅ supplierContact toujours persisté — wb_2026
✅ champs produit existants intacts
```

### Scénario 2 — Publish SANS url/seller (produit manuel / ancien)
```
✅ aucun crash, id valide      ✅ sourceUrl absent → undefined
✅ seller absent → undefined   ✅ titres/prix conservés
```

### Scénario 3 — Robustesse (url vide / seller malformé)
```
✅ sourceUrl vide → undefined
✅ seller sans info exploitable → undefined
✅ id généré correctement
```

### Scénario 4 — Idempotence (re-sanitize d'un produit persisté)
```
✅ sourceUrl identique    ✅ seller identique
```

**Build** : `npm run build` ✅ passe (vérification officielle du projet).

Note : `npx nuxi typecheck` remonte des erreurs **pré-existantes** (auto-imports Nuxt `ref`/`computed`/`defineEventHandler` et alias `~/`/`~~/` non résolus dans tous les stores/composants, y compris ceux non touchés) — hors scope, ne bloque pas la livraison.

---

## 4. Compatibilité produits anciens / manuels

- Produits existants sans `sourceUrl`/`seller` : `sanitizeProduct` les produit avec `sourceUrl: undefined` et `seller: undefined` — **aucun crash**, champs vides.
- Éditeur : les deux sections sont masquées (`v-if`) quand les données sont absentes.
- Fiche vitrine : `supplierInfo || sellerInfo` + protections `v-if="supplierInfo"` — aucun accès à null.
- Le chemin headless/justone/fallback et la publication sans ces champs restent valides (scénario 2 du test).

---

## 5. Fiche vitrine — fait / laissé

- **Fait (simple)** : le seller scrapé (nick + ville) est affiché dans la section « FICHE VENDEUR » de `pages/p/[id].vue` (le contact fournisseur y était déjà affiché).
- **Laissé pour ticket séparé (optionnel)** : affichage des métriques seller (ventes, taux de réponse, badge Zhima) sur la **fiche publique** — non demandé, ajouterait du bruit client ; la donnée reste consultable côté admin.

---

## 6. Notes de sécurité / déploiement

- **Aucun déploiement effectué, aucune poussée sur `main`** (conforme aux contraintes).
- `sourceUrl` et `seller` transitent par `catalog.json` public (comme tous les champs produit) — données publiques du scraping (nick/ville/ventes), cohérent avec l'affichage « FICHE VENDEUR » déjà public.

**Signé : Chef Squad 4 — Strategy Development — 2026-08-09**
