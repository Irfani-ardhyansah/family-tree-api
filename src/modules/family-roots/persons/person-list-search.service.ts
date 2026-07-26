/**
 * Search list persons — match **per kata** (AND, urutan bebas).
 *
 * Contoh: q="Mulyono Basuki" cocok dengan "Basuki Mulyono" / "H. Basuki Mulyono".
 * Tidak match partial huruf: q="Mul" tidak cocok "Mulyono".
 */

const MAX_Q_LENGTH = 100;

/** Pecah teks jadi token kata (huruf/angka), case-insensitive. */
export function tokenizeSearchWords(input: string): string[] {
  return input
    .trim()
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export function parseListSearchQuery(raw: unknown): string | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  return trimmed.slice(0, MAX_Q_LENGTH);
}

export function matchesPersonWordSearch(
  person: { full_name: string; nickname: string | null },
  query: string,
): boolean {
  const needles = tokenizeSearchWords(query);
  if (needles.length === 0) {
    return true;
  }

  const haystack = new Set(
    tokenizeSearchWords([person.full_name, person.nickname ?? ''].join(' ')),
  );

  return needles.every((word) => haystack.has(word));
}
