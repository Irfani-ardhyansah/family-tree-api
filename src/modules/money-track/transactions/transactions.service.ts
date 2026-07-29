import { AppError } from '../../../shared/errors/AppError';
import { ErrorCodes } from '../../../shared/errors/errorCodes';
import { moneyAccessRepository } from '../money-access.repository';
import {
  asNumber,
  parseAmount,
  parseDateOnly,
  parseEnum,
  parseOptionalDateOnly,
  parseOptionalEnum,
  parseOptionalPositiveInt,
  parseOptionalString,
  parsePage,
  parsePositiveInt,
  resolveMoneyContext,
  toDateOnly,
} from '../money.access';
import { writeMoneyAudit } from '../money.audit';
import { computePocketBalance } from '../money.balance';
import {
  AUDIT_ENTITY_TYPES,
  MONEY_TRANSACTION_TYPES,
  type MoneyTransactionType,
} from '../money.constants';
import { enrichTransactionDto, loadEnrichmentMaps } from '../money.enrichment';
import type {
  MoneyPaginated,
  MoneyTransactionDto,
  MoneyTransactionRow,
} from '../money.types';
import { categoriesRepository } from '../categories/categories.repository';
import { pocketsRepository } from '../pockets/pockets.repository';
import { transactionsRepository } from './transactions.repository';

function parseBoolFlag(value: unknown, field: string): boolean | undefined {
  if (value === undefined || value === '') return undefined;
  if (value === true || value === 'true' || value === '1') return true;
  if (value === false || value === 'false' || value === '0') return false;
  throw new AppError(422, ErrorCodes.VALIDATION_ERROR, `${field} harus true atau false.`);
}

function auditSnapshot(row: MoneyTransactionRow): Record<string, unknown> {
  return {
    id: Number(row.id),
    pocketId: row.pocket_id,
    categoryId: row.category_id,
    type: row.type,
    amount: asNumber(row.amount) ?? 0,
    date: toDateOnly(row.date),
    note: row.note,
  };
}

async function toEnrichedDto(
  workspaceId: number,
  row: MoneyTransactionRow,
  balanceAfter?: number,
): Promise<MoneyTransactionDto> {
  const maps = await loadEnrichmentMaps(
    workspaceId,
    [row.pocket_id],
    row.category_id != null ? [row.category_id] : [],
  );
  return enrichTransactionDto(row, maps, balanceAfter);
}

export class TransactionsService {
  async list(
    authPersonId: number,
    familyId: number,
    query: Record<string, unknown>,
  ): Promise<MoneyPaginated<MoneyTransactionDto>> {
    const ctx = await resolveMoneyContext(authPersonId, familyId);
    const { page, pageSize } = parsePage(query);
    const from = parseOptionalDateOnly(query.from, 'from');
    const to = parseOptionalDateOnly(query.to, 'to');
    const personId =
      query.personId === undefined
        ? undefined
        : parsePositiveInt(query.personId, 'personId');
    const pocketId =
      query.pocketId === undefined
        ? undefined
        : parsePositiveInt(query.pocketId, 'pocketId');
    const type = parseOptionalEnum(query.type, 'type', MONEY_TRANSACTION_TYPES);
    const uncategorized = parseBoolFlag(query.uncategorized, 'uncategorized');
    const categoryId =
      uncategorized
        ? undefined
        : query.categoryId === undefined
          ? undefined
          : parsePositiveInt(query.categoryId, 'categoryId');
    const q = parseOptionalString(query.q, 'q', 120) ?? undefined;

    if (personId != null) {
      const person = await moneyAccessRepository.findPersonById(
        ctx.workspace.id,
        personId,
      );
      if (!person) {
        throw new AppError(404, ErrorCodes.MONEY_PERSON_NOT_FOUND, 'Person tidak ditemukan.');
      }
    }

    const filters = {
      from: from ?? undefined,
      to: to ?? undefined,
      personId,
      pocketId,
      type,
      categoryId,
      q: q ?? undefined,
      uncategorized: uncategorized === true ? true : undefined,
      page,
      pageSize,
    };

    const [total, rows] = await Promise.all([
      transactionsRepository.count(ctx.workspace.id, filters),
      transactionsRepository.list(ctx.workspace.id, filters),
    ]);

    const maps = await loadEnrichmentMaps(
      ctx.workspace.id,
      rows.map((r) => r.pocket_id),
      rows.map((r) => r.category_id).filter((id): id is number => id != null),
    );

    return {
      items: rows.map((r) => enrichTransactionDto(r, maps)),
      page,
      pageSize,
      total,
    };
  }

