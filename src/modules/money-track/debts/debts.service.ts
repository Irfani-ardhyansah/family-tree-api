import { AppError } from '../../../shared/errors/AppError';
import { ErrorCodes } from '../../../shared/errors/errorCodes';
import { moneyAccessRepository } from '../money-access.repository';
import {
  asNumber,
  parseAmount,
  parseDateOnly,
  parseEnum,
  parseNonEmptyString,
  parseOptionalDateOnly,
  parseOptionalEnum,
  parseOptionalPositiveInt,
  parseOptionalString,
  parsePositiveInt,
  resolveMoneyContext,
  toDateOnly,
} from '../money.access';
import { formatAuditRp, writeMoneyAudit } from '../money.audit';
import { computePocketBalance } from '../money.balance';
import {
  AUDIT_ENTITY_TYPES,
  MONEY_DEBT_DIRECTIONS,
  MONEY_DEBT_STATUSES,
} from '../money.constants';
import { loadEnrichmentMaps, pocketLabel } from '../money.enrichment';
import {
  debtInterestAmount,
  debtNetEffect,
  debtPaymentInterestPortion,
  debtRemaining,
  debtStatusFromPaid,
} from '../money.helpers';
import type {
  MoneyDebtBalanceWarning,
  MoneyDebtDto,
  MoneyDebtPaymentDto,
  MoneyDebtRow,
} from '../money.types';
import { pocketsRepository } from '../pockets/pockets.repository';
import { debtsRepository } from './debts.repository';

function paymentDto(row: {
  id: number;
  amount: number | string;
  date: string;
  note: string | null;
  created_by_person_id: number;
}): MoneyDebtPaymentDto {
  return {
    id: Number(row.id),
    amount: asNumber(row.amount) ?? 0,
    date: toDateOnly(row.date),
    note: row.note,
    createdByPersonId: row.created_by_person_id,
  };
}

function toListDto(row: MoneyDebtRow, paidTotal: number): MoneyDebtDto {
  const amount = asNumber(row.amount) ?? 0;
  const isPiutang = row.direction === 'piutang';
  return {
    id: row.id,
    personId: row.person_id,
    counterpartyName: row.counterparty_name,
    direction: row.direction,
    directionLabel: isPiutang ? 'Piutang' : 'Utang',
    amount,
    date: toDateOnly(row.date),
    dueDate: row.due_date ? toDateOnly(row.due_date) : null,
    status: row.status,
    note: row.note,
    paidTotal,
    remaining: debtRemaining(amount, paidTotal),
    remainingLabel: isPiutang ? 'Sisa piutang' : 'Sisa utang',
    pocketId: row.pocket_id,
    pocketLabel: null,
    netEffect: debtNetEffect(row.direction, amount, paidTotal),
    interestAmount: debtInterestAmount(amount, paidTotal),
  };
}

export class DebtsService {
  async list(
    authPersonId: number,
    familyId: number,
    query: Record<string, unknown>,
  ): Promise<MoneyDebtDto[]> {
    const ctx = await resolveMoneyContext(authPersonId, familyId);
    const status = parseOptionalEnum(query.status, 'status', MONEY_DEBT_STATUSES);
    const direction = parseOptionalEnum(query.direction, 'direction', MONEY_DEBT_DIRECTIONS);
    const pocketId = parseOptionalPositiveInt(query.pocketId, 'pocketId') ?? undefined;
    const rows = await debtsRepository.list(ctx.workspace.id, {
      status,
      direction,
      pocketId,
    });
    const [paidTotals, pocketLabels] = await Promise.all([
      Promise.all(rows.map((row) => debtsRepository.sumPayments(row.id))),
      this.loadPocketLabels(ctx.workspace.id, rows),
    ]);
    return rows.map((row, index) => ({
      ...toListDto(row, paidTotals[index] ?? 0),
      pocketLabel: pocketLabels.get(row.id) ?? null,
    }));
  }

