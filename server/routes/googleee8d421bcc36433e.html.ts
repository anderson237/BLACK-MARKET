// Google Search Console ownership verification (HTML file method).
// Served through the function like robots.txt/sitemap.xml because the Netlify
// catch-all redirect `/* -> serverless` (force) bypasses the static publish dir.
export default defineEventHandler((event) => {
  setResponseHeaders(event, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  return 'google-site-verification: googleee8d421bcc36433e.html\n'
})
