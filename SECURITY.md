# SECURITY — BLACK MARKET SINO-PREP Console

Document d'audit et de durcissement sécurité du site. À relire à chaque changement
de l'API, de l'authentification ou de la persistance.

---

## 1. Menaces couvertes

| Menace | Contre-mesure | Où |
|--------|---------------|----|
| **Bruteforce mot de passe** | Rate-limit 6 req/min/IP + verrouillage client 60 s après 3 échecs + comparaison en temps constant | `src/server-app.ts`, `src/components/Login.tsx` |
| **OAuth Google forgé** | Vérification serveur `https://oauth2.googleapis.com/tokeninfo`, validation `aud` = `GOOGLE_CLIENT_ID`, `email_verified`, email dans `ADMIN_EMAILS` | `POST /api/auth/google` |
| **XSS boutique** | `escapeHtml` systématique + littéraux JS via `JSON.stringify` (pas d'interpolation dans les attributs) + CSP | `src/lib/template.ts`, `src/lib/productPage.ts` |
| **XSS console admin** | Pas de `dangerouslySetInnerHTML` ; rendu React échappé par défaut | `src/components/*` |
| **Clickjacking** | `X-Frame-Options: DENY` + CSP `frame-ancestors 'none'` | middlewares + `netlify.toml` |
| **CSRF / CORS** | Rejet des requêtes dont `Origin` ≠ host ; tokens dans header `Authorization` (non-lisible cross-origin) | middleware CORS |
| **Upload malveillant** | Vérification des **magic bytes** (JPEG/PNG/GIF/WebP/BMP) avant stockage ; limite 15 Mo | `POST /api/upload-image` |
| **MIME sniffing** | `X-Content-Type-Options: nosniff` | middlewares + `netlify.toml` |
| **Exfiltration données** | `Referrer-Policy: strict-origin-when-cross-origin` | middlewares + `netlify.toml` |
| **Vol de secrets** | `.env` gitignoré ; `ADMIN_PASSWORD`, clés Google/Gemini uniquement côté serveur | `.gitignore`, `server-app.ts` |
| **Session volée** | Token 32 octets aléatoires, TTL 12 h, auto-déconnexion 15 min d'inactivité | `App.tsx`, `server-app.ts` |

## 2. Headers HTTP appliqués

Sur **toutes** les réponses (Express middleware + `netlify.toml`) :

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: default-src 'self'; img-src 'self' data: https:;
    script-src 'self' 'unsafe-inline' 'unsafe-eval' https:;
    style-src 'self' 'unsafe-inline' https:;
    connect-src 'self' https:; font-src 'self' data: https:;
    frame-ancestors 'none'; object-src 'none'; base-uri 'self'
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
X-XSS-Protection: 1; mode=block
```

> Note : `'unsafe-inline'` / `'unsafe-eval'` restent nécessaires pour la boutique
> auto-générée (scripts inline + Tailwind Play CDN). Les pages critiques (console)
> restent protégées par l'authentification et l'échappement React.

## 3. Flux d'authentification

1. L'utilisateur saisit la **clé d'accès** (`ADMIN_PASSWORD`) ou **Sign in with Google**.
2. Le serveur vérifie (rate-limité) et émet un **bearer token** stocké en `sessionStorage`.
3. Tous les endpoints `/api/products*`, `/api/upload-image` exigent `Authorization: Bearer <token>`.
4. La **boutique publique** ne requiert aucune authentification (données publiques).

**Règle** : aucun fallback d'authentification côté client (la clé de démo a été
retirée du bundle en session 2026-08-02). Si le serveur est injoignable, l'accès est refusé.

## 4. Persistance Netlify Blobs

- La fonction utilise **Functions v1** (`export const handler`) → Blobs ne sont PAS
  auto-configurés. `connectLambda(event)` est appelé en tête de chaque invocation.
  Si vous basculez en **Functions v2** (`export default`), vous pourrez le retirer.
- Les images stockées dans `bm-images` sont servies via `GET /api/img/:id` avec
  validation stricte de l'identifiant (`/^[a-f0-9]{16}$/i`) et cache 1 jour.

## 5. Bonnes pratiques pour les contributeurs

- Ne **jamais** committer le fichier `.env`, des clés API ou des tokens.
- Toute modification d'un endpoint qui accepte des données doit passer par
  `sanitizeProduct()` et les magic bytes le cas échéant.
- Tout nouveau header de sécurité doit être ajouté **deux fois** : dans
  `src/server-app.ts` (middleware) ET dans `netlify.toml`.
- Après un changement de code : `npm run lint` puis `npm run build`.

## 6. Responsables

- **Audit sécurité** : revue manuelle de chaque endpoint + vérification headers.
- À chaque release, vérifier : headers présents sur `/api/*` et `/`, login refusé avec un mauvais mot de passe, upload d'un fichier non-image rejeté, origine croisée → 403.

© 2026 BLACK MARKET SINO-PREP SYSTEM.
