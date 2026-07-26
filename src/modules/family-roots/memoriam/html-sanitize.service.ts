const ALLOWED_TAGS = new Set(['p', 'br', 'strong', 'b', 'em', 'i', 'ul', 'ol', 'li', 'span']);

/** Sanitasi HTML sederhana — hanya tag aman, tanpa atribut. */
export function sanitizeMemorialHtml(raw: string): string {
  let result = raw.replace(/<\s*(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '');
  result = result.replace(/<\s*(script|style|iframe|object|embed)[^>]*\/?>/gi, '');
  result = result.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  result = result.replace(/\s(href|src)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');

  result = result.replace(/<\/?([a-zA-Z0-9]+)([^>]*)>/g, (match, tagName: string, attrs: string) => {
    const tag = tagName.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) {
      return '';
    }
    if (attrs.trim().length > 0) {
      return match.startsWith('</') ? `</${tag}>` : `<${tag}>`;
    }
    return match;
  });

  return result.trim();
}
