import { AppError } from '../../../shared/errors/AppError';
import { ErrorCodes } from '../../../shared/errors/errorCodes';
import { moneyAccessRepository } from '../money-access.repository';
import {
  asBool,
  asNumber,
  parseEnum,
  parseNonEmptyString,
  parseOptionalAmount,
  parseOptionalDateOnly,
  parseOptionalEnum,
  parsePositiveInt,
  resolveMoneyContext,
  toDateOnly,
  toIso,
} from '../money.access';
import { computePocketBalances } from '../money.balance';
import {
  MONEY_POCKET_CATEGORIES,
  MONEY_POCKET_OWNER_TYPES,
} from '../money.constants';
import type {
  MoneyAccountRow,
  MoneyPocketDto,
  MoneyPocketRow,
} from '../money.types';
import { pocketsRepository } from './pockets.repository';

function toDto(
  row: MoneyPocketRow,
  account: MoneyAccountRow,
  balance: number,
): MoneyPocketDto {
  const isSystem = asBool(row.is_system);
  const archived = row.archived_at != null;
  return {
    id: row.id,
    accountId: row.account_id,
    ownerType: row.owner_type,
    ownerPersonId: row.owner_person_id,
    category: row.category,
    name: row.name,
    goalAmount: asNumber(row.goal_amount),
    goalDate: row.goal_date ? toDateOnly(row.goal_date) : null,
    isSystem,
    archivedAt: toIso(row.archived_at),
    balance,
    account: {
      id: account.id,
      name: account.name,
      type: account.type,
    },
    // Sembunyikan aksi hapus/archive di FE jika sistem, sudah archived, atau masih ada saldo
    canArchive: !isSystem && !archived && balance === 0,
  };
}

export class PocketsService {
  async list(
    authPersonId: number,
    familyId: number,
    query: Record<string, unknown>,
  ): Promise<MoneyPocketDto[]> {
    const ctx = await resolveMoneyContext(authPersonId, familyId);
    const personId =
      query.personId === undefined
        ? undefined
        : parsePositiveInt(query.personId, 'personId');
    const ownerType = parseOptionalEnum(
      query.ownerType,
      'ownerType',
      MONEY_POCKET_OWNER_TYPES,
    );
    const includeArchived =
      query.includeArchived === true ||
      query.includeArchived === 1 ||
      query.includeArchived === '1' ||
      query.includeArchived === 'true';

    if (personId != null) {
      const person = await moneyAccessRepository.findPersonById(
        ctx.workspace.id,
        personId,
      );
      if (!person) {
        throw new AppError(404, ErrorCodes.MONEY_PERSON_NOT_FOUND, 'Person tidak ditemukan.');
      }
    }

    const rows = await pocketsRepository.list(ctx.workspace.id, {
      personId,
      ownerType,
      includeArchived,
    });
    return this.mapWithBalances(ctx.workspace.id, rows);
  }

  async create(
    authPersonId: number,
    familyId: number,
    body: unknown,
  ): Promise<MoneyPocketDto> {
    const ctx = await resolveMoneyContext(authPersonId, familyId);
    if (!body || typeof body !== 'object') {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'Body tidak valid.');
    }
    const raw = body as Record<string, unknown>;
    const accountId = parsePositiveInt(raw.accountId, 'accountId');
    const ownerType = parseEnum(raw.ownerType, 'ownerType', MONEY_POCKET_OWNER_TYPES);
    const category = parseEnum(raw.category, 'category', MONEY_POCKET_CATEGORIES);
    const name = parseNonEmptyString(raw.name, 'name', 120);
    const goalAmount = parseOptionalAmount(raw.goalAmount, 'goalAmount') ?? null;
    const goalDate = parseOptionalDateOnly(raw.goalDate, 'goalDate') ?? null;

    const account = await pocketsRepository.findAccount(ctx.workspace.id, accountId);
    if (!account) {
      throw new AppError(404, ErrorCodes.MONEY_ACCOUNT_NOT_FOUND, 'Account tidak ditemukan.');
    }

    if (ownerType === 'joint' && ctx.workspace.mode !== 'couple') {
      throw new AppError(
        422,
        ErrorCodes.VALIDATION_ERROR,
        'Joint pocket hanya tersedia di mode couple.',
      );
    }

    if (account.type === 'cash') {
      throw new AppError(
        422,
        ErrorCodes.VALIDATION_ERROR,
        'Tidak dapat menambah pocket manual ke account cash.',
      );
    }

    const ownerPersonId = ownerType === 'joint' ? null : account.person_id;

    const row = await pocketsRepository.create({
      workspaceId: ctx.workspace.id,
      accountId,
      ownerType,
      ownerPersonId,
      category,
      name,
      goalAmount,
      goalDate,
    });

