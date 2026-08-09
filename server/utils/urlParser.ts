import type { JoPlatform } from '~~/server/utils/justone'

// ---------------------------------------------------------------------------
// Product-URL parser (ST-017): extract { platform, sourceId, region? } from a
// product page URL so the admin can paste a Xianyu / 1688 / Taobao / TikTok
// Shop / Amazon / Douyin link and reuse the SAME draft pipeline as a search
// result click (detail fetch, gallery download, translation, conversion…).
// ---------------------------------------------------------------------------

export interface ParsedProductUrl {
  platform: JoPlatform
  sourceId: string
  region?: 'US' | 'FR'
  /** Human-readable platform name (for errors/UX). */
  label: string
}

const SUPPORTED: { platform: JoPlatform; label: string; test: RegExp; extract: (url: URL) => string | null; region?: (url: URL) => 'US' | 'FR' | undefined }[] = [
  // Xianyu / Goofish — https://www.goofish.com/item?id=… (also ?spm=…&id=…)
  {
    platform: 'xianyu',
    label: 'Xianyu (Goofish)',
    test: /(^|\.)goofish\.com$/i,
    extract: (url) => url.searchParams.get('id'),
  },
  // 1688 — https://detail.1688.com/offer/<offerId>.html
  {
    platform: '1688',
    label: '1688',
    test: /(^|\.)1688\.com$/i,
    extract: (url) => {
      const m = url.pathname.match(/\/offer\/([0-9]+)/i)
      return m ? m[1] : null
    },
  },
  // Taobao / Tmall — https://item.taobao.com/item.htm?id=… (also ?spm=…&id=…)
  {
    platform: 'taobao',
    label: 'Taobao / Tmall',
    test: /(^|\.)(taobao|tmall)\.com$/i,
    extract: (url) => url.searchParams.get('id') || (url.searchParams.get('itemId') ?? null),
  },
  // TikTok Shop — https://shop.tiktok.com/view/product/<productId>… (US/GB/FR…)
  {
    platform: 'tiktok-shop',
    label: 'TikTok Shop',
    test: /(^|\.)(tiktok|shop\.tiktok)\.com$/i,
    extract: (url) => {
      const m = url.pathname.match(/\/view\/product\/([0-9]+)/i)
      if (m) return m[1]
      return url.searchParams.get('productId') || url.searchParams.get('id')
    },
    region: (url) => (url.hostname.includes('fr.') ? 'FR' : 'US'),
  },
  // Amazon — https://www.amazon.fr/dp/<ASIN>… or /gp/product/<ASIN>
  {
    platform: 'amazon',
    label: 'Amazon',
    test: /(^|\.)amazon\./i,
    extract: (url) => {
      const m = url.pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i)
      if (m) return m[1]
      return url.searchParams.get('asin')
    },
    region: (url) => (url.hostname.includes('.fr') ? 'FR' : 'US'),
  },
  // Douyin e-commerce — https://haohuo.jinritemai.com/views/product/item2?id=…
  {
    platform: 'douyin-ec',
    label: 'Douyin',
    test: /(^|\.)(jinritemai\.com|douyin\.com)$/i,
    extract: (url) => url.searchParams.get('id') || url.searchParams.get('productId'),
  },
]

/**
 * Parse a product URL into a platform + source id, or return null when the URL
 * is not a recognised product page.
 */
export function parseProductUrl(raw: string): ParsedProductUrl | null {
  const trimmed = String(raw || '').trim()
  if (!trimmed) return null
  let url: URL
  try {
    url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`)
  } catch {
    return null
  }
  for (const rule of SUPPORTED) {
    if (!rule.test.test(url.hostname)) continue
    const sourceId = rule.extract(url)?.trim()
    if (sourceId) {
      return { platform: rule.platform, sourceId, region: rule.region?.(url), label: rule.label }
    }
  }
  return null
}

/** Human hint for URLs we can't use (Pinduoduo…). */
export function unsupportedHint(raw: string): string | null {
  const trimmed = String(raw || '').trim()
  if (!trimmed) return null
  let host = ''
  try {
    host = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`).hostname.toLowerCase()
  } catch {
    return null
  }
  if (host.includes('pinduoduo') || host.includes('yangkeduo') || host.includes('pdd')) {
    return 'Pinduoduo n\'est pas encore supporté par notre API de données (JustOneAPI). Collez un lien Xianyu, 1688, Taobao, TikTok Shop, Amazon ou Douyin.'
  }
  if (host.includes('shopee') || host.includes('shein') || host.includes('wish') || host.includes('temu')) {
    const brand = host.split('.')[0] === 'www' ? host.split('.')[1] : host.split('.')[0]
    return `Le lien ${brand || 'de cette plateforme'} n'est pas supporté pour l'instant (plateformes disponibles : Xianyu, 1688, Taobao, TikTok Shop, Amazon, Douyin).`
  }
  return null
}
