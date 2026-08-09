// ---------------------------------------------------------------------------
// ST-017 v3 — Test traduction FR AUTOMATIQUE à l'import + affichage 2 prix.
//
// Usage :
//   npx tsx --tsconfig .nuxt/tsconfig.json scripts/test-import-translate.ts
//
// Scénarios couverts :
//   1. IMPORT RÉEL : lien goofish https://www.goofish.com/item?id=1072126350734
//      → draft complet. Vérifie que la description est traduite en FR
//      (translationStatus === 'translated', pas de CJK) et que les 2 prix
//      sont présents (price en ¥ + priceXof en FCFA).
//   2. DÉGRADÉ (clé invalide) : GEMINI_API_KEY invalide → l'import fonctionne
//      quand même, description source conservée, translationStatus='failed'.
//   3. DÉGRADÉ (pas de clé) : GEMINI_API_KEY absente → même comportement.
//
// Le script charge .env (sans écraser les variables déjà définies) pour que
// la traduction réelle fonctionne hors Nuxt.
// ---------------------------------------------------------------------------
import fs from 'node:fs'
import path from 'node:path'
import { scrapeGoofishDetail } from '../server/utils/scraperGoofish'
import { buildDraft, hasCjk } from '../server/utils/draftBuilder'
import { resetAI } from '../server/utils/ai'
import type { JoDetail } from '../server/utils/justone'

const SOURCE_ID = '1072126350734'

function loadEnvFile(): void {
  const envFile = path.join(process.cwd(), '.env')
  try {
    const raw = fs.readFileSync(envFile, 'utf-8')
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
      if (!m) continue
      const key = m[1]
      const val = m[2].trim().replace(/^["']|["']$/g, '')
      if (!(key in process.env)) process.env[key] = val
    }
  } catch {
    /* .env absent — on continue */
  }
}

function check(label: string, ok: boolean, detail?: string): void {
  console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) process.exitCode = 1
}

// Détail goofish fictif avec titre + description chinoise (pour les scénarios
// dégradés, sans dépendre du réseau/navigateur).
function fakeChineseDetail(): JoDetail {
  return {
    platform: 'xianyu',
    sourceId: 'FAKE_CJK_0001',
    title: '苹果 iPhone 16 Pro Max 512GB 全新未拆封 国行',
    desc: '全新原装 iPhone 16 Pro Max，512GB 存储，沙漠色钛金属，国行版本，未激活，未拆封。支持全网通5G，附原装配件，全国联保一年。',
    images: [],
    price: 8800,
    currency: 'CNY',
    features: [{ name: '颜色', value: '沙漠色' }, { name: '存储', value: '512GB' }],
    seller: { nick: 'vendeur_test', city: '深圳' },
  }
}

async function realImportScenario(): Promise<void> {
  console.log('\n=== SCÉNARIO 1 — IMPORT RÉEL goofish (traduction FR) ===')
  const t0 = Date.now()
  const detail = await scrapeGoofishDetail(SOURCE_ID)
  const draft = await buildDraft({
    platform: 'xianyu',
    sourceId: SOURCE_ID,
    detail,
    detailSource: 'headless',
    region: 'US',
  })

  const desc = String(draft.description || '')
  const title = String(draft.title || '')
  console.log(`  Titre FR  : ${title}`)
  console.log(`  Descript. : ${desc.slice(0, 160)}${desc.length > 160 ? '…' : ''}`)
  console.log(`  Titre ZH  : ${String(draft.chineseTitle || '').slice(0, 80)}`)
  console.log(`  Descript. ZH (conserve) : ${String(draft.chineseDescription || '').slice(0, 120)}`)
  console.log(`  Prix source : ${draft.price} ${draft.currency} | Prix FCFA : ${draft.priceXof}`)

  check('translationStatus === "translated"', draft.translationStatus === 'translated', String(draft.translationStatus))
  check('description traduite (pas de CJK)', !hasCjk(desc))
  check('titre traduit (pas de CJK)', !hasCjk(title))
  check('chineseDescription conservée (source CJK)', hasCjk(String(draft.chineseDescription || '')))
  check('chineseTitle conservé (source CJK)', hasCjk(String(draft.chineseTitle || '')))
  check('prix source présent (¥)', Number(draft.price) > 0, `${draft.price} ${draft.currency}`)
  check('prix FCFA présent', Number(draft.priceXof) > 0, `${draft.priceXof} FCFA`)
  console.log(`  (durée scénario : ${((Date.now() - t0) / 1000).toFixed(1)} s)`)
}

async function degradedScenario(label: string, apiKey: string | undefined): Promise<void> {
  console.log(`\n=== SCÉNARIO DÉGRADÉ — ${label} ===`)
  // Remplace la clé AVANT le premier getAI() (reset du cache du client).
  if (apiKey === undefined) delete process.env.GEMINI_API_KEY
  else process.env.GEMINI_API_KEY = apiKey
  resetAI()

  const t0 = Date.now()
  const draft = await buildDraft({
    platform: 'xianyu',
    sourceId: 'FAKE_CJK_0001',
    detail: fakeChineseDetail(),
    detailSource: 'headless',
    region: 'US',
  })

  console.log(`  Titre FR  : ${String(draft.title || '').slice(0, 80)}`)
  console.log(`  Descript. : ${String(draft.description || '').slice(0, 120)}`)
  console.log(`  Prix source : ${draft.price} ${draft.currency} | Prix FCFA : ${draft.priceXof}`)

  check(`import fonctionne (${label})`, Boolean(draft.sourceId) && draft.price > 0 && draft.priceXof > 0)
  check(`translationStatus === "failed" (${label})`, draft.translationStatus === 'failed', String(draft.translationStatus))
  check('description source conservée (CJK intact)', hasCjk(String(draft.description || '')))
  check('aucune exception levée (import non bloqué)', true)
  console.log(`  (durée scénario : ${((Date.now() - t0) / 1000).toFixed(1)} s)`)
}

async function main(): Promise<void> {
  loadEnvFile()
  console.log('[test] .env chargé — GEMINI_API_KEY ' + (process.env.GEMINI_API_KEY ? 'présente' : 'ABSENTE'))

  // 1) Import réel goofish (traduction FR + 2 prix).
  await realImportScenario()

  // 2) Dégradé clé invalide — simule une erreur Gemini.
  await degradedScenario('clé Gemini invalide', 'cle_invalide_pour_test_xyz')

  // 3) Dégradé pas de clé.
  await degradedScenario('pas de clé Gemini', undefined)

  console.log('\n[test] ' + (process.exitCode ? 'ÉCHEC' : 'SUCCÈS'))
}

main().catch((err) => {
  console.error('\n[test] ERREUR:', err?.message || err)
  process.exit(1)
})
