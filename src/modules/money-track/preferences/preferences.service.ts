import { AppError } from '../../../shared/errors/AppError';
import { ErrorCodes } from '../../../shared/errors/errorCodes';
import { parseEnum, resolveMoneyContext } from '../money.access';
import { MONEY_PREF_TX_TYPES } from '../money.constants';
import { categoriesRepository } from '../categories/categories.repository';
import { moneyAccessRepository } from '../money-access.repository';
import { pocketsRepository } from '../pockets/pockets.repository';
import type { MoneyPreferencesDto, MoneyScopedDefaultsDto } from '../money.types';
import {
  normalizeQuickAmounts,
  parseNullableId,
  toPreferencesDto,
} from './preferences.helpers';
import { preferencesRepository } from './preferences.repository';

export class PreferencesService {
  async get(authPersonId: number, familyId: number): Promise<MoneyPreferencesDto> {
    const ctx = await resolveMoneyContext(authPersonId, familyId);
    const row = await preferencesRepository.findByWorkspace(ctx.workspace.id);
    return toPreferencesDto(row);
  }

  async update(
    authPersonId: number,
    familyId: number,
    body: unknown,
  ): Promise<MoneyPreferencesDto> {
    const ctx = await resolveMoneyContext(authPersonId, familyId);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'Body tidak valid.');
    }
    const raw = body as Record<string, unknown>;
    const workspaceId = ctx.workspace.id;

    const defaultTxType =
      raw.defaultTxType === undefined
        ? 'expense'
        : parseEnum(raw.defaultTxType, 'defaultTxType', MONEY_PREF_TX_TYPES);
    const quickAmounts = normalizeQuickAmounts(raw.quickAmounts);
    const shared = await this.sanitizeScoped(raw.shared, workspaceId, 'shared');

    const persons: Record<string, MoneyScopedDefaultsDto> = {};
    if (raw.persons !== undefined && raw.persons !== null) {
      if (typeof raw.persons !== 'object' || Array.isArray(raw.persons)) {
        throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'persons harus objek.');
      }
      for (const [key, value] of Object.entries(
        raw.persons as Record<string, unknown>,
      )) {
        const personId = Number(key);
        if (!Number.isInteger(personId) || personId <= 0) continue;
        const person = await moneyAccessRepository.findPersonById(
          workspaceId,
          personId,
        );
        // Person di luar workspace → lewati, bukan error.
        if (!person) continue;
        persons[String(personId)] = await this.sanitizeScoped(
          value,
          workspaceId,
          `persons.${key}`,
        );
      }
    }

    const row = await preferencesRepository.upsert({
      workspaceId,
      defaultTxType,
      quickAmounts,
      shared,
      persons,
    });
    return toPreferencesDto(row);
  }

  /**
   * ID yang tidak valid / bukan milik workspace / archived / tipe kategori salah
   * → dinormalkan jadi `null` (bukan error 500).
   */
  private async sanitizeScoped(
    value: unknown,
    workspaceId: number,
    field: string,
  ): Promise<MoneyScopedDefaultsDto> {
    const row = (value ?? {}) as Record<string, unknown>;
    const expensePocketId = parseNullableId(
      row.expensePocketId,
      `${field}.expensePocketId`,
    );
    const incomePocketId = parseNullableId(
      row.incomePocketId,
      `${field}.incomePocketId`,
    );
    const expenseCategoryId = parseNullableId(
      row.expenseCategoryId,
      `${field}.expenseCategoryId`,
    );
    const incomeCategoryId = parseNullableId(
      row.incomeCategoryId,
      `${field}.incomeCategoryId`,
    );

    const [expensePocketOk, incomePocketOk, expenseCategoryOk, incomeCategoryOk] =
      await Promise.all([
        this.isValidPocket(workspaceId, expensePocketId),
        this.isValidPocket(workspaceId, incomePocketId),
        this.isValidCategory(workspaceId, expenseCategoryId, 'expense'),
        this.isValidCategory(workspaceId, incomeCategoryId, 'income'),
      ]);

    return {
      expensePocketId: expensePocketOk ? expensePocketId : null,
      incomePocketId: incomePocketOk ? incomePocketId : null,
      expenseCategoryId: expenseCategoryOk ? expenseCategoryId : null,
      incomeCategoryId: incomeCategoryOk ? incomeCategoryId : null,
    };
  }

  private async isValidPocket(
    workspaceId: number,
    pocketId: number | null,
  ): Promise<boolean> {
    if (pocketId == null) return false;
    const pocket = await pocketsRepository.findById(workspaceId, pocketId);
    return Boolean(pocket) && pocket!.archived_at == null;
  }

  private async isValidCategory(
    workspaceId: number,
    categoryId: number | null,
    type: 'expense' | 'income',
  ): Promise<boolean> {
    if (categoryId == null) return false;
    const category = await categoriesRepository.findById(workspaceId, categoryId);
    return Boolean(category) && category!.type === type;
  }
}

export const preferencesService = new PreferencesService();
