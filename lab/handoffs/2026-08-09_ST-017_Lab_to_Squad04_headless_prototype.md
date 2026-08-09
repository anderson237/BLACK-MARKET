# HANDOFF — ST-017 : Prototype import headless goofish (remplacement JustOneAPI pour Xianyu)

| Champ | Valeur |
|---|---|
| **Date** | 2026-08-09 |
| **De** | Lab Director |
| **À** | Squad 4 (Chef) |
| **Stratégie** | ST-017 — Pipeline d'import Xianyu/Goofish (~150 produits/semaine) |
| **Priorité** | Haute |
| **Gate concernée** | 3 — Implémentation (prototype), puis validation Squad 5 |

---

## 1. Contexte (fait établi par le Lab)

Le compte **JustOneAPI est à solde zéro** (code 601 INSUFFICIENT BALANCE, vérifié le 2026-08-09 sur search + détail). Le pipeline d'import existant est entièrement bâti sur JustOneAPI → l'import est actuellement **bloqué**.

Le Lab a **testé en conditions réelles** (2026-08-09) un contournement headless **gratuit** et il **fonctionne pour goofish** :

- **Playwright** (open source, gratuit) pilote le navigateur **Edge headless** local
- Flag `--disable-blink-features=AutomationControlled` → l'anti-bot goofish n'est **pas déclenché** (aucun captcha, IP résidentielle locale)
- La page `/item?id=...` se charge, et l'**API interne MTOP** `mtop.taobao.idle.pc.detail` répond **`SUCCESS`** avec un JSON structuré complet (testé : titre, `soldPrice` 5300, `originalPrice` 6000, `desc`, `categoryId` 50025386, `sellerDO.nick`, `sellerDO.city`)
- **Fallback DOM direct** fonctionne aussi : titre, prix ¥, 133 images alicdn, description
- L'API MTOP de recherche `mtop.taobao.idlemtopsearch.pc.search` répond parfois `RGV587_ERROR` temporaire → **search intermittent**, à gérer (retry)

## 2. Couverture multi-sites testée (2026-08-09)

| Site | Headless | Statut |
|---|---|---|
| **Goofish/Xianyu détail** | ✅ FONCTIONNE (JSON complet) | Objectif principal |
| Goofish search | ⚠️ Intermittent (RGV587 retry) | À fiabiliser |
| 1688 | ⚠️ Redirection home sur l'URL testée (URL peut être invalide) | À retester avec URL valide |
| Taobao | ❌ Redirection login (exige compte) | Hors scope prototype |
| Amazon | ❌ Anti-bot 404 volontaire | Hors scope prototype |
| TikTok Shop / Douyin | Non testé | Hors scope prototype |

**Décision produit** : prototype headless **uniquement pour goofish**. Les autres plateformes restent sur JustOneAPI.

## 3. Architecture cible (validée par le Lab)

**Source toggleable par plateforme** : chaque plateforme (Xianyu, 1688, Taobao, Amazon, TikTok, Douyin) a un **sélecteur de source** `justone | headless` persisté dans les réglages admin (blob type `bm-sources`). Les deux moteurs coexistent ; on bascule à chaud sans redéployer.

## 4. Travail attendu (Squad 4)

1. **`server/utils/scraperGoofish.ts`** (nouveau) :
   - Lancer un navigateur headless (Edge local en dev / `chromium-headless-shell` en prod)
   - Ouvrir `https://www.goofish.com/item?id=<id>`, attendre le rendu
   - **Intercepter la réponse** `mtop.taobao.idle.pc.detail` (approche préférée, JSON structuré)
   - Fallback : extraction DOM (titre, prix, images, description)
   - Normaliser vers **le même format** que le flattener JustOneAPI existant (`JoDetailItem` / le schéma consommé par `draftBuilder.ts`) pour **zéro changement** côté UI/pipeline
   - Timeout total ~30-45 s, retry sur RGV587

2. **Route** `/api/admin/import/headless-detail` (ou intégration dans `draftBuilder.ts`) : appel `scraperGoofish` quand `source === 'headless'` et `platform === 'xianyu'`

3. **Toggle source** : route `GET/PUT /api/admin/import/sources` + UI dans Réglages admin (sélecteur par plateforme). Par défaut : goofish = `headless` (le solde étant à zéro), autres = `justone`.

4. **Dépendance** : ajouter `playwright-core` en **dépendance de production** (12,8 Mo client seul, acceptable). Le binaire navigateur n'est PAS embarqué dans le repo → dev : Edge local ; prod : télécharger `chromium-headless-shell` (~110 Mo) dans `.netlify/functions-internal` lors du build OU piloter un navigateur distant (plan B si la limite 250 Mo Netlify est dépassée).

## 5. Contraintes

- **Ne pas casser** le chemin JustOneAPI existant (il doit rester utilisable quand le solde est rechargé)
- Format de sortie **identique** au schéma actuel → `draftBuilder.ts`, UI import, publication **inchangés**
- Test de bout en bout requis : lien goofish réel `https://www.goofish.com/item?id=1072126350734` (iPhone 16 Pro Max, prix 5300 ¥)
- Vérifier la **taille du bundle Netlify** et le **temps d'exécution** de la fonction

## 6. Critères d'acceptation

1. L'import par lien goofish produit un brouillon complet (titre, prix converti FCFA, images locales, description, vendeur) **sans appel JustOneAPI**
2. Le toggle de source fonctionne (bascule à chaud)
3. Le chemin JustOneAPI reste fonctionnel quand le solde revient
4. Déploiement Netlify OK (bundle ≤ 250 Mo, exécution dans les temps)

## 7. Références utiles

- Test réussi (Lab) : scripts dans `%TEMP%\opencode\headless-*.cjs` (à reconstruire côté squad)
- `server/utils/justone.ts` : flattener à imiter (interface `JoDetailItem` ~ligne 100-140)
- `server/utils/draftBuilder.ts` : pipeline draft partagé
- `server/api/admin/import/from-url.post.ts` : route existante à brancher
- `pages/admin/settings.vue` : où ajouter le toggle de source

## 8. Sortie attendue

- Code + tests du prototype
- Rapport de validation (taille bundle Netlify, temps d'exécution, succès/échec des 2 scénarios : headless goofish + JustOneAPI)
- Handoff retour vers le Lab pour la gate suivante (validation Squad 5)

**Signé : Lab Director — 2026-08-09**