  async getById(
    authPersonId: number,
    familyId: number,
    idRaw: string,
  ): Promise<MoneyTransactionDto> {
    const ctx = await resolveMoneyContext(authPersonId, familyId);
    const id = parsePositiveInt(idRaw, 'id');
    const row = await transactionsRepository.findById(ctx.workspace.id, id);
    if (!row) {
      throw new AppError(
        404,
        ErrorCodes.MONEY_TRANSACTION_NOT_FOUND,
        'Transaksi tidak ditemukan.',
      );
    }
    const balanceAfter = await computePocketBalance(row.pocket_id);
    return toEnrichedDto(ctx.workspace.id, row, balanceAfter);
  }

  async create(
    authPersonId: number,
    familyId: number,
    body: unknown,
  ): Promise<MoneyTransactionDto> {
    const ctx = await resolveMoneyContext(authPersonId, familyId);
    const parsed = await this.parseBody(ctx.workspace.id, body, 'create');

    if (parsed.type === 'opening_balance') {
      const openingCount = await transactionsRepository.countOpeningForPocket(
        parsed.pocketId,
      );
      if (openingCount > 0) {
        throw new AppError(
          409,
          ErrorCodes.CONFLICT,
          'Pocket sudah punya opening balance.',
        );
      }
    }

    const row = await transactionsRepository.create({
      workspaceId: ctx.workspace.id,
      pocketId: parsed.pocketId,
      categoryId: parsed.categoryId,
      type: parsed.type,
      amount: parsed.amount,
      date: parsed.date,
      note: parsed.note,
      attachmentMediaId: parsed.attachmentMediaId,
      createdByPersonId: ctx.actor.id,
    });

    await writeMoneyAudit({
      workspaceId: ctx.workspace.id,
      actorPersonId: ctx.actor.id,
      action: 'create',
      entityType:
        parsed.type === 'adjustment'
          ? AUDIT_ENTITY_TYPES.ADJUSTMENT
          : AUDIT_ENTITY_TYPES.TRANSACTION,
      entityId: Number(row.id),
      after: auditSnapshot(row),
    });

    const balanceAfter = await computePocketBalance(row.pocket_id);
    return toEnrichedDto(ctx.workspace.id, row, balanceAfter);
  }

  async update(
    authPersonId: number,
    familyId: number,
    idRaw: string,
    body: unknown,
  ): Promise<MoneyTransactionDto> {
    const ctx = await resolveMoneyContext(authPersonId, familyId);
    const id = parsePositiveInt(idRaw, 'id');
    const existing = await transactionsRepository.findById(ctx.workspace.id, id);
    if (!existing) {
      throw new AppError(
        404,
        ErrorCodes.MONEY_TRANSACTION_NOT_FOUND,
        'Transaksi tidak ditemukan.',
      );
    }

    const parsed = await this.parseBody(ctx.workspace.id, body, 'update', existing);
    const before = auditSnapshot(existing);

    if (
      parsed.type === 'opening_balance' &&
      (existing.type !== 'opening_balance' || parsed.pocketId !== existing.pocket_id)
    ) {
      const openingCount = await transactionsRepository.countOpeningForPocket(
        parsed.pocketId,
      );
      if (openingCount > 0) {
        throw new AppError(
          409,
          ErrorCodes.CONFLICT,
          'Pocket sudah punya opening balance.',
        );
      }
    }

    await transactionsRepository.update(ctx.workspace.id, id, {
      pocket_id: parsed.pocketId,
      category_id: parsed.categoryId,
      type: parsed.type,
      amount: parsed.amount,
      date: parsed.date,
      note: parsed.note,
      attachment_media_id: parsed.attachmentMediaId,
    });

    const updated = (await transactionsRepository.findById(ctx.workspace.id, id))!;

    await writeMoneyAudit({
      workspaceId: ctx.workspace.id,
      actorPersonId: ctx.actor.id,
      action: 'update',
      entityType:
        updated.type === 'adjustment'
          ? AUDIT_ENTITY_TYPES.ADJUSTMENT
          : AUDIT_ENTITY_TYPES.TRANSACTION,
      entityId: id,
      before,
      after: auditSnapshot(updated),
    });

    const balanceAfter = await computePocketBalance(updated.pocket_id);
    return toEnrichedDto(ctx.workspace.id, updated, balanceAfter);
  }

