// Nitro server route for robots.txt - generated at runtime so it always
// reflects the current siteUrl and blocks sensitive paths from indexation.
export default defineEventHandler((event) => {
  const config = useRuntimeConfig()
  const siteUrl = config.public.siteUrl || 'https://deeproots-importexport.netlify.app'

  const body = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /admin/',
    'Disallow: /api/',
    'Disallow: /img/',
    'Disallow: /vid/',
    'Disallow: /catalog.json',
    '',
    `Sitemap: ${siteUrl}/sitemap.xml`,
    '',
  ].join('\n')

  setResponseHeaders(event, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'public, max-age=3600',
  })
  return body
})
