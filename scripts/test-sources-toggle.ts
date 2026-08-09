// ---------------------------------------------------------------------------
// BL-007 v2 — Test du toggle de source d'import par plateforme (ST-017).
//
// Partie 1 — LOGIQUE (aucun serveur requis) : defaults, persistance locale
//   (data/sources.json), resolveDesiredEngine (xianyu → headless, autres →
//   justone). L'état d'origine du toggle est restauré en fin de test.
//
// Partie 2 — ROUTES HTTP (serveur de dev démarré, optionnel) :
//   npx tsx scripts/test-sources-toggle.ts --url http://localhost:3000
//   → login admin (/api/auth/login) puis GET + PUT /api/admin/import/sources.
//
// Usage :
//   npx tsx --tsconfig .nuxt/tsconfig.json scripts/test-sources-toggle.ts [--url http://localhost:3000]
// ---------------------------------------------------------------------------

import { loadSources, saveSources, resolveDesiredEngine, DEFAULT_SOURCES, SOURCE_PLATFORMS } from '../server/utils/sources'
import fs from 'node:fs'
import path from 'node:path'

const SOURCES_FILE = path.join(process.cwd(), 'data', 'sources.json')

function check(label: string, ok: boolean, detail?: string): void {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) process.exitCode = 1
}

async function testLogic(): Promise<void> {
  console.log('\n=== Partie 1 — LOGIQUE (persistance locale data/sources.json) ===')

  const before = await loadSources()
  console.log('  [état avant test]', JSON.stringify(before))
  const fileExistedBefore = fs.existsSync(SOURCES_FILE)

  try {
    // 1) Défauts (aucun réglage → xianyu=headless, autres=justone)
    console.log('\n  Defaults :')
    check('xianyu → headless par défaut', DEFAULT_SOURCES.xianyu === 'headless', DEFAULT_SOURCES.xianyu)
    check('1688 → justone par défaut', DEFAULT_SOURCES['1688'] === 'justone', DEFAULT_SOURCES['1688'])
    check('taobao → justone par défaut', DEFAULT_SOURCES.taobao === 'justone', DEFAULT_SOURCES.taobao)
    check('tiktok-shop → justone par défaut', DEFAULT_SOURCES['tiktok-shop'] === 'justone', DEFAULT_SOURCES['tiktok-shop'])
    check('amazon → justone par défaut', DEFAULT_SOURCES.amazon === 'justone', DEFAULT_SOURCES.amazon)
    check('douyin-ec → justone par défaut', DEFAULT_SOURCES['douyin-ec'] === 'justone', DEFAULT_SOURCES['douyin-ec'])
    check('6 plateformes dans le toggle', SOURCE_PLATFORMS.length === 6, String(SOURCE_PLATFORMS.length))

    // 2) Bascules à chaud (patch partiel persisté)
    console.log('\n  Bascules :')
    const saved = await saveSources({ xianyu: 'justone', amazon: 'headless' } as any)
    check('xianyu → justone persisté', saved.xianyu === 'justone', saved.xianyu)
    check('amazon → headless persisté (sera ramené à justone à l’usage)', saved.amazon === 'headless', saved.amazon)
    const reloaded = await loadSources()
    check('relecture = mêmes valeurs', reloaded.xianyu === 'justone' && reloaded.amazon === 'headless', JSON.stringify(reloaded))

    // 3) Résolution du moteur EFFECTIF
    console.log('\n  Résolution moteur (resolveDesiredEngine) :')
    check('xianyu (toggle justone) → justone', (await resolveDesiredEngine('xianyu')) === 'justone', await resolveDesiredEngine('xianyu'))
    check('amazon (toggle headless mais non supporté) → justone', (await resolveDesiredEngine('amazon')) === 'justone', await resolveDesiredEngine('amazon'))
    check('1688 → justone', (await resolveDesiredEngine('1688')) === 'justone', await resolveDesiredEngine('1688'))
    check('taobao → justone', (await resolveDesiredEngine('taobao')) === 'justone', await resolveDesiredEngine('taobao'))

    // 4) Retour à headless pour xianyu (preuve de la bascule retour)
    const back = await saveSources({ xianyu: 'headless', amazon: 'justone' } as any)
    check('xianyu → headless à nouveau', back.xianyu === 'headless', back.xianyu)
    check('amazon → justone à nouveau', back.amazon === 'justone', back.amazon)
    check('xianyu (toggle headless) → headless', (await resolveDesiredEngine('xianyu')) === 'headless', await resolveDesiredEngine('xianyu'))
  } finally {
    // Restauration de l'état d'origine (pas de pollution de la config admin).
    if (fileExistedBefore) {
      await saveSources(before as any)
    } else {
      try { fs.unlinkSync(SOURCES_FILE) } catch { /* déjà absent */ }
    }
    console.log('\n  [état restauré]', JSON.stringify(await loadSources()))
  }
}

