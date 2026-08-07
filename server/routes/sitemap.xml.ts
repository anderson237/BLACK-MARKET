// Nitro server route for sitemap.xml - generated at runtime from the live
// catalog so new products are crawlable immediately after being published.
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const siteUrl = (config.public.siteUrl || 'https://deeproots-importexport.netlify.app').replace(/\/+$/, '')

  let products: any[] = []
  try {
    const res = await fetch(`${siteUrl}/catalog.json`, { headers: { Accept: 'application/json' } })
    if (res.ok) products = await res.json()
  } catch {
    products = []
  }

  const now = new Date().toISOString().slice(0, 10)
  const day = 24 * 60 * 60 * 1000
  const toDate = (v: unknown) => {
    const t = Number(v) ? new Date(Number(v)) : new Date(String(v || now))
    return isNaN(t.getTime()) ? now : t.toISOString().slice(0, 10)
  }
  const urls: { loc: string; lastmod: string; priority: string; freq: string }[] = [
    { loc: `${siteUrl}/`, lastmod: now, priority: '1.0', freq: 'daily' },
    ...products
      // Only index live, published products (deleted/hidden ones are skipped by
      // the catalog.json feed; this re-checks the payload defensively).
      .filter((p: any) => p && !p.deleted)
      .map((p: any) => {
        // A product freshly (re)published gets a spike in priority for a few
        // days so Google re-crawls it right away, then settles to the baseline.
        let priority = '0.9'
        try {
          const updated = toDate(p.updatedAt || p.createdAt)
          const age = (Date.now() - new Date(updated).getTime()) / day
          if (age < 2) priority = '1.0'
          else if (age > 60) priority = '0.7'
        } catch {
          /* keep baseline */
        }
        return {
          loc: `${siteUrl}/p/${encodeURIComponent(p.id)}.html`,
          lastmod: toDate(p.updatedAt || p.createdAt),
          priority,
          freq: 'weekly',
        }
      }),
  ]

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) =>
      `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${u.lastmod}</lastmod>\n    <changefreq>${u.freq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`,
  )
  .join('\n')}
</urlset>`

  setResponseHeaders(event, {
    'Content-Type': 'application/xml; charset=utf-8',
    'Cache-Control': 'public, max-age=1800',
  })
  return xml
})
