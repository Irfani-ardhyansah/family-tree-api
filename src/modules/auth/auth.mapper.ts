import { AuthMeResponse, AuthPersonSummary, PersonAuthRow } from './auth.types';

export function formatBirthDate(value: Date | string): string {
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return value.slice(0, 10);
}

export function toAuthPersonSummary(row: PersonAuthRow): AuthPersonSummary {
  return {
    id: row.id,
    fullName: row.full_name,
    nickname: row.nickname,
    gender: row.gender,
    birthDate: formatBirthDate(row.birth_date),
    status: row.status,
    photoUrl: row.photo_url,
  };
}

export function toAuthMeResponse(row: PersonAuthRow): AuthMeResponse {
  return {
    ...toAuthPersonSummary(row),
    familyId: row.family_id,
  };
}
