import { AppError } from '../../../shared/errors/AppError';
import { ErrorCodes } from '../../../shared/errors/errorCodes';
import { moneyAccessRepository } from '../money-access.repository';
import {
  parseEnum,
  parseNonEmptyString,
  parseOptionalString,
  parsePositiveInt,
  resolveMoneyContext,
} from '../money.access';
import { computePocketBalances } from '../money.balance';
import { MONEY_ACCOUNT_TYPES } from '../money.constants';
import type { MoneyAccountDto, MoneyAccountRow } from '../money.types';
import { setupRepository } from '../setup/setup.repository';
import { createTunaiPocketForAccount } from './accounts.helpers';
import { accountsRepository } from './accounts.repository';

function resolveDeleteability(
  row: MoneyAccountRow,
  pocketIds: number[],
  activePocketCount: number,
  balances: Map<number, number>,
): { canDelete: boolean; deleteBlockedReason: string | null } {
  if (row.type === 'cash') {
    return {
      canDelete: false,
      deleteBlockedReason: 'Account cash tidak boleh dihapus.',
    };
  }
  if (activePocketCount > 0) {
    return {
      canDelete: false,
      deleteBlockedReason: 'Account masih punya pocket aktif.',
    };
  }
  for (const id of pocketIds) {
    if ((balances.get(id) ?? 0) !== 0) {
      return {
        canDelete: false,
        deleteBlockedReason: 'Account masih punya saldo di pocket.',
      };
    }
  }
  if (pocketIds.length > 0) {
    return {
      canDelete: false,
      deleteBlockedReason: 'Account masih punya pocket (termasuk archived).',
    };
  }
  return { canDelete: true, deleteBlockedReason: null };
}

async function toDto(row: MoneyAccountRow): Promise<MoneyAccountDto> {
  const pocketIds = await accountsRepository.listPocketIds(row.id);
  const activePocketCount = await accountsRepository.countPockets(row.id);
  const balances = await computePocketBalances(pocketIds);
  const { canDelete, deleteBlockedReason } = resolveDeleteability(
    row,
    pocketIds,
    activePocketCount,
    balances,
  );
  return {
    id: row.id,
    personId: row.person_id,
    name: row.name,
    type: row.type,
    bankName: row.bank_name,
    canDelete,
    deleteBlockedReason,
  };
}

export class AccountsService {
  async list(
    authPersonId: number,
    familyId: number,
    query: Record<string, unknown>,
  ): Promise<MoneyAccountDto[]> {
    const ctx = await resolveMoneyContext(authPersonId, familyId);
    const personId =
      query.personId === undefined
        ? undefined
        : parsePositiveInt(query.personId, 'personId');
    if (personId != null) {
      const person = await moneyAccessRepository.findPersonById(
        ctx.workspace.id,
        personId,
      );
      if (!person) {
        throw new AppError(404, ErrorCodes.MONEY_PERSON_NOT_FOUND, 'Person tidak ditemukan.');
      }
    }
    const rows = await accountsRepository.list(ctx.workspace.id, personId);
    return Promise.all(rows.map(toDto));
  }

  async create(
    authPersonId: number,
    familyId: number,
    body: unknown,
  ): Promise<MoneyAccountDto> {
    const ctx = await resolveMoneyContext(authPersonId, familyId);
    if (!body || typeof body !== 'object') {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'Body tidak valid.');
    }
    const raw = body as Record<string, unknown>;
    const personId = parsePositiveInt(raw.personId, 'personId');
    const name = parseNonEmptyString(raw.name, 'name', 120);
    const type = parseEnum(raw.type, 'type', MONEY_ACCOUNT_TYPES);
    const bankName = parseOptionalString(raw.bankName, 'bankName', 120) ?? null;

    const person = await moneyAccessRepository.findPersonById(ctx.workspace.id, personId);
    if (!person) {
      throw new AppError(404, ErrorCodes.MONEY_PERSON_NOT_FOUND, 'Person tidak ditemukan.');
    }

