# Sessions de développement — BLACK MARKET

Ce dossier trace **uniquement** les sessions de développement du projet BLACK MARKET
(console admin + boutique + API). Il n'inclut aucun autre projet (GENOX, trading, etc.).

Format d'une session :
`docs/sessions/YYYY-MM-DD-<sujet>.md`

---

## Index des sessions

| Date | Sujet | Résumé | Statut |
|------|-------|--------|--------|
| 2026-08-02 | Optimisation & durcissement sécurité | Fix Blobs (connectLambda), headers de sécurité, XSS, CORS, cache, chunking Vite, docs | ✅ Terminé |

---

## Changelog / journal décisionnel

### 2026-08-02 — Optimisation maximale + sécurité validée de part en part + push GitHub

**Contexte** : le site devait être optimisé, la sécurité validée contre les attaques
(pirates/hackers), le tout documenté, commenté et poussé sur GitHub.

**Décisions / actions :**

1. **Persistance Netlify Blobs (fix du blocker)** — `MissingBlobsEnvironmentError`
   - Cause racine : la fonction utilise **Functions v1** (`export const handler`),
     qui n'injecte PAS automatiquement la config Blobs.
   - Fix : appel de `connectLambda(event)` en tête de chaque invocation dans
     `netlify/functions/api.ts`. Sans lui, tout `getStore()` échouait → 500 sur
     `/api/upload-image` et persistance produits retombait sur le seed.
2. **Durcissement sécurité**
   - Headers de sécurité sur toutes les réponses (CSP, X-Frame-Options DENY, nosniff,
     Referrer-Policy, Permissions-Policy, HSTS) — middleware Express + `netlify.toml`.
   - CORS stricte : requête avec `Origin` ≠ host → 403.
   - Comparaison mot de passe en temps constant (`crypto.timingSafeEqual`).
   - Upload : validation des **magic bytes** (rejet des non-images).
   - Validation des IDs produits (charset sûr) + limite 500 produits/PUT.
   - Suppression du **fallback de démo** côté client (`DEMO_PASSWORDS`) : l'authentification
     est désormais 100 % côté serveur. Retrait de l'affichage du code de démo sur la page login.
   - Fix **XSS** dans la boutique : remplacement de l'interpolation `escapeHtml` dans les
     attributs `onclick` (décodée par le parser HTML) par des littéraux JS sûrs
     (`JSON.stringify`) et un gestionnaire d'erreur image via `data-*` (`handleImgError`).
3. **Optimisation performance**
   - `netlify.toml` : règles de cache (assets/`img` → 1 an immutable ; `/p/*` → 1 h ;
     HTML → revalidation ; `catalog.json` → no-store).
   - `vite.config.ts` : `manualChunks` vendor (react, motion, lucide) pour un cache stable.
   - Boutique : `preconnect` vers CDN Tailwind, Google Fonts et Google Identity.
4. **Documentation** : `README.md` réécrit (stack, flux, déploiement, sécurité),
   `SECURITY.md` (audit des menaces + contre-mesures), `docs/sessions/` (ce dossier).

**Validation** : `npm run lint` OK · `npm run build` OK · tests manuels du serveur local
(headers présents, login refusé, origine croisée → 403, catalog.json 200).

**Livrables** : `netlify/functions/api.ts`, `src/server-app.ts`, `src/lib/template.ts`,
`netlify.toml`, `vite.config.ts`, `README.md`, `SECURITY.md`, `docs/sessions/`.
