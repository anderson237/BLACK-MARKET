# HANDOFF RETOUR — ST-017 v3 : Traduction auto FR à l'import + affichage des 2 prix (¥ + FCFA)

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
| `server/utils/draftBuilder.ts` | Traduction FR **automatique** à l'import via Gemini (`translateDraftToFrench`) + `hasCjk()` exporté + champ `translationStatus` (`translated`/`skipped`/`failed`) |
| `server/utils/ai.ts` | Ajout `resetAI()` (test-only, force la recréation du client) |
| `server/api/admin/import/publish.post.ts` | Harmonisation `aiEnrich` : **polish FR** au lieu de re-traduction depuis le chinois (détection `hasCjk`) |
| `pages/admin/import.vue` | Modal aperçu : **2 prix côte à côte** (Prix source ¥ + ≈ FCFA en rouge `#ff2a2a`) + **badges statut traduction** (✓ vert / ⚠ ambre) + label checkbox mis à jour |
| `scripts/test-import-translate.ts` | (nouveau) Test tsx : import réel goofish + 2 scénarios dégradés |

**Non touchés** : pipeline headless/justone/fallback (`scraperGoofish.ts`, `engine.ts`), recherche, cartes résultats (2 prix déjà présents), publication.

---

## 2. Comportement implémenté

- **Détection CJK** (`hasCjk`) sur titre + description source. Si besoin → Gemini (`generateContentWithRetry`, température 0.4, JSON `{title, description}`, fallback `gemini-2.5-flash-lite`).
- **`titleFr` fourni par l'utilisateur** → titre **NON re-traduit** (transmis au modèle comme titre à conserver tel quel).
- **Contrat de sortie** : `description` = FR ; `chineseDescription`/`chineseTitle` = source conservée ; `translationStatus` renseigné.
- **Dégradé obligatoire** : pas de clé / clé invalide / timeout / réponse invalide → `console.warn` + source conservée + `translationStatus='failed'` — **l'import ne bloque jamais**.
- **`aiEnrich` (publication)** : si description/titre déjà FR (pas de CJK) → le modèle **polish/affine** au lieu de retraduire ; le chinois original reste en contexte de fidélité. Pas de double traduction redondante → coût API maîtrisé.

---

## 3. Preuves (test tsx — `scripts/test-import-translate.ts`)

Commande : `npx tsx --tsconfig .nuxt/tsconfig.json scripts/test-import-translate.ts`

### Scénario 1 — IMPORT RÉEL goofish `1072126350734` (≈ 28 s)
```
Titre FR  : iPhone 16 Pro Max Argent 256 Go          (pas de CJK)
Descript. : iPhone 16 Pro Max Argent 256 Go. L'état esthétique est tel qu'illustré.
            Batterie à 93%. Version chinoise officielle, double SIM... (pas de CJK)
Titre ZH  : iPhone 16 Pro Max银色 256G                (conservé)
Descript. ZH (conserve) : 外观如图所示\n电池93%...     (conservé)
Prix source : 5300 CNY | Prix FCFA : 503500
✅ translationStatus === "translated"
✅ description/titre traduits (pas de CJK)   ✅ chineseDescription/Title conservés
✅ prix source présent (¥) + prix FCFA présent
```

### Scénario 2 — DÉGRADÉ clé invalide (≈ 1,2 s)
```
✅ import fonctionne   ✅ translationStatus === "failed"
✅ description source conservée (CJK intact)   ✅ aucune exception levée
```

### Scénario 3 — DÉGRADÉ pas de clé (≈ 0,0 s)
```
✅ import fonctionne   ✅ translationStatus === "failed"   ✅ source conservée
```

**Build** : `npm run build` ✅ passe (vérification officielle du projet).

---

## 4. Coût API et temps

| Import | Temps total | Coût Gemini estimé |
|---|---|---|
| Scénario 1 (traduction réelle) | **≈ 28-35 s** (dont ~25 s scraping headless) | **très faible** : prompt ~350-500 tokens + sortie ~150-250 tokens = **< 1 000 tokens** par import → ~0,00001 $ (gemini-2.5-flash) |
| Dégradé (échec) | ≈ 1 s | 0 $ (échec réseau/clé) |
| Pas de clé | ≈ 0 s | 0 $ |

Optimisation déjà en place : pas de double traduction (draft traduit → `aiEnrich` ne retraduit pas) ; fallback `gemini-2.5-flash-lite` si le modèle principal échoue.

---

## 5. Problèmes / recommandations

1. **Warnings stderr des scénarios dégradés** : le `console.warn` de `draftBuilder` est **attendu** (avertissement normal). Sous PowerShell, il apparaît comme « NativeCommandError » dans la sortie du script — ce n'est **pas** un échec (EXIT=0).
2. **Perte du titre FR si seule la description est CJK** : quand le titre est déjà FR mais la description chinoise → `titleFr`/titre source passé à Gemini comme titre à conserver. OK.
3. **`nuxi typecheck` (`npm run lint`) non utilisable** : erreurs TS pré-existantes massives de résolution d'alias `~~/` et auto-imports Vue/Pinia (fichiers non modifiés : `stores/*`, `search.get.ts`...). La validation officielle du projet reste `npm run build`, qui passe.
4. **Latence** : la traduction ajoute ~3-5 s à l'import (appel Gemini). Acceptable pour un back-office ; si besoin plus tard : traduire hors du chemin critique ou en tâche de fond.
5. **Prix de recherche (cards)** : inchangé, les 2 prix y étaient déjà présents (`fmtPrice` + ≈ FCFA) — cohérent avec le modal.

---

## 6. Critères d'acceptation (recette du ticket)

| # | Critère | Statut |
|---|---|---|
| 1 | Import goofish → description en FRANÇAIS (chinois conservé accessible) | ✅ |
| 2 | Draft affiche les 2 prix côte à côte (¥ source + ≈ FCFA) | ✅ |
| 3 | Panne Gemini → import fonctionne (source conservée) | ✅ |
| 4 | Build OK | ✅ |

---

**Signé : Chef Squad 4 — 2026-08-09**
