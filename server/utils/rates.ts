import { getStore } from '@netlify/blobs'
import fs from 'node:fs'
import path from 'node:path'
import { isNetlifyRuntime } from './storage'

// ---------------------------------------------------------------------------
// Conversion rates -> XOF, PERSISTED and admin-editable (blob bm-rates /
// rates.json, local file data/rates.json in dev).
//
// Previously the rates were hard-coded at build time in two inconsistent
// places (nuxt.config public runtime config used by the import pipeline, and
// constants.ts used by the accounting module) — the admin could not adjust
// them and the two sides could disagree (95 vs 85). Now EVERY conversion
// (import pipeline AND accounting) reads the same persisted rates, falling
// back to the same defaults (1 ¥ = 95 FCFA, 1 € = 655.957 FCFA, 1 $ = 700
// FCFA).
// ---------------------------------------------------------------------------

export interface ConversionRates {
  /** 1 yuan (CNY) = N FCFA */
  cnyToXof: number
  /** 1 euro = N FCFA (official peg 655.957) */
  eurToXof: number
  /** 1 dollar US = N FCFA (approximation, NOT a fixed peg) */
  usdToXof: number
}

export const DEFAULT_RATES: ConversionRates = {
  cnyToXof: 95,
  eurToXof: 655.957,
  usdToXof: 700,
}

const RATES_FILE = path.join(process.cwd(), 'data', 'rates.json')

export function normalizeRates(raw: any): ConversionRates {
  const pick = (v: any, fallback: number) => {
    const n = Number(v)
    return Number.isFinite(n) && n > 0 ? n : fallback
  }
  return {
    cnyToXof: pick(raw?.cnyToXof, DEFAULT_RATES.cnyToXof),
    eurToXof: pick(raw?.eurToXof, DEFAULT_RATES.eurToXof),
    usdToXof: pick(raw?.usdToXof, DEFAULT_RATES.usdToXof),
  }
}

export async function loadRates(): Promise<ConversionRates> {
  if (isNetlifyRuntime()) {
    try {
      const s = getStore({ name: 'bm-rates' })
      const raw = await s.get('rates.json', { type: 'text', consistency: 'strong' } as any)
      if (raw != null) return normalizeRates(JSON.parse(String(raw)))
    } catch (err) {
      console.error('[BLOBS] rates read failed:', err)
    }
    return { ...DEFAULT_RATES }
  }
  try {
    const raw = await fs.promises.readFile(RATES_FILE, 'utf-8')
    return normalizeRates(JSON.parse(raw.replace(/^\uFEFF/, '')))
  } catch {
    return { ...DEFAULT_RATES }
  }
}

/** Merge + persist rates (partial patch allowed), returning the full new set. */
export async function saveRates(patch: Partial<ConversionRates>): Promise<ConversionRates> {
  const merged = normalizeRates({ ...(await loadRates()), ...patch })
  if (isNetlifyRuntime()) {
    const s = getStore({ name: 'bm-rates' })
    await s.set('rates.json', JSON.stringify(merged, null, 2))
  } else {
    await fs.promises.mkdir(path.dirname(RATES_FILE), { recursive: true })
    await fs.promises.writeFile(RATES_FILE, JSON.stringify(merged, null, 2), 'utf-8')
  }
  return merged
}
