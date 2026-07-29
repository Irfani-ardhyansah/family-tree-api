import { AppError } from '../../../shared/errors/AppError';
import { ErrorCodes } from '../../../shared/errors/errorCodes';
import {
  asBool,
  parseEnum,
  parseNonEmptyString,
  parseOptionalEnum,
  parseOptionalString,
  parsePositiveInt,
  resolveMoneyContext,
} from '../money.access';
import { MONEY_CATEGORY_TYPES } from '../money.constants';
import type { MoneyCategoryDto, MoneyCategoryRow } from '../money.types';
import { categoriesRepository } from './categories.repository';

async function toDto(row: MoneyCategoryRow): Promise<MoneyCategoryDto> {
  const isSystem = asBool(row.is_system);
  if (isSystem) {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      icon: row.icon,
      sortOrder: row.sort_order,
      isSystem: true,
      canDelete: false,
      deleteBlockedReason: 'Kategori sistem tidak boleh dihapus.',
    };
  }

  const used = await categoriesRepository.countTransactions(row.id);
  if (used > 0) {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      icon: row.icon,
      sortOrder: row.sort_order,
      isSystem: false,
      canDelete: false,
      deleteBlockedReason: 'Kategori masih dipakai transaksi.',
    };
  }

  return {
    id: row.id,
    name: row.name,
    type: row.type,
    icon: row.icon,
    sortOrder: row.sort_order,
    isSystem: false,
    canDelete: true,
    deleteBlockedReason: null,
  };
}

export class CategoriesService {
  async list(
    authPersonId: number,
    familyId: number,
    query: Record<string, unknown>,
  ): Promise<MoneyCategoryDto[]> {
    const ctx = await resolveMoneyContext(authPersonId, familyId);
    const type = parseOptionalEnum(query.type, 'type', MONEY_CATEGORY_TYPES);
    const rows = await categoriesRepository.list(ctx.workspace.id, type);
    return Promise.all(rows.map(toDto));
  }

  async create(
    authPersonId: number,
    familyId: number,
    body: unknown,
  ): Promise<MoneyCategoryDto> {
    const ctx = await resolveMoneyContext(authPersonId, familyId);
    if (!body || typeof body !== 'object') {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'Body tidak valid.');
    }
    const raw = body as Record<string, unknown>;
    const name = parseNonEmptyString(raw.name, 'name', 80);
    const type = parseEnum(raw.type, 'type', MONEY_CATEGORY_TYPES);
    const icon = parseOptionalString(raw.icon, 'icon', 64) ?? null;
    const sortOrder =
      raw.sortOrder === undefined
        ? (await categoriesRepository.maxSortOrder(ctx.workspace.id, type)) + 1
        : parsePositiveInt(raw.sortOrder, 'sortOrder');

    const row = await categoriesRepository.create({
      workspaceId: ctx.workspace.id,
      name,
      type,
      icon,
      sortOrder,
    });
    return toDto(row);
  }

  async update(
    authPersonId: number,
    familyId: number,
    categoryIdRaw: string,
    body: unknown,
  ): Promise<MoneyCategoryDto> {
    const ctx = await resolveMoneyContext(authPersonId, familyId);
    const categoryId = parsePositiveInt(categoryIdRaw, 'id');
    const existing = await categoriesRepository.findById(ctx.workspace.id, categoryId);
    if (!existing) {
      throw new AppError(
        404,
        ErrorCodes.MONEY_CATEGORY_NOT_FOUND,
        'Kategori tidak ditemukan.',
      );
    }

    if (!body || typeof body !== 'object') {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'Body tidak valid.');
    }
    const raw = body as Record<string, unknown>;
    const patch: Partial<{ name: string; icon: string | null; sort_order: number }> = {};

    if (raw.name !== undefined) {
      patch.name = parseNonEmptyString(raw.name, 'name', 80);
    }
    if (raw.icon !== undefined) {
      patch.icon = parseOptionalString(raw.icon, 'icon', 64) ?? null;
    }
    if (raw.sortOrder !== undefined) {
      patch.sort_order = parsePositiveInt(raw.sortOrder, 'sortOrder');
    }
    if (raw.type !== undefined) {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'type kategori tidak dapat diubah.');
    }

    if (Object.keys(patch).length > 0) {
      await categoriesRepository.update(ctx.workspace.id, categoryId, patch);
    }

    const updated = await categoriesRepository.findById(ctx.workspace.id, categoryId);
    return toDto(updated!);
  }

  async remove(
    authPersonId: number,
    familyId: number,
    categoryIdRaw: string,
  ): Promise<{ deleted: true }> {
    const ctx = await resolveMoneyContext(authPersonId, familyId);
    const categoryId = parsePositiveInt(categoryIdRaw, 'id');
    const existing = await categoriesRepository.findById(ctx.workspace.id, categoryId);
    if (!existing) {
      throw new AppError(
        404,
        ErrorCodes.MONEY_CATEGORY_NOT_FOUND,
        'Kategori tidak ditemukan.',
      );
    }

    const dto = await toDto(existing);
    if (!dto.canDelete) {
      const status = asBool(existing.is_system) ? 403 : 409;
      const code = asBool(existing.is_system) ? ErrorCodes.FORBIDDEN : ErrorCodes.CONFLICT;
      throw new AppError(
        status,
        code,
        dto.deleteBlockedReason ?? 'Kategori tidak dapat dihapus.',
      );
    }

    await categoriesRepository.softDelete(ctx.workspace.id, categoryId);
    return { deleted: true };
  }
}

export const categoriesService = new CategoriesService();
