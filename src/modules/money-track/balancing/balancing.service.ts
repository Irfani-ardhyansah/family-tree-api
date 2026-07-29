import type { Knex } from 'knex';
import db from '../../../config/database';
import { Tables } from '../../../shared/database/tables';
import { AppError } from '../../../shared/errors/AppError';
import { ErrorCodes } from '../../../shared/errors/errorCodes';
import {
  asNumber,
  parseAmount,
  parseDateOnly,
  parseNonEmptyString,
  parsePositiveInt,
  resolveMoneyContext,
  toDateOnly,
} from '../money.access';
import { writeMoneyAudit } from '../money.audit';
import { computePocketBalance, computePocketBalances } from '../money.balance';
import { AUDIT_ENTITY_TYPES } from '../money.constants';
import type {
  MoneyBalancingCheckItemDto,
  MoneyBalancingPocketDto,
  MoneyTransactionDto,
} from '../money.types';
import { pocketsRepository } from '../pockets/pockets.repository';
import { transactionsRepository } from '../transactions/transactions.repository';

export class BalancingService {
  async list(
    authPersonId: number,
    familyId: number,
  ): Promise<MoneyBalancingPocketDto[]> {
    const ctx = await resolveMoneyContext(authPersonId, familyId);
    const pockets = await pocketsRepository.list(ctx.workspace.id, {});
    const accounts = await pocketsRepository.findAccountsByIds(
      ctx.workspace.id,
      [...new Set(pockets.map((p) => p.account_id))],
    );
    const accountMap = new Map(accounts.map((a) => [a.id, a]));
    const balances = await computePocketBalances(pockets.map((p) => p.id));

    return pockets.map((p) => ({
      pocketId: p.id,
      name: p.name,
      accountName: accountMap.get(p.account_id)?.name ?? '',
      ownerPersonId: p.owner_person_id,
      recordedBalance: balances.get(p.id) ?? 0,
    }));
  }

  async check(
    authPersonId: number,
    familyId: number,
    body: unknown,
  ): Promise<{ items: MoneyBalancingCheckItemDto[] }> {
    const ctx = await resolveMoneyContext(authPersonId, familyId);
    const items = this.parseCheckItems(body);
    const results: MoneyBalancingCheckItemDto[] = [];

    for (const item of items) {
      const pocket = await pocketsRepository.findById(ctx.workspace.id, item.pocketId);
      if (!pocket || pocket.archived_at) {
        throw new AppError(
          404,
          ErrorCodes.MONEY_POCKET_NOT_FOUND,
          `Pocket ${item.pocketId} tidak ditemukan.`,
        );
      }
      const recordedBalance = await computePocketBalance(item.pocketId);
      results.push({
        pocketId: item.pocketId,
        recordedBalance,
        actualBalance: item.actualBalance,
        diff: item.actualBalance - recordedBalance,
      });
    }

    return { items: results };
  }

  async adjust(
    authPersonId: number,
    familyId: number,
    body: unknown,
  ): Promise<MoneyTransactionDto> {
    const ctx = await resolveMoneyContext(authPersonId, familyId);
    if (!body || typeof body !== 'object') {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'Body tidak valid.');
    }
    const raw = body as Record<string, unknown>;
    const pocketId = parsePositiveInt(raw.pocketId, 'pocketId');
    const actualBalance = parseAmount(raw.actualBalance, 'actualBalance', {
      allowZero: true,
      allowNegative: true,
    });
    const note = parseNonEmptyString(raw.note, 'note', 500);

    const pocket = await pocketsRepository.findById(ctx.workspace.id, pocketId);
    if (!pocket || pocket.archived_at) {
      throw new AppError(
        404,
        ErrorCodes.MONEY_POCKET_NOT_FOUND,
        'Pocket tidak ditemukan atau sudah di-archive.',
      );
    }

    const recordedBalance = await computePocketBalance(pocketId);
    const diff = actualBalance - recordedBalance;

    if (diff === 0) {
      throw new AppError(
        422,
        ErrorCodes.VALIDATION_ERROR,
        'Tidak ada selisih untuk di-adjust (diff = 0).',
      );
    }

    const today = new Date().toISOString().slice(0, 10);
    const row = await transactionsRepository.create({
      workspaceId: ctx.workspace.id,
      pocketId,
      categoryId: null,
      type: 'adjustment',
      amount: diff,
      date: today,
      note,
      attachmentMediaId: null,
      createdByPersonId: ctx.actor.id,
    });

    const dto: MoneyTransactionDto = {
      id: Number(row.id),
      pocketId: row.pocket_id,
      categoryId: null,
      type: 'adjustment',
      amount: asNumber(row.amount) ?? diff,
      date: toDateOnly(row.date),
      note: row.note,
      attachmentMediaId: null,
      createdByPersonId: row.created_by_person_id,
      balanceAfter: await computePocketBalance(pocketId),
    };

