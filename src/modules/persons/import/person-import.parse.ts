import { AppError } from '../../../shared/errors/AppError';
import { ErrorCodes } from '../../../shared/errors/errorCodes';
import { PersonAddress } from '../persons.types';
import { PERSON_IMPORT_MAX_ROWS, TEMP_ID_PATTERN } from './person-import.constants';
import { PersonImportFormat, PersonImportNormalizedRow } from './person-import.types';

function emptyToNull(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const text = String(value).trim();
  return text.length === 0 ? null : text;
}

function parseOptionalNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    const n = Number(value.trim());
    return n > 0 ? n : null;
  }
  return null;
}

function parseSpouseTempIds(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  const text = emptyToNull(value);
  if (!text) {
    return [];
  }
  return text
    .split(/[|,]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseSpouseIds(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value.filter((id): id is number => typeof id === 'number' && Number.isInteger(id) && id > 0);
  }
  const text = emptyToNull(value);
  if (!text) {
    return [];
  }
  return text
    .split(/[|,]/)
    .map((part) => Number(part.trim()))
    .filter((id) => Number.isInteger(id) && id > 0);
}

function buildAddress(raw: Record<string, unknown>): PersonAddress | null {
  const nested =
    raw.address && typeof raw.address === 'object'
      ? (raw.address as Record<string, unknown>)
      : null;

  const street = emptyToNull(nested?.street ?? raw.street);
  const district = emptyToNull(nested?.district ?? raw.district);
  const city = emptyToNull(nested?.city ?? raw.city);
  const province = emptyToNull(nested?.province ?? raw.province);
  const postalCode = emptyToNull(nested?.postalCode ?? raw.postalCode);
  const country = emptyToNull(nested?.country ?? raw.country);

  if (!street && !district && !city && !province && !postalCode && !country) {
    return null;
  }

  return { street, district, city, province, postalCode, country };
}

function normalizeRawRow(raw: Record<string, unknown>, row: number): PersonImportNormalizedRow {
  const tempId = emptyToNull(raw.tempId) ?? '';
  const fullName = emptyToNull(raw.fullName) ?? '';
  const genderRaw = emptyToNull(raw.gender);
  const birthDate = emptyToNull(raw.birthDate) ?? '';
  const deathDate = emptyToNull(raw.deathDate);
  const statusRaw = emptyToNull(raw.status);
  const religionRaw = emptyToNull(raw.religion);
  const roleRaw = emptyToNull(raw.role);

  let status: 'alive' | 'deceased' = 'alive';
  if (statusRaw === 'deceased' || deathDate) {
    status = 'deceased';
  } else if (statusRaw === 'alive' || !statusRaw) {
    status = 'alive';
  }

  return {
    row,
    tempId,
    fullName,
    nickname: emptyToNull(raw.nickname),
    gender: (genderRaw === 'male' || genderRaw === 'female' ? genderRaw : '') as 'male' | 'female',
    birthDate,
    deathDate,
    status,
    religion: religionRaw === 'islam' || religionRaw === 'other' ? religionRaw : null,
    occupation: emptyToNull(raw.occupation),
    phone: emptyToNull(raw.phone),
    phoneAlt: emptyToNull(raw.phoneAlt),
    address: buildAddress(raw),
    fatherTempId: emptyToNull(raw.fatherTempId),
    motherTempId: emptyToNull(raw.motherTempId),
    spouseTempIds: parseSpouseTempIds(raw.spouseTempIds),
    fatherId: parseOptionalNumber(raw.fatherId),
    motherId: parseOptionalNumber(raw.motherId),
    spouseIds: parseSpouseIds(raw.spouseIds),
    role: roleRaw === 'admin' ? 'admin' : 'member',
  };
}

/** Minimal RFC4180-ish CSV parser (quoted fields, commas, CRLF). */
export function parseCsvRows(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    // Skip trailing empty line
    if (row.length === 1 && row[0] === '' && rows.length > 0) {
      row = [];
      return;
    }
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < content.length; i += 1) {
    const ch = content[i];
    const next = content[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ',') {
      pushField();
      continue;
    }
    if (ch === '\n') {
      pushField();
      pushRow();
      continue;
    }
    if (ch === '\r') {
      continue;
    }
    field += ch;
  }

  if (field.length > 0 || row.length > 0) {
    pushField();
    pushRow();
  }

  return rows;
}

