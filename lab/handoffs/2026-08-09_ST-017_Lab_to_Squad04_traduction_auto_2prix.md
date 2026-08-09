# HANDOFF — ST-017 : Traduction auto FR à l'import + affichage des 2 prix (¥ + FCFA)

| Champ | Valeur |
|---|---|
| **Date** | 2026-08-09 |
| **De** | Lab Director |
| **À** | Squad 4 (Chef) |
| **Stratégie** | ST-017 — Pipeline d'import Xianyu/Goofish |
| **Priorité** | Haute (retour utilisateur direct) |

---

## 1. Demandes utilisateur (verbatim)

1. « La description est en chinois, il faut rapidement traduire en français »
2. « Le prix de base doit être converti en CFA rapidement et affiché à côté du prix en yuan — je veux les 2 prix affichés »
3. (Repos IA ajoutés au board — pas un livrable code)

## 2. État actuel (vérifié par le Lab)

- `draftBuilder.ts` met `description: detail.desc` et `chineseDescription: detail.desc` → **description brute chinoise, PAS traduite à l'import**
- L'UI import (`pages/admin/import.vue`) a un checkbox « Enrichissement IA (traduction FR + copywriting + suggestion de prix) » (`aiEnrich`, ligne ~970) — **optionnel, pas automatique**
- `server/utils/ai.ts` existe : Gemini (`gemini-2.5-flash` + fallback `gemini-2.5-flash-lite`), `generateContentWithRetry()` — **GEMINI_API_KEY est configurée en prod**
- La route `/api/translate-product` existe (utilisée par `/admin/ai`) : traduit titre + description + suggère prix EUR/XOF
- Le draft contient déjà `price` (yuan) + `priceXof` (CFA converti) — mais l'affichage dans le modal import les montre séparément, pas côte à côte

## 3. Travail attendu

### 3.1 Traduction FR AUTOMATIQUE à l'import (priorité 1)
- **Dans `draftBuilder.ts`** : après construction du draft, si `description` contient des caractères non-latins (détection CJK) → appeler Gemini pour traduire en FR (réutiliser `generateContentWithRetry` de `ai.ts`).
- Contrat de sortie : `description` = version FR traduite ; `chineseDescription` = texte source conservé ; `chineseTitle` conservé ; `title` = titre FR si la traduction le fournit, sinon titre source.
- **Comportement dégradé** : si Gemini échoue (pas de clé, erreur réseau) → NE PAS bloquer l'import, garder la description source et logger un avertissement. L'import ne doit JAMAIS échouer à cause de la traduction.
- **Timeout raisonnable** : la traduction doit rester "rapide" (≤ ~10-15 s max). Si le délai est trop long, envisager de traduire le titre + un résumé court, pas forcément les 279 caractères de description complets — mais l'idéal est la traduction complète.
- Option : vérifier si l'enrichissement IA existant (à la publication) duplique la traduction → harmoniser (soit le draft traduit, soit le publish enrichit, PAS les deux de façon redondante — à ton jugement pour minimiser le coût API).

### 3.2 Affichage des 2 prix côte à côte (priorité 2)
- Dans le modal aperçu du draft (`pages/admin/import.vue`) : afficher **« Prix source : 5300 ¥ » ET « ≈ 503 500 FCFA »** côte à côte, bien visibles (le CFA en rouge/emphase, le ¥ à côté en secondaire).
- Vérifier aussi dans les résultats de recherche (les cards) : les 2 prix doivent être visibles (actuellement `fmtPrice(item)` + `≈ X FCFA` existent déjà — vérifier la cohérence).
- Le libellé du taux (1 ¥ = 95 FCFA) reste affiché.

### 3.3 (Si le temps le permet) — rappels
- Ne pas casser le toggle headless/justone ni le fallback JustOneAPI.

## 4. Contraintes

- **Ne jamais bloquer l'import** à cause de la traduction (dégradation propre)
- Format de sortie du draft inchangé sinon (ajout de champs OK)
- Build `npm run build` doit passer
- Ne pas déployer sans accord Lab ; commit local autorisé

## 5. Critères d'acceptation

1. Importer un lien goofish → le draft affiche la **description en FRANÇAIS** (et le chinois reste accessible si besoin)
2. Le draft affiche **les 2 prix côte à côte** : ¥ source + ≈ FCFA converti
3. Si Gemini tombe en panne → import fonctionne quand même (description source)
4. Build OK

## 6. Références

- `server/utils/draftBuilder.ts` (lignes ~77-124 : construction draft)
- `server/utils/ai.ts` (`generateContentWithRetry`, models)
- `server/api/translate-product.post.ts` (exemple de prompt traduction existant)
- `pages/admin/import.vue` (modal aperçu ~ligne 830-980, checkbox IA ~970)
- `pages/admin/ai.vue` (exemple d'UI traduction)

## 7. Sortie attendue

- Code + test tsx (import réel → description FR + 2 prix)
- Rapport : coût API estimé par import (tokens Gemini), temps moyen, comportement dégradé
- Handoff retour Lab

**Signé : Lab Director — 2026-08-09**