  async getById(
    authPersonId: number,
    familyId: number,
    idRaw: string,
  ): Promise<MoneyDebtDto> {
    const ctx = await resolveMoneyContext(authPersonId, familyId);
    const id = parsePositiveInt(idRaw, 'id');
    const row = await debtsRepository.findById(ctx.workspace.id, id);
    if (!row) {
      throw new AppError(404, ErrorCodes.MONEY_DEBT_NOT_FOUND, 'Debt tidak ditemukan.');
    }
    const amount = asNumber(row.amount) ?? 0;
    const payments = await debtsRepository.listPayments(id);
    const paidTotal = payments.reduce((s, p) => s + (asNumber(p.amount) ?? 0), 0);

    // Porsi bunga per pembayaran dihitung running dari pembayaran paling awal.
    let runningPaid = 0;
    const paymentDtos: MoneyDebtPaymentDto[] = payments.map((p) => {
      const paymentAmount = asNumber(p.amount) ?? 0;
      const dto: MoneyDebtPaymentDto = {
        ...paymentDto(p),
        interestAmount: debtPaymentInterestPortion(amount, runningPaid, paymentAmount),
      };
      runningPaid += paymentAmount;
      return dto;
    });

    const pocketLabels = await this.loadPocketLabels(ctx.workspace.id, [row]);
    return {
      ...toListDto(row, paidTotal),
      pocketLabel: pocketLabels.get(row.id) ?? null,
      payments: paymentDtos,
    };
  }

  async create(
    authPersonId: number,
    familyId: number,
    body: unknown,
  ): Promise<MoneyDebtDto> {
    const ctx = await resolveMoneyContext(authPersonId, familyId);
    if (!body || typeof body !== 'object') {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'Body tidak valid.');
    }
    const raw = body as Record<string, unknown>;
    const personId = parsePositiveInt(raw.personId, 'personId');
    const person = await moneyAccessRepository.findPersonById(ctx.workspace.id, personId);
    if (!person) {
      throw new AppError(404, ErrorCodes.MONEY_PERSON_NOT_FOUND, 'Person tidak ditemukan.');
    }

    // Kantong opsional: null berarti catatan saja (tidak mengubah saldo).
    const pocketId = parseOptionalPositiveInt(raw.pocketId, 'pocketId') ?? null;
    if (pocketId != null) {
      await this.assertPocketLinkable(ctx.workspace.id, pocketId);
    }

    const row = await debtsRepository.create({
      workspaceId: ctx.workspace.id,
      personId,
      pocketId,
      counterpartyName: parseNonEmptyString(raw.counterpartyName, 'counterpartyName', 120),
      direction: parseEnum(raw.direction, 'direction', MONEY_DEBT_DIRECTIONS),
      amount: parseAmount(raw.amount, 'amount'),
      date: parseDateOnly(raw.date, 'date'),
      dueDate: parseOptionalDateOnly(raw.dueDate, 'dueDate') ?? null,
      note: parseOptionalString(raw.note, 'note', 500) ?? null,
    });

    const pocketLabels = await this.loadPocketLabels(ctx.workspace.id, [row]);
    const balanceWarning = await this.buildBalanceWarning(ctx.workspace.id, pocketId);
    const dto = toListDto(row, 0);
    dto.pocketLabel = pocketLabels.get(row.id) ?? null;
    dto.balanceWarning = balanceWarning;
    await writeMoneyAudit({
      workspaceId: ctx.workspace.id,
      actorPersonId: ctx.actor.id,
      action: 'create',
      entityType: AUDIT_ENTITY_TYPES.DEBT,
      entityId: row.id,
      summary: `Catat ${dto.directionLabel.toLowerCase()} ${row.counterparty_name} ${formatAuditRp(asNumber(row.amount) ?? 0)}`,
      after: dto,
    });

