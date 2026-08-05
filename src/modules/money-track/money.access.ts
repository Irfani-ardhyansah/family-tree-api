import { AppError } from '../../shared/errors/AppError';
import { ErrorCodes } from '../../shared/errors/errorCodes';
import type { MoneyPersonRole, MoneyWorkspaceMode } from './money.constants';
import { moneyAccessRepository } from './money-access.repository';
import type { MoneyContext, MoneyPersonDto, MoneyPersonRow } from './money.types';

export function toIso(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString();
}

/**
 * Calendar date-only (YYYY-MM-DD). Never use UTC `toISOString().slice(0,10)` on a
 * Date — mysql2 DATE as local midnight would shift WIB → previous UTC day.
 */
export function toDateOnly(value: Date | string): string {
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1]!;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return String(value).slice(0, 10);
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function asNumber(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function asBool(value: boolean | number): boolean {
  return value === true || value === 1;
}

export function toMoneyPersonDto(row: MoneyPersonRow): MoneyPersonDto {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    userId: row.user_id,
    familyRootsPersonId: row.family_roots_person_id,
  };
}

export async function resolveMoneyContext(
  authPersonId: number,
  familyId: number,
): Promise<MoneyContext> {
  const actor = await moneyAccessRepository.findPersonByUserId(authPersonId);
  if (!actor) {
    throw new AppError(
      404,
      ErrorCodes.MONEY_NOT_CONFIGURED,
      'Money Track belum dikonfigurasi. Lakukan setup terlebih dahulu.',
    );
  }

  const workspace = await moneyAccessRepository.findWorkspaceById(actor.workspace_id);
  if (!workspace || workspace.family_id !== familyId) {
    throw new AppError(
      404,
      ErrorCodes.MONEY_WORKSPACE_NOT_FOUND,
      'Workspace Money Track tidak ditemukan.',
    );
  }

  return { workspace, actor };
}

export async function tryResolveMoneyContext(
  authPersonId: number,
  familyId: number,
): Promise<MoneyContext | null> {
  const actor = await moneyAccessRepository.findPersonByUserId(authPersonId);
  if (!actor) return null;
  const workspace = await moneyAccessRepository.findWorkspaceById(actor.workspace_id);
  if (!workspace || workspace.family_id !== familyId) return null;
  return { workspace, actor };
}

export function assertPersonInWorkspace(
  persons: MoneyPersonRow[],
  personId: number,
  message = 'Person tidak ada di workspace ini.',
): MoneyPersonRow {
  const found = persons.find((p) => p.id === personId);
  if (!found) {
    throw new AppError(404, ErrorCodes.MONEY_PERSON_NOT_FOUND, message);
  }
  return found;
}

export function parsePositiveInt(value: unknown, field: string): number {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const n = Number(value);
    if (n > 0) return n;
  }
  throw new AppError(422, ErrorCodes.VALIDATION_ERROR, `${field} harus bilangan bulat positif.`);
}

export function parseOptionalPositiveInt(
  value: unknown,
  field: string,
): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return parsePositiveInt(value, field);
}

export function parseNonEmptyString(value: unknown, field: string, maxLen: number): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AppError(422, ErrorCodes.VALIDATION_ERROR, `${field} wajib diisi.`);
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLen) {
    throw new AppError(
      422,
      ErrorCodes.VALIDATION_ERROR,
      `${field} maksimal ${maxLen} karakter.`,
    );
  }
  return trimmed;
}

export function parseOptionalString(
  value: unknown,
  field: string,
  maxLen: number,
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw new AppError(422, ErrorCodes.VALIDATION_ERROR, `${field} harus string.`);
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLen) {
    throw new AppError(
      422,
      ErrorCodes.VALIDATION_ERROR,
      `${field} maksimal ${maxLen} karakter.`,
    );
  }
  return trimmed.length === 0 ? null : trimmed;
}

export function parseDateOnly(value: unknown, field: string): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AppError(422, ErrorCodes.VALIDATION_ERROR, `${field} harus format YYYY-MM-DD.`);
  }
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) {
    throw new AppError(422, ErrorCodes.VALIDATION_ERROR, `${field} bukan tanggal valid.`);
  }
  return value;
}

export function parseOptionalDateOnly(
  value: unknown,
  field: string,
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  return parseDateOnly(value, field);
}

export function parseAmount(
  value: unknown,
  field: string,
  opts: { allowZero?: boolean; allowNegative?: boolean } = {},
): number {
  const n =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : NaN;
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    throw new AppError(
      422,
      ErrorCodes.VALIDATION_ERROR,
      `${field} harus bilangan bulat (rupiah).`,
    );
  }
  if (!opts.allowNegative && n < 0) {
    throw new AppError(422, ErrorCodes.VALIDATION_ERROR, `${field} tidak boleh negatif.`);
  }
  if (!opts.allowZero && n === 0) {
    throw new AppError(422, ErrorCodes.VALIDATION_ERROR, `${field} harus lebih dari 0.`);
  }
  return n;
}

export function parseOptionalAmount(
  value: unknown,
  field: string,
): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return parseAmount(value, field, { allowZero: true });
}

export function parseEnum<T extends string>(
  value: unknown,
  field: string,
  allowed: readonly T[],
): T {
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    throw new AppError(
      422,
      ErrorCodes.VALIDATION_ERROR,
      `${field} harus salah satu dari: ${allowed.join(', ')}.`,
    );
  }
  return value as T;
}

export function parseOptionalEnum<T extends string>(
  value: unknown,
  field: string,
  allowed: readonly T[],
): T | undefined {
  if (value === undefined) return undefined;
  return parseEnum(value, field, allowed);
}

export function parsePage(raw: Record<string, unknown>): { page: number; pageSize: number } {
  const page =
    raw.page === undefined ? 1 : parsePositiveInt(raw.page, 'page');
  const pageSizeRaw =
    raw.pageSize === undefined ? 20 : parsePositiveInt(raw.pageSize, 'pageSize');
  return { page, pageSize: Math.min(pageSizeRaw, 100) };
}

export function inferWorkspaceMode(roles: MoneyPersonRole[]): MoneyWorkspaceMode {
  if (roles.length === 1 && roles[0] === 'self') return 'single';
  if (
    roles.length === 2 &&
    roles.includes('husband') &&
    roles.includes('wife')
  ) {
    return 'couple';
  }
  throw new AppError(
    422,
    ErrorCodes.VALIDATION_ERROR,
    'Single: 1 person role self. Couple: tepat 2 person husband + wife.',
  );
}
