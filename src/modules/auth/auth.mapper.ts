import { getAllowedReadFocusPersonIds } from '../persons/read-focus.service';
import { AllowedFocusPerson, AuthMeBase, AuthPersonSummary, PersonAuthRow } from './auth.types';

export function formatBirthDate(value: Date | string): string {
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return value.slice(0, 10);
}

/** Usia di atas 17 tahun (minimal 18 tahun — birthday sudah lewat). */
export function isLegalAge(birthDate: string, asOf: Date = new Date()): boolean {
  const match = birthDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return false;
  }

  const birth = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  let age = asOf.getFullYear() - birth.getFullYear();
  const monthDiff = asOf.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && asOf.getDate() < birth.getDate())) {
    age -= 1;
  }

  return age > 17;
}

export function toAllowedFocusPerson(
  row: PersonAuthRow,
  relation: 'self' | 'spouse',
): AllowedFocusPerson {
  return {
    id: row.id,
    fullName: row.full_name,
    nickname: row.nickname,
    gender: row.gender,
    photoUrl: row.photo_url,
    relation,
  };
}

/**
 * Sinkron dengan allowedFocusPersonIds: self dulu, lalu pasangan yang diizinkan.
 * Pasangan yang tidak ketemu di DB di-skip (edge case soft-delete race).
 */
export function buildAllowedFocusPersons(
  self: PersonAuthRow,
  spouseIds: number[],
  spouseRows: PersonAuthRow[],
): AllowedFocusPerson[] {
  const byId = new Map(spouseRows.map((row) => [row.id, row]));
  const allowedIds = getAllowedReadFocusPersonIds(self.id, spouseIds);
  const result: AllowedFocusPerson[] = [];

  for (const id of allowedIds) {
    if (id === self.id) {
      result.push(toAllowedFocusPerson(self, 'self'));
      continue;
    }

    const spouse = byId.get(id);
    if (spouse) {
      result.push(toAllowedFocusPerson(spouse, 'spouse'));
    }
  }

  return result;
}

export function toAuthPersonSummary(
  row: PersonAuthRow,
  spouseIds: number[] = [],
  spouseRows: PersonAuthRow[] = [],
): AuthPersonSummary {
  const birthDate = formatBirthDate(row.birth_date);

  const role = row.role === 'admin' ? 'admin' : 'member';

  return {
    id: row.id,
    fullName: row.full_name,
    nickname: row.nickname,
    gender: row.gender,
    birthDate,
    status: row.status,
    photoUrl: row.photo_url,
    role,
    isAdmin: role === 'admin',
    isMarried: spouseIds.length > 0,
    isLegal: isLegalAge(birthDate),
    spouseIds,
    allowedFocusPersons: buildAllowedFocusPersons(row, spouseIds, spouseRows),
  };
}

export function toAuthMeResponse(
  row: PersonAuthRow,
  spouseIds: number[] = [],
  spouseRows: PersonAuthRow[] = [],
): AuthMeBase {
  return {
    ...toAuthPersonSummary(row, spouseIds, spouseRows),
    familyId: row.family_id,
  };
}
