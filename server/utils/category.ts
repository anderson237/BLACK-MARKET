// ---------------------------------------------------------------------------
// Automatic product category detection (ST-017 / vitrine).
//
// The import pipeline has no reliable "category" field from the source APIs, so
// we infer one from the product title/description via keyword matching (FR +
// EN + common CN pinyin/characters). The detected category is returned to the
// admin UI as a suggestion; it becomes a real vitrine filter as soon as the
// product is published (the storefront builds its category tabs from the
// published products' `category` values).
// ---------------------------------------------------------------------------

// Transport categories first (they also drive the freight estimate), then the
// storefront seed categories. Anything not matched stays empty -> the admin
// picks or types a new category freely.
const CATEGORY_RULES: { category: string; keywords: string[] }[] = [
  {
    category: 'Téléphones',
    keywords: [
      'téléphone', 'telephone', 'smartphone', 'phone', 'iphone', 'android', 'xiaomi', 'samsung',
      'huawei', 'oppo', 'vivo', 'oneplus', 'samsung galaxy', 'poco', 'realme', 'honor', 'tecno',
      '手机', '电话', '智能手机',
    ],
  },
  {
    category: 'Ordinateurs',
    keywords: [
      'ordinateur', 'laptop', 'computer', 'pc portable', 'notebook', 'macbook', 'écran', 'ecran',
      'monitor', 'clavier', 'keyboard', 'souris', 'mouse', 'tablette', 'tablet', 'ipad', 'gaming pc',
      '电脑', '笔记本', '平板', '键盘', '鼠标', '显示器',
    ],
  },
  {
    category: 'Montres',
    keywords: ['montre', 'watch', 'smartwatch', 'apple watch', 'bracelet', 'gshock', 'g-shock', 'casio', '手表', '腕表'],
  },
  {
    category: 'Écouteurs',
    keywords: ['écouteur', 'ecouteur', 'earphone', 'earbud', 'headphone', 'casque audio', 'airpods', '蓝牙耳机', '耳机'],
  },
  {
    category: 'Chaussures',
    keywords: ['chaussure', 'sneaker', 'basket', 'shoe', 'bottes', 'botte', 'sandale', 'mocassin', '鞋', '运动鞋'],
  },
  {
    category: 'Sacs',
    keywords: ['sac', 'bag', 'backpack', 'sac à dos', 'sacs', 'toilettes', 'pochette', 'sacoche', '包', '背包', '手提包'],
  },
  {
    category: 'Vêtements',
    keywords: [
      'vêtement', 'vetement', 't-shirt', 'tshirt', 'tee', 'hoodie', 'veste', 'pantalon', 'jean',
      'chemise', 'pull', 'sweat', 'short', 'robe', 'jupe', 'costume', 'survet', 'légende', 'legging',
      'clothing', 'clothes', 'jacket', 'shirt', 'pants', 'dress', 'skirt', 'sweatshirt', 'blazer',
      '衣服', '服装', '卫衣', '外套', '裤子', '衬衫', '连衣裙',
    ],
  },
  {
    category: 'Techwear',
    keywords: ['techwear', 'cyberpunk', 'tactical', 'utility vest', 'gilet tactique'],
  },
  {
    category: 'Streetwear',
    keywords: ['streetwear', 'urban', 'oversize', 'cargo', 'snapback', 'cap', 'casquette'],
  },
  {
    category: 'Gaming Room',
    keywords: ['gaming', 'gamepad', 'manette', 'console', 'playstation', 'xbox', 'rgb', 'setup', 'streamer', '游戏'],
  },
  {
    category: 'Cyber Gadgets',
    keywords: ['gadget', 'drone', 'caméra', 'camera', 'caméra de sécurité', 'action cam', 'projecteur', 'speaker', 'enceinte', 'chargeur', 'power bank', 'smart', '智能', '无人机'],
  },
  {
    category: 'Accessoires',
    keywords: ['accessoire', 'accessory', 'bijou', 'bijoux', 'jewelry', 'collier', 'bracelet', 'boucle', 'ceinture', 'lunette', 'portefeuille', 'montre', 'porte-clés', 'porte cles', 'keychain', 'sacoche téléphone', '配件', '首饰'],
  },
]

// Normalize for matching: lowercase, strip accents and common punctuation.
function norm(s: string): string {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\u4e00-\u9fff\s-]/g, ' ')
}

/**
 * Guess a category from a product title/description. Returns '' when no rule
 * matches — the admin is then free to type any category (it will become a new
 * vitrine filter automatically once the product is published).
 */
export function detectCategory(title: string, description = ''): string {
  const haystack = norm(`${title} ${description}`)
  // Longest keyword first wins (more specific before generic).
  const ordered = [...CATEGORY_RULES]
    .map((r) => ({ ...r, match: r.keywords.filter((k) => k && haystack.includes(norm(k))) }))
    .filter((r) => r.match.length > 0)
    .sort((a, b) => b.match.reduce((acc, k) => acc + k.length, 0) - a.match.reduce((acc, k) => acc + k.length, 0))
  return ordered[0]?.category || ''
}
