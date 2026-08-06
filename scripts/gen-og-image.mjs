import sharp from 'sharp'

const W = 1200
const H = 630

const svg = `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="g" cx="20%" cy="10%" r="90%">
      <stop offset="0%" stop-color="#16161f"/>
      <stop offset="100%" stop-color="#08080c"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  <rect width="${W}" height="${H}" fill="none" stroke="#27272a" stroke-width="24"/>
  <rect x="24" y="24" width="${W-48}" height="${H-48}" fill="none" stroke="#1c1c24" stroke-width="2"/>
  <rect x="120" y="190" width="120" height="120" rx="22" fill="#ff2a2a"/>
  <text x="180" y="282" font-family="Arial, sans-serif" font-size="86" font-weight="900" fill="#ffffff" text-anchor="middle">B</text>
  <text x="285" y="250" font-family="Arial, sans-serif" font-size="58" font-weight="800" fill="#ffffff" letter-spacing="2">BLACK MARKET</text>
  <text x="288" y="292" font-family="Arial, sans-serif" font-size="26" fill="#ff2a2a" letter-spacing="6">SOURCING EXCLUSIF CHINE</text>
  <text x="288" y="340" font-family="Arial, sans-serif" font-size="22" fill="#8b8b94">Techwear · Cyberpunk · Prix d'usine · Précommande WhatsApp</text>
  <text x="600" y="470" font-family="monospace" font-size="20" fill="#5c5c66" text-anchor="middle">blackmarket-import-export.netlify.app</text>
</svg>`

await sharp(Buffer.from(svg))
  .png()
  .toFile('public/og-image.png')

console.log('public/og-image.png OK', 1200, 'x', 630)