    return dto;
  }

  async update(
    authPersonId: number,
    familyId: number,
    idRaw: string,
    body: unknown,
  ): Promise<MoneyDebtDto> {
    const ctx = await resolveMoneyContext(authPersonId, familyId);
    const id = parsePositiveInt(idRaw, 'id');
    const existing = await debtsRepository.findById(ctx.workspace.id, id);
    if (!existing) {
      throw new AppError(404, ErrorCodes.MONEY_DEBT_NOT_FOUND, 'Debt tidak ditemukan.');
    }
    if (!body || typeof body !== 'object') {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'Body tidak valid.');
    }
    const raw = body as Record<string, unknown>;
    const patch: Parameters<typeof debtsRepository.update>[2] = {};

    if (raw.personId !== undefined) {
      const personId = parsePositiveInt(raw.personId, 'personId');
      const person = await moneyAccessRepository.findPersonById(ctx.workspace.id, personId);
      if (!person) {
        throw new AppError(404, ErrorCodes.MONEY_PERSON_NOT_FOUND, 'Person tidak ditemukan.');
      }
      patch.person_id = personId;
    }
    if (raw.counterpartyName !== undefined) {
      patch.counterparty_name = parseNonEmptyString(
        raw.counterpartyName,
        'counterpartyName',
        120,
      );
    }
    if (raw.direction !== undefined) {
      patch.direction = parseEnum(raw.direction, 'direction', MONEY_DEBT_DIRECTIONS);
    }
    if (raw.amount !== undefined) {
      patch.amount = parseAmount(raw.amount, 'amount');
    }
    if (raw.date !== undefined) {
      patch.date = parseDateOnly(raw.date, 'date');
    }
    if (raw.dueDate !== undefined) {
      patch.due_date = parseOptionalDateOnly(raw.dueDate, 'dueDate') ?? null;
    }
    if (raw.note !== undefined) {
      patch.note = parseOptionalString(raw.note, 'note', 500) ?? null;
    }
    // pocketId: null = lepas link dari kantong (jadi catatan saja).
    if (raw.pocketId !== undefined) {
      const pocketId = parseOptionalPositiveInt(raw.pocketId, 'pocketId') ?? null;
      if (pocketId != null) {
        await this.assertPocketLinkable(ctx.workspace.id, pocketId);
      }
      patch.pocket_id = pocketId;
    }

    if (Object.keys(patch).length > 0) {
      await debtsRepository.update(ctx.workspace.id, id, patch);
    }

    const amount = patch.amount ?? (asNumber(existing.amount) ?? 0);
    const paidTotal = await debtsRepository.sumPayments(id);
    const status = debtStatusFromPaid(amount, paidTotal);
    if (status !== existing.status) {
      await debtsRepository.update(ctx.workspace.id, id, { status });
    }

    const updated = await this.getById(authPersonId, familyId, idRaw);
    updated.balanceWarning = await this.buildBalanceWarning(
      ctx.workspace.id,
      updated.pocketId,
    );
    if (Object.keys(patch).length > 0) {
      await writeMoneyAudit({
        workspaceId: ctx.workspace.id,
        actorPersonId: ctx.actor.id,
        action: 'update',
        entityType: AUDIT_ENTITY_TYPES.DEBT,
        entityId: id,
        summary: `Ubah ${updated.directionLabel.toLowerCase()} ${updated.counterpartyName} ${formatAuditRp(updated.amount)}`,
        before: toListDto(existing, paidTotal),
        after: updated,
      });
    }
    return updated;
  }

  async remove(
    authPersonId: number,
    familyId: number,
    idRaw: string,
  ): Promise<{ deleted: true }> {
    const ctx = await resolveMoneyContext(authPersonId, familyId);
    const id = parsePositiveInt(idRaw, 'id');
    const existing = await debtsRepository.findById(ctx.workspace.id, id);
    if (!existing) {
      throw new AppError(404, ErrorCodes.MONEY_DEBT_NOT_FOUND, 'Debt tidak ditemukan.');
    }
    const paidTotal = await debtsRepository.sumPayments(id);
    const before = toListDto(existing, paidTotal);
    await debtsRepository.delete(ctx.workspace.id, id);
    await writeMoneyAudit({
      workspaceId: ctx.workspace.id,
      actorPersonId: ctx.actor.id,
      action: 'delete',
      entityType: AUDIT_ENTITY_TYPES.DEBT,
      entityId: id,
      summary: `Hapus ${before.directionLabel.toLowerCase()} ${before.counterpartyName} ${formatAuditRp(before.amount)}`,
      before,
    });
    return { deleted: true };
  }

  async addPayment(
    authPersonId: number,
    familyId: number,
    idRaw: string,
    body: unknown,
  ): Promise<MoneyDebtDto> {
    const ctx = await resolveMoneyContext(authPersonId, familyId);
    const id = parsePositiveInt(idRaw, 'id');
    const debt = await debtsRepository.findById(ctx.workspace.id, id);
    if (!debt) {
      throw new AppError(404, ErrorCodes.MONEY_DEBT_NOT_FOUND, 'Debt tidak ditemukan.');
    }
    if (!body || typeof body !== 'object') {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'Body tidak valid.');
    }
    const raw = body as Record<string, unknown>;
    const amount = parseAmount(raw.amount, 'amount');
    const date = parseDateOnly(raw.date, 'date');
    const note = parseOptionalString(raw.note, 'note', 500) ?? null;

    const paidTotal = await debtsRepository.sumPayments(id);
    const debtAmount = asNumber(debt.amount) ?? 0;

    // Overpay diizinkan: kelebihan bayar dihitung sebagai bunga (bisa bikin netEffect minus).
    const interestPortion = debtPaymentInterestPortion(debtAmount, paidTotal, amount);

    const payment = await debtsRepository.createPayment({
      workspaceId: ctx.workspace.id,
      debtId: id,
      amount,
      date,
      note,
      createdByPersonId: ctx.actor.id,
    });

    const newPaid = paidTotal + amount;
    const status = debtStatusFromPaid(debtAmount, newPaid);
    await debtsRepository.update(ctx.workspace.id, id, { status });

    await writeMoneyAudit({
      workspaceId: ctx.workspace.id,
      actorPersonId: ctx.actor.id,
      action: 'create',
      entityType: AUDIT_ENTITY_TYPES.DEBT_PAYMENT,
      entityId: Number(payment.id),
      summary: `Catat pembayaran ${debt.counterparty_name} ${formatAuditRp(amount)}`,
      after: { ...paymentDto(payment), interestAmount: interestPortion },
    });

    const updated = await this.getById(authPersonId, familyId, idRaw);
    updated.balanceWarning = await this.buildBalanceWarning(
      ctx.workspace.id,
      updated.pocketId,
    );
    return updated;
  }

  /** Map debtId → label kantong ("Transaksi · BCA"). Debt tanpa kantong tidak masuk map. */
  private async loadPocketLabels(
    workspaceId: number,
    rows: MoneyDebtRow[],
  ): Promise<Map<number, string>> {
    const out = new Map<number, string>();
    const pocketIds = rows
      .map((row) => row.pocket_id)
      .filter((id): id is number => id != null);
    if (pocketIds.length === 0) return out;

    const maps = await loadEnrichmentMaps(workspaceId, pocketIds, []);
    for (const row of rows) {
      if (row.pocket_id == null) continue;
      const label = pocketLabel(row.pocket_id, maps);
      if (label) out.set(row.id, label);
    }
    return out;
  }

  /** Pocket link wajib milik workspace & belum di-archive. */
  private async assertPocketLinkable(
    workspaceId: number,
    pocketId: number,
  ): Promise<void> {
    const pocket = await pocketsRepository.findById(workspaceId, pocketId);
    if (!pocket || pocket.archived_at) {
      throw new AppError(
        404,
        ErrorCodes.MONEY_POCKET_NOT_FOUND,
        'Pocket tidak ditemukan atau sudah di-archive.',
      );
    }
  }

  /**
   * Peringatan (bukan error) kalau saldo kantong jadi minus setelah mutasi.
   * Dipakai FE untuk pop-up notifikasi — aplikasi ini pencatatan, jadi tidak diblokir.
   */
  private async buildBalanceWarning(
    workspaceId: number,
    pocketId: number | null,
  ): Promise<MoneyDebtBalanceWarning | null> {
    if (pocketId == null) return null;
    const [balance, maps] = await Promise.all([
      computePocketBalance(pocketId),
      loadEnrichmentMaps(workspaceId, [pocketId], []),
    ]);
    if (balance >= 0) return null;

    const label = pocketLabel(pocketId, maps) || `Pocket ${pocketId}`;
    return {
      isNegative: true,
      pocketId,
      pocketLabel: label,
      pocketBalanceAfter: balance,
      shortfall: Math.abs(balance),
      message: `Saldo kantong ${label} minus (${formatAuditRp(Math.abs(balance))}). Mohon sesuaikan kantongnya di menu Balancing.`,
    };
  }
}

export const debtsService = new DebtsService();