    await writeMoneyAudit({
      workspaceId: ctx.workspace.id,
      actorPersonId: ctx.actor.id,
      action: 'create',
      entityType: AUDIT_ENTITY_TYPES.ADJUSTMENT,
      entityId: dto.id,
      after: dto,
    });

    return dto;
  }

  async openingBalances(
    authPersonId: number,
    familyId: number,
    body: unknown,
  ): Promise<{ items: MoneyTransactionDto[] }> {
    const ctx = await resolveMoneyContext(authPersonId, familyId);
    if (!body || typeof body !== 'object') {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'Body tidak valid.');
    }
    const raw = body as Record<string, unknown>;
    const date = parseDateOnly(raw.date, 'date');
    if (!Array.isArray(raw.items) || raw.items.length === 0) {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'items wajib diisi.');
    }

    const parsed = raw.items.map((item, index) => {
      if (!item || typeof item !== 'object') {
        throw new AppError(
          422,
          ErrorCodes.VALIDATION_ERROR,
          `items[${index}] tidak valid.`,
        );
      }
      const row = item as Record<string, unknown>;
      return {
        pocketId: parsePositiveInt(row.pocketId, `items[${index}].pocketId`),
        amount: parseAmount(row.amount, `items[${index}].amount`, { allowZero: true }),
      };
    });

    const pocketIds = parsed.map((p) => p.pocketId);
    if (new Set(pocketIds).size !== pocketIds.length) {
      throw new AppError(
        422,
        ErrorCodes.VALIDATION_ERROR,
        'pocketId dalam items harus unik.',
      );
    }

    const created = await db.transaction(async (trx: Knex.Transaction) => {
      const results: MoneyTransactionDto[] = [];
      for (const item of parsed) {
        const pocket = await pocketsRepository.findById(ctx.workspace.id, item.pocketId);
        if (!pocket || pocket.archived_at) {
          throw new AppError(
            404,
            ErrorCodes.MONEY_POCKET_NOT_FOUND,
            `Pocket ${item.pocketId} tidak ditemukan.`,
          );
        }

        const openingCount = await transactionsRepository.countOpeningForPocket(
          item.pocketId,
        );
        if (openingCount > 0) {
          throw new AppError(
            409,
            ErrorCodes.CONFLICT,
            `Pocket ${item.pocketId} sudah punya opening balance.`,
          );
        }

        const [id] = await trx(Tables.MONEY_TRANSACTIONS).insert({
          workspace_id: ctx.workspace.id,
          pocket_id: item.pocketId,
          category_id: null,
          type: 'opening_balance',
          amount: item.amount,
          date,
          note: 'Opening balance',
          attachment_media_id: null,
          created_by_person_id: ctx.actor.id,
        });

        const dto: MoneyTransactionDto = {
          id: Number(id),
          pocketId: item.pocketId,
          categoryId: null,
          type: 'opening_balance',
          amount: item.amount,
          date,
          note: 'Opening balance',
          attachmentMediaId: null,
          createdByPersonId: ctx.actor.id,
        };

        await writeMoneyAudit(
          {
            workspaceId: ctx.workspace.id,
            actorPersonId: ctx.actor.id,
            action: 'create',
            entityType: AUDIT_ENTITY_TYPES.TRANSACTION,
            entityId: dto.id,
            after: dto,
          },
          trx,
        );

        results.push(dto);
      }
      return results;
    });

    // Attach balanceAfter after commit
    for (const item of created) {
      item.balanceAfter = await computePocketBalance(item.pocketId);
    }

    return { items: created };
  }

  private parseCheckItems(body: unknown): Array<{ pocketId: number; actualBalance: number }> {
    if (!body || typeof body !== 'object') {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'Body tidak valid.');
    }
    const raw = body as Record<string, unknown>;
    if (!Array.isArray(raw.items) || raw.items.length === 0) {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'items wajib diisi.');
    }
    return raw.items.map((item, index) => {
      if (!item || typeof item !== 'object') {
        throw new AppError(
          422,
          ErrorCodes.VALIDATION_ERROR,
          `items[${index}] tidak valid.`,
        );
      }
      const row = item as Record<string, unknown>;
      return {
        pocketId: parsePositiveInt(row.pocketId, `items[${index}].pocketId`),
        actualBalance: parseAmount(row.actualBalance, `items[${index}].actualBalance`, {
          allowZero: true,
          allowNegative: true,
        }),
      };
    });
  }
}

export const balancingService = new BalancingService();
