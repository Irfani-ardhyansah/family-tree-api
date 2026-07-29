import { AppError } from '../../../shared/errors/AppError';
import { ErrorCodes } from '../../../shared/errors/errorCodes';
import {
  asNumber,
  parseAmount,
  parseDateOnly,
  parseEnum,
  parseOptionalString,
  parsePositiveInt,
  resolveMoneyContext,
  toDateOnly,
} from '../money.access';
import { writeMoneyAudit } from '../money.audit';
import { computePocketBalance } from '../money.balance';
import { AUDIT_ENTITY_TYPES, MONEY_TRANSFER_KINDS } from '../money.constants';
import { assertTransferKindAllowed } from '../money.helpers';
import type { MoneyTransferDto, MoneyTransferRow } from '../money.types';
import { pocketsRepository } from '../pockets/pockets.repository';
import { transfersRepository } from './transfers.repository';

function toDto(row: MoneyTransferRow): MoneyTransferDto {
  return {
    id: Number(row.id),
    kind: row.kind,
    fromPocketId: row.from_pocket_id,
    toPocketId: row.to_pocket_id,
    amount: asNumber(row.amount) ?? 0,
    date: toDateOnly(row.date),
    note: row.note,
    createdByPersonId: row.created_by_person_id,
  };
}

export class TransfersService {
  async getById(
    authPersonId: number,
    familyId: number,
    idRaw: string,
  ): Promise<MoneyTransferDto> {
    const ctx = await resolveMoneyContext(authPersonId, familyId);
    const id = parsePositiveInt(idRaw, 'id');
    const row = await transfersRepository.findById(ctx.workspace.id, id);
    if (!row) {
      throw new AppError(
        404,
        ErrorCodes.MONEY_TRANSFER_NOT_FOUND,
        'Transfer tidak ditemukan.',
      );
    }
    return toDto(row);
  }

  async create(
    authPersonId: number,
    familyId: number,
    body: unknown,
  ): Promise<MoneyTransferDto> {
    const ctx = await resolveMoneyContext(authPersonId, familyId);
    if (!body || typeof body !== 'object') {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'Body tidak valid.');
    }
    const raw = body as Record<string, unknown>;
    const kind = parseEnum(raw.kind, 'kind', MONEY_TRANSFER_KINDS);
    const fromPocketId = parsePositiveInt(raw.fromPocketId, 'fromPocketId');
    const toPocketId = parsePositiveInt(raw.toPocketId, 'toPocketId');
    const amount = parseAmount(raw.amount, 'amount');
    const date = parseDateOnly(raw.date, 'date');
    const note = parseOptionalString(raw.note, 'note', 500) ?? null;

    const from = await pocketsRepository.findById(ctx.workspace.id, fromPocketId);
    const to = await pocketsRepository.findById(ctx.workspace.id, toPocketId);
    if (!from || from.archived_at) {
      throw new AppError(
        404,
        ErrorCodes.MONEY_POCKET_NOT_FOUND,
        'Pocket sumber tidak ditemukan atau sudah di-archive.',
      );
    }
    if (!to || to.archived_at) {
      throw new AppError(
        404,
        ErrorCodes.MONEY_POCKET_NOT_FOUND,
        'Pocket tujuan tidak ditemukan atau sudah di-archive.',
      );
    }

    assertTransferKindAllowed(kind, ctx.workspace, from, to);

    const balance = await computePocketBalance(fromPocketId);
    if (balance < amount) {
      throw new AppError(
        422,
        ErrorCodes.INSUFFICIENT_BALANCE,
        'Saldo pocket sumber tidak mencukupi.',
      );
    }

    const row = await transfersRepository.create({
      workspaceId: ctx.workspace.id,
      kind,
      fromPocketId,
      toPocketId,
      amount,
      date,
      note,
      createdByPersonId: ctx.actor.id,
    });

    await writeMoneyAudit({
      workspaceId: ctx.workspace.id,
      actorPersonId: ctx.actor.id,
      action: 'create',
      entityType: AUDIT_ENTITY_TYPES.TRANSFER,
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
    const existing = await transfersRepository.findById(ctx.workspace.id, id);
    if (!existing) {
      throw new AppError(
        404,
        ErrorCodes.MONEY_TRANSFER_NOT_FOUND,
        'Transfer tidak ditemukan.',
      );
    }

    const before = toDto(existing);
    await transfersRepository.delete(ctx.workspace.id, id);

    await writeMoneyAudit({
      workspaceId: ctx.workspace.id,
      actorPersonId: ctx.actor.id,
      action: 'delete',
      entityType: AUDIT_ENTITY_TYPES.TRANSFER,
      entityId: id,
      before,
    });

    return { deleted: true };
  }
}

export const transfersService = new TransfersService();
