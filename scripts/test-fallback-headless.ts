// ---------------------------------------------------------------------------
// BL-007 v2 — Test du FALLBACK AUTOMATIQUE JustOneAPI quand le headless échoue.
//
// Scénario : on force un endpoint browserless INJOIGNABLE (GOOFISH_BROWSER_WS_ENDPOINT
// bidon) avec le toggle xianyu sur 'headless'. Le scraper doit :
//   1. échouer rapidement à la connexion distante (pas de token valide),
//   2. journaliser l'échec (jamais silencieux),
//   3. basculer automatiquement sur JustOneAPI (fetchProductDetail -> engine.ts).
//
// Résultat attendu selon le solde JustOneAPI :
//   - solde OK   : detail réel, engine === 'justone'
//   - solde 601  : erreur JustOneAPI claire ("Solde Just One API insuffisant…"),
//                  PAS une erreur de connexion browserless.
//
// Usage : npx tsx --tsconfig .nuxt/tsconfig.json scripts/test-fallback-headless.ts
// ---------------------------------------------------------------------------

process.env.GOOFISH_BROWSER_WS_ENDPOINT = 'wss://chrome.browserless.io/chromium/playwright?token=INVALID_TOKEN_FOR_TEST'

// Le script tourne hors runtime Nitro : on polyfille les deux auto-imports
// utilisés par justone.ts (joDetail) pour que le fallback puisse réellement
// appeler JustOneAPI. justoneKey() lit useRuntimeConfig().justone.apiKey et
// joGet lève createError() — les deux globals manquent en exécution tsx nue.
import { createError as h3CreateError } from 'h3'
;(globalThis as any).createError = h3CreateError
;(globalThis as any).useRuntimeConfig = () => ({ justone: { apiKey: process.env.JUSTONE_API_KEY || '' } })

import { fetchProductDetail } from '../server/utils/engine'
import { isRemoteBrowserConfigured } from '../server/utils/scraperGoofish'
import { loadSources, saveSources } from '../server/utils/sources'

function check(label: string, ok: boolean, detail?: string): void {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) process.exitCode = 1
}

async function main() {
  if (!isRemoteBrowserConfigured()) {
    check('endpoint distant forcé pour le test', false, 'GOOFISH_BROWSER_WS_ENDPOINT non lu')
  } else {
    check('endpoint distant forcé pour le test', true)
  }

  const before = await loadSources()
  const xianyuWasHeadless = before.xianyu === 'headless'
  if (!xianyuWasHeadless) await saveSources({ xianyu: 'headless' } as any)

  console.log('[fallback] appel fetchProductDetail(xianyu) avec un navigateur distant INJOIGNABLE…')
  try {
    const res = await fetchProductDetail('xianyu', '1072126350734', 'US')
    console.log(`[fallback] SUCCÈS via engine=${res.engine} — ${res.detail.title}`)
    check('fallback automatique → engine "justone"', res.engine === 'justone', res.engine)
    check('détail complet', Boolean(res.detail.title) && res.detail.price > 0, `${res.detail.price} ${res.detail.currency}`)
  } catch (err: any) {
    const msg = String(err?.message || err || '')
    const isJustOneError = /justone|solde|quota|just one|rechargez|api\.justoneapi/i.test(msg)
    // Si le fallback n'avait PAS eu lieu, l'erreur remontée serait la connexion
    // browserless ("impossible de se connecter au navigateur distant").
    const isHeadlessConnectError = /impossible de se connecter au navigateur distant|browserType\.connect/i.test(msg)
    console.log(`[fallback] erreur remontée : ${msg.slice(0, 220)}`)
    check('fallback a bien tenté JustOneAPI (erreur JustOne, pas browserless)', isJustOneError && !isHeadlessConnectError, isJustOneError ? 'erreur JustOneAPI' : 'erreur browserless — fallback absent !')
  }

  // Restauration du toggle.
  if (!xianyuWasHeadless) await saveSources({ xianyu: before.xianyu } as any)
  delete process.env.GOOFISH_BROWSER_WS_ENDPOINT
  console.log('\n[fallback] ' + (process.exitCode ? 'ÉCHEC' : 'SUCCÈS'))
  process.exit(process.exitCode || 0)
}

main().catch((e) => { console.error('\n[fallback] ERREUR:', e?.message || e); process.exit(1) })

