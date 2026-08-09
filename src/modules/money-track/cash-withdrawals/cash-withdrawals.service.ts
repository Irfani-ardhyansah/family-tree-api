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
import { loadEnrichmentMaps, pocketLabel } from '../money.enrichment';
import type {
  MoneyCashWithdrawalDto,
  MoneyCashWithdrawalRow,
  MoneyPaginated,
} from '../money.types';
import { accountsRepository } from '../accounts/accounts.repository';
import { pocketsRepository } from '../pockets/pockets.repository';
import { cashWithdrawalsRepository } from './cash-withdrawals.repository';

async function toDto(
  workspaceId: number,
  row: MoneyCashWithdrawalRow,
): Promise<MoneyCashWithdrawalDto> {
  const maps = await loadEnrichmentMaps(
    workspaceId,
    [row.from_pocket_id, row.to_cash_pocket_id],
    [],
  );
  return {
    id: Number(row.id),
    fromAccountId: row.from_account_id,
    fromPocketId: row.from_pocket_id,
    toCashAccountId: row.to_cash_account_id,
    toCashPocketId: row.to_cash_pocket_id,
    fromPocketLabel: pocketLabel(row.from_pocket_id, maps) || null,
    toPocketLabel: pocketLabel(row.to_cash_pocket_id, maps) || 'Cash',
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

    const items = await Promise.all(rows.map((row) => toDto(ctx.workspace.id, row)));
    return { items, page, pageSize, total };
  }

  async getById(
    authPersonId: number,
    familyId: number,
    idRaw: string,
  ): Promise<MoneyCashWithdrawalDto> {
    const ctx = await resolveMoneyContext(authPersonId, familyId);
    const id = parsePositiveInt(idRaw, 'id');
    const row = await cashWithdrawalsRepository.findById(ctx.workspace.id, id);
    if (!row) {
      throw new AppError(
        404,
        ErrorCodes.MONEY_CASH_WITHDRAWAL_NOT_FOUND,
        'Cash withdrawal tidak ditemukan.',
      );
    }
    return toDto(ctx.workspace.id, row);
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

    const resolved = await this.resolveCashTargets(
      ctx.workspace.id,
      fromAccountId,
      fromPocketId,
      amount,
      null,
    );

    const row = await cashWithdrawalsRepository.create({
      workspaceId: ctx.workspace.id,
      fromAccountId,
      fromPocketId,
      toCashAccountId: resolved.toCashAccountId,
      toCashPocketId: resolved.toCashPocketId,
      amount,
      date,
      note,
      attachmentMediaId,
      createdByPersonId: ctx.actor.id,
    });

    const after = await toDto(ctx.workspace.id, row);
    await writeMoneyAudit({
      workspaceId: ctx.workspace.id,
      actorPersonId: ctx.actor.id,
      action: 'create',
      entityType: AUDIT_ENTITY_TYPES.CASH_WITHDRAWAL,
      entityId: Number(row.id),
      after,
    });

    return after;
  }

  async update(
    authPersonId: number,
    familyId: number,
    idRaw: string,
    body: unknown,
  ): Promise<MoneyCashWithdrawalDto> {
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
    if (!body || typeof body !== 'object') {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'Body tidak valid.');
    }
    const raw = body as Record<string, unknown>;

    if (raw.toCashAccountId !== undefined || raw.toCashPocketId !== undefined) {
      throw new AppError(
        422,
        ErrorCodes.VALIDATION_ERROR,
        'toCashAccountId/toCashPocketId dihitung otomatis dari pemilik account sumber.',
      );
    }

    const fromAccountId =
      raw.fromAccountId !== undefined
        ? parsePositiveInt(raw.fromAccountId, 'fromAccountId')
        : existing.from_account_id;
    const fromPocketId =
      raw.fromPocketId !== undefined
        ? parsePositiveInt(raw.fromPocketId, 'fromPocketId')
        : existing.from_pocket_id;
    const amount =
      raw.amount !== undefined
        ? parseAmount(raw.amount, 'amount')
        : (asNumber(existing.amount) ?? 0);

    let date = toDateOnly(existing.date);
    if (raw.date !== undefined) {
      const parsed = parseOptionalDateOnly(raw.date, 'date');
      if (parsed == null) {
        throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'date wajib format YYYY-MM-DD.');
      }
      date = parsed;
    }

    let note = existing.note;
    if (raw.note !== undefined) {
      note = parseOptionalString(raw.note, 'note', 500) ?? null;
    }

    let attachmentMediaId = existing.attachment_media_id;
    if (raw.attachmentMediaId !== undefined) {
      if (raw.attachmentMediaId === null || raw.attachmentMediaId === '') {
        attachmentMediaId = null;
      } else if (typeof raw.attachmentMediaId === 'string') {
        attachmentMediaId = raw.attachmentMediaId;
      } else {
        throw new AppError(
          422,
          ErrorCodes.VALIDATION_ERROR,
          'attachmentMediaId harus string.',
        );
      }
    }

    const resolved = await this.resolveCashTargets(
      ctx.workspace.id,
      fromAccountId,
      fromPocketId,
      amount,
      existing,
    );

    const before = await toDto(ctx.workspace.id, existing);
    await cashWithdrawalsRepository.update(ctx.workspace.id, id, {
      from_account_id: fromAccountId,
      from_pocket_id: fromPocketId,
      to_cash_account_id: resolved.toCashAccountId,
      to_cash_pocket_id: resolved.toCashPocketId,
      amount,
      date,
      note,
      attachment_media_id: attachmentMediaId,
    });
    const updated = (await cashWithdrawalsRepository.findById(ctx.workspace.id, id))!;
    const after = await toDto(ctx.workspace.id, updated);

    await writeMoneyAudit({
      workspaceId: ctx.workspace.id,
      actorPersonId: ctx.actor.id,
      action: 'update',
      entityType: AUDIT_ENTITY_TYPES.CASH_WITHDRAWAL,
      entityId: id,
      before,
      after,
    });

    return after;
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

    const before = await toDto(ctx.workspace.id, existing);
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

  private async resolveCashTargets(
    workspaceId: number,
    fromAccountId: number,
    fromPocketId: number,
    amount: number,
    existing: MoneyCashWithdrawalRow | null,
  ): Promise<{ toCashAccountId: number; toCashPocketId: number }> {
    const fromAccount = await accountsRepository.findById(workspaceId, fromAccountId);
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

    const fromPocket = await pocketsRepository.findById(workspaceId, fromPocketId);
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
      workspaceId,
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
      workspaceId,
      cashAccount.id,
    );
    if (!tunaiPocket) {
      throw new AppError(
        404,
        ErrorCodes.MONEY_POCKET_NOT_FOUND,
        'Pocket Tunai tidak ditemukan.',
      );
    }

    const currentBalance = await computePocketBalance(fromPocketId);
    const creditBack =
      existing && existing.from_pocket_id === fromPocketId
        ? (asNumber(existing.amount) ?? 0)
        : 0;
    if (currentBalance + creditBack < amount) {
      throw new AppError(
        422,
        ErrorCodes.INSUFFICIENT_BALANCE,
        'Saldo pocket sumber tidak mencukupi.',
      );
    }

    return {
      toCashAccountId: cashAccount.id,
      toCashPocketId: tunaiPocket.id,
    };
  }
}

export const cashWithdrawalsService = new CashWithdrawalsService();
