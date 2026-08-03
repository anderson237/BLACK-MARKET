// Nitro server route for sitemap.xml - generated at runtime from the live
// catalog so new products are crawlable immediately after being published.
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const siteUrl = (config.public.siteUrl || 'https://blackmarket-import-export.netlify.app').replace(/\/+$/, '')

  let products: any[] = []
  try {
    const res = await fetch(`${siteUrl}/catalog.json`, { headers: { Accept: 'application/json' } })
    if (res.ok) products = await res.json()
  } catch {
    products = []
  }

  const now = new Date().toISOString().slice(0, 10)
  const urls: string[] = [
    { loc: `${siteUrl}/`, lastmod: now, priority: '1.0', freq: 'daily' },
    ...products.map((p) => ({
      loc: `${siteUrl}/p/${encodeURIComponent(p.id)}.html`,
      lastmod: now,
      priority: '0.9',
      freq: 'daily',
    })),
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
