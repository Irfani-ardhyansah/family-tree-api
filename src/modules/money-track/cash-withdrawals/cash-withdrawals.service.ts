import { AppError } from '../../../shared/errors/AppError';
import { ErrorCodes } from '../../../shared/errors/errorCodes';
import {
  asNumber,
  parseAmount,
  parseDateOnly,
  parseOptionalDateOnly,
  parseOptionalString,
  parsePage,
  parsePositiveInt,
  resolveMoneyContext,
  toDateOnly,
} from '../money.access';
import { writeMoneyAudit } from '../money.audit';
import { computePocketBalance } from '../money.balance';
import { AUDIT_ENTITY_TYPES } from '../money.constants';
import type {
  MoneyCashWithdrawalDto,
  MoneyCashWithdrawalRow,
  MoneyPaginated,
} from '../money.types';
import { accountsRepository } from '../accounts/accounts.repository';
import { pocketsRepository } from '../pockets/pockets.repository';
import { cashWithdrawalsRepository } from './cash-withdrawals.repository';

function toDto(row: MoneyCashWithdrawalRow): MoneyCashWithdrawalDto {
  return {
    id: Number(row.id),
    fromAccountId: row.from_account_id,
    fromPocketId: row.from_pocket_id,
    toCashAccountId: row.to_cash_account_id,
    toCashPocketId: row.to_cash_pocket_id,
    amount: asNumber(row.amount) ?? 0,
    date: toDateOnly(row.date),
    note: row.note,
    attachmentMediaId: row.attachment_media_id,
    createdByPersonId: row.created_by_person_id,
  };
}

export class CashWithdrawalsService {
  async list(
    authPersonId: number,
    familyId: number,
    query: Record<string, unknown>,
  ): Promise<MoneyPaginated<MoneyCashWithdrawalDto>> {
    const ctx = await resolveMoneyContext(authPersonId, familyId);
    const { page, pageSize } = parsePage(query);
    const from = parseOptionalDateOnly(query.from, 'from') ?? undefined;
    const to = parseOptionalDateOnly(query.to, 'to') ?? undefined;
    const filters = { from, to, page, pageSize };

    const [total, rows] = await Promise.all([
      cashWithdrawalsRepository.count(ctx.workspace.id, filters),
      cashWithdrawalsRepository.list(ctx.workspace.id, filters),
    ]);

    return { items: rows.map(toDto), page, pageSize, total };
  }

  async create(
    authPersonId: number,
    familyId: number,
    body: unknown,
  ): Promise<MoneyCashWithdrawalDto> {
    const ctx = await resolveMoneyContext(authPersonId, familyId);
    if (!body || typeof body !== 'object') {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'Body tidak valid.');
    }
    const raw = body as Record<string, unknown>;
    const fromAccountId = parsePositiveInt(raw.fromAccountId, 'fromAccountId');
    const fromPocketId = parsePositiveInt(raw.fromPocketId, 'fromPocketId');
    const amount = parseAmount(raw.amount, 'amount');
    const date = parseDateOnly(raw.date, 'date');
    const note = parseOptionalString(raw.note, 'note', 500) ?? null;

    let attachmentMediaId: string | null = null;
    if (raw.attachmentMediaId !== undefined && raw.attachmentMediaId !== null) {
      if (typeof raw.attachmentMediaId !== 'string') {
        throw new AppError(
          422,
          ErrorCodes.VALIDATION_ERROR,
          'attachmentMediaId harus string.',
        );
      }
      attachmentMediaId = raw.attachmentMediaId || null;
    }

    const fromAccount = await accountsRepository.findById(ctx.workspace.id, fromAccountId);
    if (!fromAccount) {
      throw new AppError(404, ErrorCodes.MONEY_ACCOUNT_NOT_FOUND, 'Account sumber tidak ditemukan.');
    }
    if (fromAccount.type === 'cash') {
      throw new AppError(
        422,
        ErrorCodes.VALIDATION_ERROR,
        'Tidak dapat tarik tunai dari account cash.',
      );
    }

    const fromPocket = await pocketsRepository.findById(ctx.workspace.id, fromPocketId);
    if (!fromPocket || fromPocket.archived_at) {
      throw new AppError(
        404,
        ErrorCodes.MONEY_POCKET_NOT_FOUND,
        'Pocket sumber tidak ditemukan atau sudah di-archive.',
      );
    }
    if (fromPocket.account_id !== fromAccountId) {
      throw new AppError(
        422,
        ErrorCodes.VALIDATION_ERROR,
        'fromPocketId harus milik fromAccountId.',
      );
    }

    const cashAccount = await cashWithdrawalsRepository.findCashAccountForPerson(
      ctx.workspace.id,
      fromAccount.person_id,
    );
    if (!cashAccount) {
      throw new AppError(
        404,
        ErrorCodes.MONEY_ACCOUNT_NOT_FOUND,
        'Account cash pemilik tidak ditemukan.',
      );
    }
    const tunaiPocket = await cashWithdrawalsRepository.findTunaiPocket(
      ctx.workspace.id,
      cashAccount.id,
    );
    if (!tunaiPocket) {
      throw new AppError(
        404,
        ErrorCodes.MONEY_POCKET_NOT_FOUND,
        'Pocket Tunai tidak ditemukan.',
      );
    }

    const balance = await computePocketBalance(fromPocketId);
    if (balance < amount) {
      throw new AppError(
        422,
        ErrorCodes.INSUFFICIENT_BALANCE,
        'Saldo pocket sumber tidak mencukupi.',
      );
    }

    const row = await cashWithdrawalsRepository.create({
      workspaceId: ctx.workspace.id,
      fromAccountId,
      fromPocketId,
      toCashAccountId: cashAccount.id,
      toCashPocketId: tunaiPocket.id,
      amount,
      date,
      note,
      attachmentMediaId,
      createdByPersonId: ctx.actor.id,
    });

    await writeMoneyAudit({
      workspaceId: ctx.workspace.id,
      actorPersonId: ctx.actor.id,
      action: 'create',
      entityType: AUDIT_ENTITY_TYPES.CASH_WITHDRAWAL,
      entityId: Number(row.id),
      after: toDto(row),
    });

    return toDto(row);
  }

  async remove(
    authPersonId: number,
    familyId: number,
    idRaw: string,
  ): Promise<{ deleted: true }> {
    const ctx = await resolveMoneyContext(authPersonId, familyId);
    const id = parsePositiveInt(idRaw, 'id');
    const existing = await cashWithdrawalsRepository.findById(ctx.workspace.id, id);
    if (!existing) {
      throw new AppError(
        404,
        ErrorCodes.MONEY_CASH_WITHDRAWAL_NOT_FOUND,
        'Cash withdrawal tidak ditemukan.',
      );
    }

    const before = toDto(existing);
    await cashWithdrawalsRepository.delete(ctx.workspace.id, id);

    await writeMoneyAudit({
      workspaceId: ctx.workspace.id,
      actorPersonId: ctx.actor.id,
      action: 'delete',
      entityType: AUDIT_ENTITY_TYPES.CASH_WITHDRAWAL,
      entityId: id,
      before,
    });

    return { deleted: true };
  }
}

export const cashWithdrawalsService = new CashWithdrawalsService();