  async remove(
    authPersonId: number,
    familyId: number,
    idRaw: string,
  ): Promise<{ deleted: true }> {
    const ctx = await resolveMoneyContext(authPersonId, familyId);
    const id = parsePositiveInt(idRaw, 'id');
    const existing = await transactionsRepository.findById(ctx.workspace.id, id);
    if (!existing) {
      throw new AppError(
        404,
        ErrorCodes.MONEY_TRANSACTION_NOT_FOUND,
        'Transaksi tidak ditemukan.',
      );
    }

    const before = auditSnapshot(existing);
    await transactionsRepository.delete(ctx.workspace.id, id);

    await writeMoneyAudit({
      workspaceId: ctx.workspace.id,
      actorPersonId: ctx.actor.id,
      action: 'delete',
      entityType:
        existing.type === 'adjustment'
          ? AUDIT_ENTITY_TYPES.ADJUSTMENT
          : AUDIT_ENTITY_TYPES.TRANSACTION,
      entityId: id,
      before,
    });

    return { deleted: true };
  }

  private async parseBody(
    workspaceId: number,
    body: unknown,
    mode: 'create' | 'update',
    existing?: MoneyTransactionRow,
  ): Promise<{
    pocketId: number;
    categoryId: number | null;
    type: MoneyTransactionType;
    amount: number;
    date: string;
    note: string | null;
    attachmentMediaId: string | null;
  }> {
    if (!body || typeof body !== 'object') {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'Body tidak valid.');
    }
    const raw = body as Record<string, unknown>;

    const pocketId =
      mode === 'create' || raw.pocketId !== undefined
        ? parsePositiveInt(
            mode === 'create' ? raw.pocketId : (raw.pocketId ?? existing!.pocket_id),
            'pocketId',
          )
        : existing!.pocket_id;

    const type =
      mode === 'create' || raw.type !== undefined
        ? parseEnum(
            mode === 'create' ? raw.type : (raw.type ?? existing!.type),
            'type',
            MONEY_TRANSACTION_TYPES,
          )
        : existing!.type;

    const amount =
      mode === 'create' || raw.amount !== undefined
        ? parseAmount(
            mode === 'create' ? raw.amount : (raw.amount ?? existing!.amount),
            'amount',
            {
              allowNegative: type === 'adjustment',
              allowZero: type === 'adjustment',
            },
          )
        : (asNumber(existing!.amount) ?? 0);

    const date =
      mode === 'create' || raw.date !== undefined
        ? parseDateOnly(
            mode === 'create' ? raw.date : (raw.date ?? toDateOnly(existing!.date)),
            'date',
          )
        : toDateOnly(existing!.date);

    let note: string | null;
    if (raw.note !== undefined) {
      note = parseOptionalString(raw.note, 'note', 500) ?? null;
    } else if (mode === 'create') {
      note = null;
    } else {
      note = existing!.note;
    }

    let categoryId: number | null;
    if (type === 'opening_balance' || type === 'adjustment') {
      if (raw.categoryId != null && raw.categoryId !== undefined) {
        throw new AppError(
          422,
          ErrorCodes.VALIDATION_ERROR,
          'categoryId harus null untuk opening_balance/adjustment.',
        );
      }
      categoryId = null;
      if (!note) {
        throw new AppError(
          422,
          ErrorCodes.VALIDATION_ERROR,
          'note wajib untuk opening_balance/adjustment.',
        );
      }
    } else if (raw.categoryId !== undefined) {
      categoryId = parseOptionalPositiveInt(raw.categoryId, 'categoryId') ?? null;
    } else if (mode === 'create') {
      categoryId = parseOptionalPositiveInt(raw.categoryId, 'categoryId') ?? null;
    } else {
      categoryId = existing!.category_id;
    }

    let attachmentMediaId: string | null;
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
    } else if (mode === 'create') {
      attachmentMediaId = null;
    } else {
      attachmentMediaId = existing!.attachment_media_id;
    }

    const pocket = await pocketsRepository.findById(workspaceId, pocketId);
    if (!pocket || pocket.archived_at) {
      throw new AppError(
        404,
        ErrorCodes.MONEY_POCKET_NOT_FOUND,
        'Pocket tidak ditemukan atau sudah di-archive.',
      );
    }

    if (categoryId != null) {
      const category = await categoriesRepository.findById(workspaceId, categoryId);
      if (!category) {
        throw new AppError(
          404,
          ErrorCodes.MONEY_CATEGORY_NOT_FOUND,
          'Kategori tidak ditemukan.',
        );
      }
      if (category.type !== type) {
        throw new AppError(
          422,
          ErrorCodes.VALIDATION_ERROR,
          `Kategori type ${category.type} tidak cocok dengan transaksi ${type}.`,
        );
      }
    }

    return {
      pocketId,
      categoryId,
      type,
      amount,
      date,
      note,
      attachmentMediaId,
    };
  }
}

export const transactionsService = new TransactionsService();
