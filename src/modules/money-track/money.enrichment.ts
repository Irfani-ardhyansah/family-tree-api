import db from '../../config/database';
import { Tables } from '../../shared/database/tables';
import { asNumber, toDateOnly } from './money.access';
import type {
  MoneyAccountRow,
  MoneyCategoryRow,
  MoneyPersonRow,
  MoneyPocketRow,
  MoneyTransactionDto,
  MoneyTransactionRow,
} from './money.types';

export type EnrichmentMaps = {
  pockets: Map<number, MoneyPocketRow>;
  accounts: Map<number, MoneyAccountRow>;
  categories: Map<number, MoneyCategoryRow>;
  persons: Map<number, MoneyPersonRow>;
};

export async function loadEnrichmentMaps(
  workspaceId: number,
  pocketIds: number[],
  categoryIds: number[],
): Promise<EnrichmentMaps> {
  const uniquePockets = [...new Set(pocketIds.filter((id) => id > 0))];
  const uniqueCategories = [...new Set(categoryIds.filter((id) => id > 0))];

  const [pockets, persons, categories] = await Promise.all([
    uniquePockets.length === 0
      ? Promise.resolve([] as MoneyPocketRow[])
      : db(Tables.MONEY_POCKETS)
          .where({ workspace_id: workspaceId })
          .whereIn('id', uniquePockets)
          .select<MoneyPocketRow[]>('*'),
    db(Tables.MONEY_PERSONS)
      .where({ workspace_id: workspaceId })
      .select<MoneyPersonRow[]>('*'),
    uniqueCategories.length === 0
      ? Promise.resolve([] as MoneyCategoryRow[])
      : db(Tables.MONEY_CATEGORIES)
          .where({ workspace_id: workspaceId })
          .whereIn('id', uniqueCategories)
          .select<MoneyCategoryRow[]>('*'),
  ]);

  const accountIds = [...new Set(pockets.map((p) => p.account_id))];
  const accounts =
    accountIds.length === 0
      ? ([] as MoneyAccountRow[])
      : await db(Tables.MONEY_ACCOUNTS)
          .where({ workspace_id: workspaceId })
          .whereIn('id', accountIds)
          .select<MoneyAccountRow[]>('*');

  return {
    pockets: new Map(pockets.map((p) => [p.id, p])),
    accounts: new Map(accounts.map((a) => [a.id, a])),
    categories: new Map(categories.map((c) => [c.id, c])),
    persons: new Map(persons.map((p) => [p.id, p])),
  };
}

export function enrichTransactionDto(
  row: MoneyTransactionRow,
  maps: EnrichmentMaps,
  balanceAfter?: number,
): MoneyTransactionDto {
  const pocket = maps.pockets.get(row.pocket_id);
  const account = pocket ? maps.accounts.get(pocket.account_id) : undefined;
  const category =
    row.category_id != null ? maps.categories.get(row.category_id) : undefined;
  const personId = pocket?.owner_person_id ?? null;
  const person = personId != null ? maps.persons.get(personId) : undefined;

  const dto: MoneyTransactionDto = {
    id: Number(row.id),
    pocketId: row.pocket_id,
    pocketName: pocket?.name ?? null,
    accountName: account?.name ?? null,
    categoryId: row.category_id,
    categoryName: category?.name ?? null,
    categoryIcon: category?.icon ?? null,
    type: row.type,
    amount: asNumber(row.amount) ?? 0,
    date: toDateOnly(row.date),
    note: row.note,
    attachmentMediaId: row.attachment_media_id,
    createdByPersonId: row.created_by_person_id,
    personId,
    personName: person?.name ?? null,
  };
  if (balanceAfter !== undefined) {
    dto.balanceAfter = balanceAfter;
  }
  return dto;
}

export function pocketLabel(
  pocketId: number | null | undefined,
  maps: EnrichmentMaps,
): string {
  if (pocketId == null) return '';
  const pocket = maps.pockets.get(pocketId);
  if (!pocket) return '';
  const account = maps.accounts.get(pocket.account_id);
  if (!account) return pocket.name;
  return `${pocket.name} · ${account.name}`;
}