export function parseCsvToNormalizedRows(content: string): PersonImportNormalizedRow[] {
  const rows = parseCsvRows(content);
  if (rows.length === 0) {
    throw new AppError(
      400,
      ErrorCodes.PERSON_IMPORT_UNSUPPORTED_FORMAT,
      'File CSV kosong.',
    );
  }

  const headers = rows[0].map((h) => h.trim());
  if (!headers.includes('tempId') || !headers.includes('fullName')) {
    throw new AppError(
      400,
      ErrorCodes.PERSON_IMPORT_UNSUPPORTED_FORMAT,
      'Header CSV wajib memuat tempId dan fullName.',
    );
  }

  const dataRows = rows.slice(1).filter((cols) => cols.some((c) => c.trim().length > 0));
  if (dataRows.length === 0) {
    throw new AppError(400, ErrorCodes.PERSON_IMPORT_VALIDATION_FAILED, 'Tidak ada baris data.');
  }
  if (dataRows.length > PERSON_IMPORT_MAX_ROWS) {
    throw new AppError(
      400,
      ErrorCodes.PERSON_IMPORT_TOO_LARGE,
      `Maksimal ${PERSON_IMPORT_MAX_ROWS} baris per import.`,
    );
  }

  return dataRows.map((cols, index) => {
    const raw: Record<string, unknown> = {};
    headers.forEach((header, i) => {
      raw[header] = cols[i] ?? '';
    });
    return normalizeRawRow(raw, index + 1);
  });
}

/** Build a CSV line with exact column count (escapes quotes). */
export function toCsvLine(values: Array<string | null | undefined>): string {
  return values
    .map((value) => {
      const text = value ?? '';
      if (/[",\n\r]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`;
      }
      return text;
    })
    .join(',');
}

export function parseJsonToNormalizedRows(content: string): PersonImportNormalizedRow[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new AppError(
      400,
      ErrorCodes.PERSON_IMPORT_UNSUPPORTED_FORMAT,
      'Body/file JSON tidak valid.',
    );
  }

  return normalizeJsonPayload(parsed);
}

export function normalizeJsonPayload(parsed: unknown): PersonImportNormalizedRow[] {
  let list: unknown[];
  if (Array.isArray(parsed)) {
    list = parsed;
  } else if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { persons?: unknown }).persons)) {
    list = (parsed as { persons: unknown[] }).persons;
  } else {
    throw new AppError(
      400,
      ErrorCodes.PERSON_IMPORT_UNSUPPORTED_FORMAT,
      'JSON harus berupa array persons atau { "persons": [...] }.',
    );
  }

  if (list.length === 0) {
    throw new AppError(400, ErrorCodes.PERSON_IMPORT_VALIDATION_FAILED, 'Tidak ada baris data.');
  }
  if (list.length > PERSON_IMPORT_MAX_ROWS) {
    throw new AppError(
      400,
      ErrorCodes.PERSON_IMPORT_TOO_LARGE,
      `Maksimal ${PERSON_IMPORT_MAX_ROWS} baris per import.`,
    );
  }

  return list.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new AppError(
        400,
        ErrorCodes.PERSON_IMPORT_VALIDATION_FAILED,
        `Baris ${index + 1}: objek person tidak valid.`,
      );
    }
    return normalizeRawRow(item as Record<string, unknown>, index + 1);
  });
}

export function detectFormatFromFilename(filename: string | undefined): PersonImportFormat | null {
  if (!filename) {
    return null;
  }
  const lower = filename.toLowerCase();
  if (lower.endsWith('.csv')) {
    return 'csv';
  }
  if (lower.endsWith('.json')) {
    return 'json';
  }
  return null;
}

export function isValidTempIdShape(tempId: string): boolean {
  return TEMP_ID_PATTERN.test(tempId);
}
