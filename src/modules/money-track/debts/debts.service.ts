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
  parseOptionalString,
  parsePositiveInt,
  resolveMoneyContext,
  toDateOnly,
} from '../money.access';
import { writeMoneyAudit } from '../money.audit';
import {
  AUDIT_ENTITY_TYPES,
  MONEY_DEBT_DIRECTIONS,
  MONEY_DEBT_STATUSES,
  type MoneyDebtStatus,
} from '../money.constants';
import type {
  MoneyDebtDto,
  MoneyDebtPaymentDto,
  MoneyDebtRow,
} from '../money.types';
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

function debtStatusFromPaid(amount: number, paidTotal: number): MoneyDebtStatus {
  if (paidTotal <= 0) return 'open';
  if (paidTotal >= amount) return 'paid';
  return 'partial';
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
    remaining: Math.max(0, amount - paidTotal),
    remainingLabel: isPiutang ? 'Sisa piutang' : 'Sisa utang',
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
    const rows = await debtsRepository.list(ctx.workspace.id, { status, direction });
    return Promise.all(
      rows.map(async (row) => {
        const paidTotal = await debtsRepository.sumPayments(row.id);
        return toListDto(row, paidTotal);
      }),
    );
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
    const payments = await debtsRepository.listPayments(id);
    const paidTotal = payments.reduce((s, p) => s + (asNumber(p.amount) ?? 0), 0);
    return {
      ...toListDto(row, paidTotal),
      payments: payments.map(paymentDto),
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

    const row = await debtsRepository.create({
      workspaceId: ctx.workspace.id,
      personId,
      counterpartyName: parseNonEmptyString(raw.counterpartyName, 'counterpartyName', 120),
      direction: parseEnum(raw.direction, 'direction', MONEY_DEBT_DIRECTIONS),
      amount: parseAmount(raw.amount, 'amount'),
      date: parseDateOnly(raw.date, 'date'),
      dueDate: parseOptionalDateOnly(raw.dueDate, 'dueDate') ?? null,
      note: parseOptionalString(raw.note, 'note', 500) ?? null,
    });

    return toListDto(row, 0);
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

    if (Object.keys(patch).length > 0) {
      await debtsRepository.update(ctx.workspace.id, id, patch);
    }

    const amount = patch.amount ?? (asNumber(existing.amount) ?? 0);
    const paidTotal = await debtsRepository.sumPayments(id);
    const status = debtStatusFromPaid(amount, paidTotal);
    if (status !== existing.status) {
      await debtsRepository.update(ctx.workspace.id, id, { status });
    }

    return this.getById(authPersonId, familyId, idRaw);
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
    await debtsRepository.delete(ctx.workspace.id, id);
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
    const remaining = Math.max(0, debtAmount - paidTotal);
    if (amount > remaining) {
      const sisaLabel = debt.direction === 'piutang' ? 'sisa piutang' : 'sisa utang';
      throw new AppError(
        422,
        ErrorCodes.VALIDATION_ERROR,
        `Pembayaran melebihi ${sisaLabel} (${remaining}).`,
      );
    }

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
      after: paymentDto(payment),
    });

    return this.getById(authPersonId, familyId, idRaw);
  }
}

export const debtsService = new DebtsService();
