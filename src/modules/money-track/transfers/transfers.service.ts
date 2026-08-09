import { AppError } from '../../../shared/errors/AppError';
import { ErrorCodes } from '../../../shared/errors/errorCodes';
import {
  asNumber,
  parseAmount,
  parseDateOnly,
  parseEnum,
  parseOptionalDateOnly,
  parseOptionalString,
  parsePositiveInt,
  resolveMoneyContext,
  toDateOnly,
} from '../money.access';
import { writeMoneyAudit } from '../money.audit';
import { computePocketBalance } from '../money.balance';
import { AUDIT_ENTITY_TYPES, MONEY_TRANSFER_KINDS } from '../money.constants';
import { loadEnrichmentMaps, pocketLabel } from '../money.enrichment';
import { assertTransferKindAllowed } from '../money.helpers';
import type {
  MoneyTransferDto,
  MoneyTransferRow,
  MoneyWorkspaceRow,
} from '../money.types';
import { pocketsRepository } from '../pockets/pockets.repository';
import { transfersRepository } from './transfers.repository';

async function toDto(
  workspaceId: number,
  row: MoneyTransferRow,
): Promise<MoneyTransferDto> {
  const maps = await loadEnrichmentMaps(
    workspaceId,
    [row.from_pocket_id, row.to_pocket_id],
    [],
  );
  return {
    id: Number(row.id),
    kind: row.kind,
    fromPocketId: row.from_pocket_id,
    toPocketId: row.to_pocket_id,
    fromPocketLabel: pocketLabel(row.from_pocket_id, maps) || null,
    toPocketLabel: pocketLabel(row.to_pocket_id, maps) || null,
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
    return toDto(ctx.workspace.id, row);
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

    await this.assertPocketsAndBalance(
      ctx.workspace,
      kind,
      fromPocketId,
      toPocketId,
      amount,
      null,
    );

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

    const after = await toDto(ctx.workspace.id, row);
    await writeMoneyAudit({
      workspaceId: ctx.workspace.id,
      actorPersonId: ctx.actor.id,
      action: 'create',
      entityType: AUDIT_ENTITY_TYPES.TRANSFER,
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
  ): Promise<MoneyTransferDto> {
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
    if (!body || typeof body !== 'object') {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'Body tidak valid.');
    }
    const raw = body as Record<string, unknown>;

    const kind =
      raw.kind !== undefined
        ? parseEnum(raw.kind, 'kind', MONEY_TRANSFER_KINDS)
        : existing.kind;
    const fromPocketId =
      raw.fromPocketId !== undefined
        ? parsePositiveInt(raw.fromPocketId, 'fromPocketId')
        : existing.from_pocket_id;
    const toPocketId =
      raw.toPocketId !== undefined
        ? parsePositiveInt(raw.toPocketId, 'toPocketId')
        : existing.to_pocket_id;
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

    const unchanged =
      kind === existing.kind &&
      fromPocketId === existing.from_pocket_id &&
      toPocketId === existing.to_pocket_id &&
      amount === (asNumber(existing.amount) ?? 0) &&
      date === toDateOnly(existing.date) &&
      note === existing.note;
    if (unchanged) {
      return toDto(ctx.workspace.id, existing);
    }

    await this.assertPocketsAndBalance(
      ctx.workspace,
      kind,
      fromPocketId,
      toPocketId,
      amount,
      existing,
    );

    const before = await toDto(ctx.workspace.id, existing);
    await transfersRepository.update(ctx.workspace.id, id, {
      kind,
      from_pocket_id: fromPocketId,
      to_pocket_id: toPocketId,
      amount,
      date,
      note,
    });
    const updated = (await transfersRepository.findById(ctx.workspace.id, id))!;
    const after = await toDto(ctx.workspace.id, updated);

    await writeMoneyAudit({
      workspaceId: ctx.workspace.id,
      actorPersonId: ctx.actor.id,
      action: 'update',
      entityType: AUDIT_ENTITY_TYPES.TRANSFER,
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
    const existing = await transfersRepository.findById(ctx.workspace.id, id);
    if (!existing) {
      throw new AppError(
        404,
        ErrorCodes.MONEY_TRANSFER_NOT_FOUND,
        'Transfer tidak ditemukan.',
      );
    }

    const before = await toDto(ctx.workspace.id, existing);
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

  private async assertPocketsAndBalance(
    workspace: MoneyWorkspaceRow,
    kind: 'interpersonal' | 'interpocket',
    fromPocketId: number,
    toPocketId: number,
    amount: number,
    existing: MoneyTransferRow | null,
  ): Promise<void> {
    const from = await pocketsRepository.findById(workspace.id, fromPocketId);
    const to = await pocketsRepository.findById(workspace.id, toPocketId);
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

    assertTransferKindAllowed(kind, workspace, from, to);

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
  }
}

export const transfersService = new TransfersService();