    if (type === 'cash') {
      const cashCount = await accountsRepository.countCashForPerson(
        ctx.workspace.id,
        personId,
      );
      if (cashCount > 0) {
        throw new AppError(
          409,
          ErrorCodes.CONFLICT,
          'Setiap person hanya boleh punya satu account cash.',
        );
      }
    }

    if (type === 'bank' && !bankName) {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'bankName wajib untuk type bank.');
    }

    const account = await accountsRepository.create({
      workspaceId: ctx.workspace.id,
      personId,
      name: type === 'cash' ? name || 'Tunai' : name,
      type,
      bankName: type === 'cash' ? null : bankName,
    });

    if (type === 'cash') {
      await createTunaiPocketForAccount({
        workspaceId: ctx.workspace.id,
        accountId: account.id,
        ownerPersonId: personId,
      });
    } else {
      const nonCashCount = await setupRepository.countActiveNonCashAccounts(
        ctx.workspace.id,
        personId,
      );
      if (nonCashCount === 1) {
        await setupRepository.createDefaultPocketsForAccount({
          workspaceId: ctx.workspace.id,
          accountId: account.id,
          ownerPersonId: personId,
        });
      }
    }

    return toDto(account);
  }

  async update(
    authPersonId: number,
    familyId: number,
    accountIdRaw: string,
    body: unknown,
  ): Promise<MoneyAccountDto> {
    const ctx = await resolveMoneyContext(authPersonId, familyId);
    const accountId = parsePositiveInt(accountIdRaw, 'id');
    const existing = await accountsRepository.findById(ctx.workspace.id, accountId);
    if (!existing) {
      throw new AppError(404, ErrorCodes.MONEY_ACCOUNT_NOT_FOUND, 'Account tidak ditemukan.');
    }

    if (!body || typeof body !== 'object') {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'Body tidak valid.');
    }
    const raw = body as Record<string, unknown>;
    const patch: Partial<{ name: string; bank_name: string | null }> = {};

    if (raw.name !== undefined) {
      patch.name = parseNonEmptyString(raw.name, 'name', 120);
    }
    if (raw.bankName !== undefined) {
      if (existing.type === 'cash') {
        throw new AppError(
          422,
          ErrorCodes.VALIDATION_ERROR,
          'Account cash tidak punya bankName.',
        );
      }
      patch.bank_name = parseOptionalString(raw.bankName, 'bankName', 120) ?? null;
    }
    if (raw.type !== undefined) {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'type account tidak dapat diubah.');
    }
    if (raw.personId !== undefined) {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'personId tidak dapat diubah.');
    }

    if (Object.keys(patch).length === 0) {
      return toDto(existing);
    }

    await accountsRepository.update(ctx.workspace.id, accountId, patch);
    const updated = await accountsRepository.findById(ctx.workspace.id, accountId);
    return toDto(updated!);
  }

  async remove(
    authPersonId: number,
    familyId: number,
    accountIdRaw: string,
  ): Promise<{ deleted: true }> {
    const ctx = await resolveMoneyContext(authPersonId, familyId);
    const accountId = parsePositiveInt(accountIdRaw, 'id');
    const existing = await accountsRepository.findById(ctx.workspace.id, accountId);
    if (!existing) {
      throw new AppError(404, ErrorCodes.MONEY_ACCOUNT_NOT_FOUND, 'Account tidak ditemukan.');
    }

    const dto = await toDto(existing);
    if (!dto.canDelete) {
      const status = existing.type === 'cash' ? 403 : 409;
      const code = existing.type === 'cash' ? ErrorCodes.FORBIDDEN : ErrorCodes.CONFLICT;
      throw new AppError(
        status,
        code,
        dto.deleteBlockedReason ?? 'Account tidak dapat dihapus.',
      );
    }

    await accountsRepository.delete(ctx.workspace.id, accountId);
    return { deleted: true };
  }
}

export const accountsService = new AccountsService();
