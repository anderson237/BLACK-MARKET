# HANDOFF — ST-017 : Headless goofish v2 — Mode browserless distant + toggle de source

| Champ | Valeur |
|---|---|
| **Date** | 2026-08-09 |
| **De** | Lab Director |
| **À** | Squad 4 (Chef) |
| **Stratégie** | ST-017 — Pipeline d'import Xianyu/Goofish |
| **Priorité** | Haute |
| **Basé sur** | Prototype v1 livré (commit `2e1e3aa`, poussé sur main) |

---

## 1. Décision produit (validée utilisateur + Lab)

- **Headless = moteur PRIORITAIRE** pour goofish
- **JustOneAPI = moteur SECOURS** (utilisable quand le solde est rechargé)
- **Toggleable par plateforme** : l'utilisateur choisit le provider (`headless | justone`) dans les réglages admin

## 2. Choix d'hébergement navigateur — **Plan A : browserless.io Free**

| Critère | Valeur |
|---|---|
| Offre Free | **1 000 units/mois, sans carte bancaire, 2 navigateurs concurrents** |
| Tarification | 1 unit = 30 s de session navigateur ; captcha résolu = 10 units |
| Volume estimé | 150 produits/semaine ≈ 600 extractions/mois ≈ **600-1 200 units** |
| Couverture Free | ~70-80 % du besoin — acceptable pour démarrer |
| Secours | **Plan B : Background Function Netlify** (import async, 15 min) si dépassement |
| Connexion | WebSocket : `chromium.connect(wsEndpoint)` — support natif Playwright |

**Tâche immédiate de l'utilisateur** : créer un compte gratuit browserless.io et fournir le token/endpoint WebSocket (variable d'env `GOOFISH_BROWSER_WS_ENDPOINT`). Le dev peut continuer en local avec Edge headless (déjà fonctionnel).

## 3. Travail attendu (Squad 4)

### 3.1 Mode distant browserless dans `server/utils/scraperGoofish.ts`
- Si `GOOFISH_BROWSER_WS_ENDPOINT` est défini → `chromium.connect(wsEndpoint)` (navigateur distant browserless)
- Sinon → `chromium.launch()` local (Edge dev / chromium-headless-shell) — comportement actuel conservé
- Garder : interception MTOP, fallback DOM, retry RGV587, normalisation JoDetail
- **Vérifier la connexion browserless fonctionne** (script de test)

### 3.2 Toggle de source par plateforme
- Blob `bm-sources` : `{ xianyu: 'headless' | 'justone', '1688': 'justone', ... }` (défaut : xianyu → `headless`, autres → `justone`)
- Routes `GET /api/admin/import/sources` + `PUT /api/admin/import/sources` (auth admin)
- UI : carte dans `/admin/settings` — sélecteur par plateforme (headless / JustOneAPI)
- `draftBuilder.ts` / route from-url : consulter le toggle pour choisir le moteur (headless d'abord pour xianyu, fallback JustOneAPI si échec headless OU si le toggle dit justone)
- Le champ `source.engine: 'headless' | 'justone'` (déjà prévu au v1) doit être exploité pour l'affichage

### 3.3 Sécurité / robustesse
- Si headless échoue (timeout, anti-bot) → **fallback automatique JustOneAPI** (même requête), jamais d'échec silencieux
- Timeout total raisonnable par requête (~45 s max) — documenter le comportement en fonction Netlify synchrone
- Ne pas exposer le token browserless au client (côté serveur uniquement)

## 4. Contraintes

- **Ne pas casser** le chemin JustOneAPI (moteur secours)
- Format de sortie inchangé → UI import inchangée
- Build `npm run build` doit passer (leaflet désormais restauré)
- Ne pas déployer sans accord ; commit local si besoin, push seulement après validation Lab

## 5. Critères d'acceptation

1. Import par lien goofish fonctionne via **browserless distant** (ou Edge local en dev) → brouillon complet
2. Toggle de source fonctionnel (bascule à chaud, persisté)
3. Fallback JustOneAPI automatique en cas d'échec headless
4. Chemin JustOneAPI intact
5. Build OK

## 6. Références

- Prototype v1 : `server/utils/scraperGoofish.ts`, `scripts/test-scraper-goofish.ts`, `scripts/test-builddraft-headless.ts`
- `server/utils/justone.ts` : flattener à imiter
- `pages/admin/settings.vue` : où ajouter le toggle
- browserless : https://www.browserless.io/pricing (Free 1k units, connect WebSocket natif Playwright)

## 7. Sortie attendue

- Code (mode distant + toggle) + scripts de test
- Rapport : preuve connexion browserless, toggle fonctionnel, fallback, build OK
- Handoff retour Lab pour gate suivante

**Signé : Lab Director — 2026-08-09**
