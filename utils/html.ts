/** Strips dangerous HTML (scripts/styles/event handlers) from AI-generated content. */
export function sanitizeHtml(raw: string): string {
  return String(raw || '')
    .replace(/<(script|style|iframe|object|embed|form|input)[^>]*>[\s\S]*?<\/\1>/gis, '')
    .replace(/on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '')
    .slice(0, 12000)
}

/** Removes all HTML tags for plain-text previews. */
export function stripTags(text: string): string {
  return String(text || '').replace(/<[^>]*>/g, '')
}

/** Splits plain text into paragraphs; keeps AI HTML as-is (sanitized). */
export function paragraphize(text: string): string {
  const raw = String(text || '')
  if (/<[a-z][^>]*>/i.test(raw)) return sanitizeHtml(raw)
  const blocks = raw.split(/\n{2,}/)
  const lines = blocks.length > 1 ? blocks : raw.split(/\n/).filter(Boolean)
  return lines
    .map((b) => `<p class="text-xs text-zinc-300 leading-relaxed">${escapeHtml(b.trim())}</p>`)
    .join('')
}

export function escapeHtml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