    const balances = await computePocketBalances([row.id]);
    return toDto(row, account, balances.get(row.id) ?? 0);
  }

  async update(
    authPersonId: number,
    familyId: number,
    pocketIdRaw: string,
    body: unknown,
  ): Promise<MoneyPocketDto> {
    const ctx = await resolveMoneyContext(authPersonId, familyId);
    const pocketId = parsePositiveInt(pocketIdRaw, 'id');
    const existing = await pocketsRepository.findById(ctx.workspace.id, pocketId);
    if (!existing) {
      throw new AppError(404, ErrorCodes.MONEY_POCKET_NOT_FOUND, 'Pocket tidak ditemukan.');
    }
    if (existing.archived_at) {
      throw new AppError(409, ErrorCodes.CONFLICT, 'Pocket sudah di-archive.');
    }

    if (!body || typeof body !== 'object') {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'Body tidak valid.');
    }
    const raw = body as Record<string, unknown>;
    const patch: Partial<{
      name: string;
      category: string;
      goal_amount: number | null;
      goal_date: string | null;
    }> = {};

    if (raw.name !== undefined) {
      if (asBool(existing.is_system)) {
        throw new AppError(403, ErrorCodes.FORBIDDEN, 'Nama pocket sistem tidak dapat diubah.');
      }
      patch.name = parseNonEmptyString(raw.name, 'name', 120);
    }
    if (raw.category !== undefined) {
      if (asBool(existing.is_system)) {
        throw new AppError(403, ErrorCodes.FORBIDDEN, 'Kategori pocket sistem tidak dapat diubah.');
      }
      patch.category = parseEnum(raw.category, 'category', MONEY_POCKET_CATEGORIES);
    }
    if (raw.goalAmount !== undefined) {
      patch.goal_amount = parseOptionalAmount(raw.goalAmount, 'goalAmount') ?? null;
    }
    if (raw.goalDate !== undefined) {
      patch.goal_date = parseOptionalDateOnly(raw.goalDate, 'goalDate') ?? null;
    }
    if (raw.ownerType !== undefined || raw.accountId !== undefined) {
      throw new AppError(
        422,
        ErrorCodes.VALIDATION_ERROR,
        'ownerType dan accountId tidak dapat diubah.',
      );
    }

    if (Object.keys(patch).length > 0) {
      await pocketsRepository.update(ctx.workspace.id, pocketId, patch);
    }

    const updated = (await pocketsRepository.findById(ctx.workspace.id, pocketId))!;
    const account = (await pocketsRepository.findAccount(
      ctx.workspace.id,
      updated.account_id,
    ))!;
    const balances = await computePocketBalances([pocketId]);
    return toDto(updated, account, balances.get(pocketId) ?? 0);
  }

  async archive(
    authPersonId: number,
    familyId: number,
    pocketIdRaw: string,
  ): Promise<MoneyPocketDto> {
    const ctx = await resolveMoneyContext(authPersonId, familyId);
    const pocketId = parsePositiveInt(pocketIdRaw, 'id');
    const existing = await pocketsRepository.findById(ctx.workspace.id, pocketId);
    if (!existing) {
      throw new AppError(404, ErrorCodes.MONEY_POCKET_NOT_FOUND, 'Pocket tidak ditemukan.');
    }
    if (asBool(existing.is_system)) {
      throw new AppError(403, ErrorCodes.FORBIDDEN, 'Pocket sistem tidak boleh di-archive.');
    }
    if (existing.archived_at) {
      const account = (await pocketsRepository.findAccount(
        ctx.workspace.id,
        existing.account_id,
      ))!;
      const balances = await computePocketBalances([pocketId]);
      return toDto(existing, account, balances.get(pocketId) ?? 0);
    }

    const balanceBefore = (await computePocketBalances([pocketId])).get(pocketId) ?? 0;
    if (balanceBefore !== 0) {
      throw new AppError(
        409,
        ErrorCodes.CONFLICT,
        'Pocket masih punya saldo. Kosongkan saldo sebelum archive/hapus.',
      );
    }

    await pocketsRepository.update(ctx.workspace.id, pocketId, {
      archived_at: new Date(),
    });

    const updated = (await pocketsRepository.findById(ctx.workspace.id, pocketId))!;
    const account = (await pocketsRepository.findAccount(
      ctx.workspace.id,
      updated.account_id,
    ))!;
    const balances = await computePocketBalances([pocketId]);
    return toDto(updated, account, balances.get(pocketId) ?? 0);
  }

  async unarchive(
    authPersonId: number,
    familyId: number,
    pocketIdRaw: string,
  ): Promise<MoneyPocketDto> {
    const ctx = await resolveMoneyContext(authPersonId, familyId);
    const pocketId = parsePositiveInt(pocketIdRaw, 'id');
    const existing = await pocketsRepository.findById(ctx.workspace.id, pocketId);
    if (!existing) {
      throw new AppError(404, ErrorCodes.MONEY_POCKET_NOT_FOUND, 'Pocket tidak ditemukan.');
    }
    if (!existing.archived_at) {
      const account = (await pocketsRepository.findAccount(
        ctx.workspace.id,
        existing.account_id,
      ))!;
      const balances = await computePocketBalances([pocketId]);
      return toDto(existing, account, balances.get(pocketId) ?? 0);
    }

    await pocketsRepository.update(ctx.workspace.id, pocketId, {
      archived_at: null,
    });

    const updated = (await pocketsRepository.findById(ctx.workspace.id, pocketId))!;
    const account = (await pocketsRepository.findAccount(
      ctx.workspace.id,
      updated.account_id,
    ))!;
    const balances = await computePocketBalances([pocketId]);
    return toDto(updated, account, balances.get(pocketId) ?? 0);
  }

  private async mapWithBalances(
    workspaceId: number,
    rows: MoneyPocketRow[],
  ): Promise<MoneyPocketDto[]> {
    const accountIds = [...new Set(rows.map((r) => r.account_id))];
    const accounts = await pocketsRepository.findAccountsByIds(workspaceId, accountIds);
    const accountMap = new Map(accounts.map((a) => [a.id, a]));
    const balances = await computePocketBalances(rows.map((r) => r.id));

    return rows.map((row) => {
      const account = accountMap.get(row.account_id);
      if (!account) {
        throw new AppError(
          500,
          ErrorCodes.INTERNAL_ERROR,
          `Account ${row.account_id} untuk pocket ${row.id} tidak ditemukan.`,
        );
      }
      return toDto(row, account, balances.get(row.id) ?? 0);
    });
  }
}

export const pocketsService = new PocketsService();