async function testHttp(url: string): Promise<void> {
  console.log(`\n=== Partie 2 — ROUTES HTTP (${url}) ===`)
  const base = url.replace(/\/+$/, '')

  // Login admin (clé d'accès = ADMIN_PASSWORD du .env local).
  const loginRes = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'elomopatrick.pn@gmail.com', password: process.env.ADMIN_PASSWORD || 'ADMIN99' }),
  })
  const login = await loginRes.json().catch(() => ({}))
  const token = login?.token
  if (!loginRes.ok || !token) {
    check('login admin OK', false, `HTTP ${loginRes.status} — ${String(login?.statusMessage || login?.message || '')}`)
    return
  }
  check('login admin OK', true)

  const auth = { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` }

  const getRes = await fetch(`${base}/api/admin/import/sources`, { headers: auth })
  const getJson = await getRes.json().catch(() => ({}))
  check('GET /api/admin/import/sources 200', getRes.ok, `HTTP ${getRes.status}`)
  check('GET retourne 6 plateformes', getJson?.sources && Object.keys(getJson.sources).length === 6, JSON.stringify(getJson?.sources || {}))
  check('GET xianyu présent', getJson?.sources?.xianyu === 'headless' || getJson?.sources?.xianyu === 'justone', getJson?.sources?.xianyu)

  const putRes = await fetch(`${base}/api/admin/import/sources`, {
    method: 'PUT',
    headers: auth,
    body: JSON.stringify({ sources: { ...getJson.sources, xianyu: 'justone' } }),
  })
  const putJson = await putRes.json().catch(() => ({}))
  check('PUT /api/admin/import/sources 200', putRes.ok, `HTTP ${putRes.status} — ${String(putJson?.statusMessage || '')}`)
  check('PUT persiste xianyu=justone', putJson?.sources?.xianyu === 'justone', putJson?.sources?.xianyu)

  // Restauration : xianyu = headless (valeur produit par défaut).
  const putBack = await fetch(`${base}/api/admin/import/sources`, {
    method: 'PUT',
    headers: auth,
    body: JSON.stringify({ sources: { ...putJson.sources, xianyu: 'headless' } }),
  })
  const putBackJson = await putBack.json().catch(() => ({}))
  check('PUT restaure xianyu=headless', putBackJson?.sources?.xianyu === 'headless', putBackJson?.sources?.xianyu)

  // Auth refusée sans token.
  const anon = await fetch(`${base}/api/admin/import/sources`)
  check('GET sans token → 401', anon.status === 401, `HTTP ${anon.status}`)
}

const urlArg = process.argv.find((a) => a.startsWith('--url='))
const url = urlArg ? urlArg.slice('--url='.length) : (process.argv.includes('--url') ? process.argv[process.argv.indexOf('--url') + 1] || '' : '')

async function main() {
  await testLogic()
  if (url) await testHttp(url)
  else console.log('\n[test] Astuce : ajoutez --url http://localhost:3000 pour tester aussi les routes HTTP avec un serveur de dev démarré.')

  console.log('\n[test] ' + (process.exitCode ? 'ÉCHEC' : 'SUCCÈS'))
  process.exit(process.exitCode || 0)
}

main().catch((e) => { console.error('\n[test] ERREUR:', e?.message || e); process.exit(1) })
