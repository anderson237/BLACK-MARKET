# HANDOFF — ST-017 : Persister + afficher URL source & infos fournisseur (éditeur produit)

| Champ | Valeur |
|---|---|
| **Date** | 2026-08-09 |
| **De** | Lab Director |
| **À** | Squad 4 (Chef) |
| **Stratégie** | ST-017 — Pipeline d'import |
| **Priorité** | Moyenne (retour utilisateur) |

---

## 1. Demandes utilisateur (verbatim reformulé)

1. « Étant donné qu'on fait du scraping par URL, c'est pas possible de gather aussi les infos du fournisseur ? » → **OUI c'est possible et déjà capturé** — il faut les persister et les afficher.
2. « Pour les produits importés par URL ou API, dans la section produit en édition ou modification, on doit voir l'URL du produit, pour un accès plus rapide » → afficher l'URL source dans l'éditeur produit.

## 2. État actuel (vérifié par le Lab)

- `draftBuilder.ts` expose déjà dans le draft : `url` (ligne 225), `seller` (ligne 243 : `{ nick, city, soldCount, goodRemarkCnt, badRemarkCnt, replyRatio24h, newGoodRatioRate, zhimaVerified, itemCount }`), `supplierContact` (ligne 255 : `{ wechat, email, whatsapp, phone, website, note }`)
- `server/api/admin/import/publish.post.ts` persiste **seulement** `supplierContact` (ligne 165) — **PAS** `url` ni `seller`
- `server/utils/product.ts` `sanitizeProduct` n'a **pas** de champ `sourceUrl` ni `seller`
- Le composant `components/ProductEditorModal.vue` affiche déjà une section « 📇 Contact fournisseur » (commit `6a778933`) — mais pas l'URL source ni les infos seller

## 3. Travail attendu (Squad 4)

### 3.1 Persister URL source + seller à la publication
Dans `publish.post.ts` :
- Lire `url` et `seller` depuis le body (le front les envoie déjà depuis le draft)
- Les inclure dans l'objet passé à `sanitizeProduct` : `sourceUrl`, `seller`

Dans `sanitizeProduct` (`server/utils/product.ts`) :
- Ajouter `sourceUrl: clean(body?.sourceUrl)` (ou undefined si vide)
- Ajouter `seller` (objet limité à quelques champs propres : `{ nick, city, soldCount, replyRatio24h, newGoodRatioRate, zhimaVerified }` — nettoyer, pas d'objets géants)
- Ne pas casser l'existant

⚠️ **Backward compat** : les produits déjà publiés n'auront pas `sourceUrl`/`seller` — l'UI doit gérer l'absence.

### 3.2 Afficher l'URL source dans l'éditeur produit
Dans `components/ProductEditorModal.vue` :
- Champ **URL produit source** (texte non-éditable ou éditable — à ton jugement, lisible au minimum) affiché dans le modal d'édition, avec un lien cliquable « Ouvrir la source ↗ » si `sourceUrl` existe
- Si absent (produit manuel/ancien) : rien ou champ vide

### 3.3 Afficher les infos fournisseur (seller) dans l'éditeur
- Section qui affiche le seller capturé : pseudo/nick, ville, ventes, taux de réponse, vérification zhima — **en lecture seule** (c'est une donnée scraping)
- Reste séparée du « Contact fournisseur » éditable (wechat/email/…) qui existe déjà

### 3.4 (Bonus si simple) — fiche vitrine
- Vérifier si la fiche produit vitrine (pages/p/[id].vue ou composant) affiche déjà le vendeur — le commit `6a777f78` affichait le contact fournisseur. Si le seller (nick/ville) peut y être ajouté simplement, fais-le ; sinon note-le pour un ticket séparé.

## 4. Contraintes

- **Ne pas casser** : produits existants sans les nouveaux champs, toggle headless/justone, chemin JustOneAPI
- Format produit : `sourceUrl` string (URL plateforme), `seller` objet propre et court
- Build `npm run build` passe

## 5. Critères d'acceptation

1. Publier un produit importé → `sourceUrl` + `seller` persistés dans le blob produits
2. Éditer ce produit → URL source visible (lien cliquable) + infos seller affichées en lecture seule
3. Produits anciens/manuels → UI propre (pas de crash, champs vides ou masqués)
4. Build OK

## 6. Références

- `server/api/admin/import/publish.post.ts` (persistance actuelle, ligne 165)
- `server/utils/product.ts` `sanitizeProduct` (lignes 1-33)
- `server/utils/draftBuilder.ts` (draft : url ligne 225, seller ligne 243, supplierContact 255)
- `components/ProductEditorModal.vue` (section Contact fournisseur existante)
- `pages/admin/catalog.vue` (liste produits admin)

## 7. Sortie attendue

- Code + test tsx (publish d'un draft → produit avec sourceUrl/seller → lecture OK)
- Rapport : champs persistés, UI, compat produits anciens
- Handoff retour Lab

**Signé : Lab Director — 2026-08-09**
