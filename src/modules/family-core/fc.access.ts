import { AppError } from '../../shared/errors/AppError';
import { ErrorCodes } from '../../shared/errors/errorCodes';
import { fcAccessRepository } from './fc-access.repository';
import type { FcContext } from './fc.types';

export function toIso(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString();
}

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

export function asBool(value: boolean | number): boolean {
  return value === true || value === 1;
}

export function parseJsonArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function parseJsonObject(value: unknown): Record<string, string> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (typeof v === 'string') out[k] = v;
      else if (v != null) out[k] = String(v);
    }
    return out;
  }
  if (typeof value === 'string') {
    try {
      return parseJsonObject(JSON.parse(value));
    } catch {
      return {};
    }
  }
  return {};
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

export function parseEnum<T extends string | number>(
  value: unknown,
  field: string,
  allowed: readonly T[],
): T {
  if (!(allowed as readonly unknown[]).includes(value)) {
    throw new AppError(
      422,
      ErrorCodes.VALIDATION_ERROR,
      `${field} harus salah satu dari: ${allowed.join(', ')}.`,
    );
  }
  return value as T;
}

export function parseOptionalEnum<T extends string | number>(
  value: unknown,
  field: string,
  allowed: readonly T[],
): T | undefined {
  if (value === undefined) return undefined;
  return parseEnum(value, field, allowed);
}

export function parseBool(value: unknown, field: string): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1' || value === 'true') return true;
  if (value === 0 || value === '0' || value === 'false') return false;
  throw new AppError(422, ErrorCodes.VALIDATION_ERROR, `${field} harus boolean.`);
}

export function parseOptionalBool(
  value: unknown,
  field: string,
): boolean | undefined {
  if (value === undefined) return undefined;
  return parseBool(value, field);
}

export function slugifyLabel(label: string): string {
  const base = label
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
  return base.length > 0 ? base : 'custom';
}

export async function resolveFcContext(
  authPersonId: number,
  familyId: number,
): Promise<FcContext> {
  const member = await fcAccessRepository.findMembership(familyId, authPersonId);
  if (!member) {
    throw new AppError(
      403,
      ErrorCodes.FC_ACCESS_FORBIDDEN,
      'Hanya anggota keluarga inti yang dapat mengakses Family Core.',
    );
  }
  return { familyId, actorPersonId: authPersonId };
}
