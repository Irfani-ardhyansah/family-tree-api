export type LoginCodePerson = {
  fullName: string;
  nickname?: string | null;
  birthDate: string;
};

const TITLE_PREFIX = /^(H\.|Hj\.|Dr\.|Prof\.|Ny\.|Tn\.)\s*/i;
const VALID_FORMAT = /^([A-Z]+)(\d{6})$/;

function lettersOnly(value: string): string {
  return value.replace(/[^A-Za-z]/g, '');
}

function stripTitleFromWord(word: string): string {
  return word.replace(TITLE_PREFIX, '');
}

export function buildNameAbbrev(fullName: string, nickname?: string | null): string {
  if (nickname) {
    return lettersOnly(nickname).toUpperCase();
  }

  const words = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(stripTitleFromWord)
    .map(lettersOnly)
    .filter((word) => word.length > 0);

  if (words.length === 0) {
    return '';
  }

  if (words.length === 1) {
    return words[0].toUpperCase();
  }

  return words.map((word) => word[0].toUpperCase()).join('');
}

export function buildBirthDateSuffix(birthDate: string): string {
  const match = birthDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new Error(`Invalid birthDate format: ${birthDate}`);
  }

  const year = match[1];
  const month = match[2];
  const day = match[3];
  const yy = year.slice(-2);

  return `${day}${month}${yy}`;
}

export function buildLoginCode(person: LoginCodePerson): string {
  const abbrev = buildNameAbbrev(person.fullName, person.nickname);
  const suffix = buildBirthDateSuffix(person.birthDate);
  return `${abbrev}${suffix}`;
}

export function normalize(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

export function isValidFormat(code: string): boolean {
  const normalized = normalize(code);
  const match = normalized.match(VALID_FORMAT);
  if (!match) {
    return false;
  }

  return match[1].length >= 1;
}

export const loginCodeService = {
  buildNameAbbrev,
  buildBirthDateSuffix,
  buildLoginCode,
  normalize,
  isValidFormat,
};
