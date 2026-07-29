import db from '../../config/database';
import { Tables } from '../../shared/database/tables';
import { asNumber } from './money.access';

type SumRow = { total: number | string | null };

/**
 * balance = opening + income + transfer_in + cash_in
 *         - expense - transfer_out - cash_out
 *         ± adjustment
 */
export async function computePocketBalance(pocketId: number): Promise<number> {
  const [txnRow, transferInRow, transferOutRow, cashInRow, cashOutRow] = await Promise.all([
    db(Tables.MONEY_TRANSACTIONS)
      .where({ pocket_id: pocketId })
      .select(
        db.raw(
          `COALESCE(SUM(CASE
            WHEN type IN ('opening_balance', 'income') THEN amount
            WHEN type = 'expense' THEN -amount
            WHEN type = 'adjustment' THEN amount
            ELSE 0
          END), 0) AS total`,
        ),
      )
      .first<SumRow>(),
    db(Tables.MONEY_TRANSFERS)
      .where({ to_pocket_id: pocketId })
      .sum({ total: 'amount' })
      .first<SumRow>(),
    db(Tables.MONEY_TRANSFERS)
      .where({ from_pocket_id: pocketId })
      .sum({ total: 'amount' })
      .first<SumRow>(),
    db(Tables.MONEY_CASH_WITHDRAWALS)
      .where({ to_cash_pocket_id: pocketId })
      .sum({ total: 'amount' })
      .first<SumRow>(),
    db(Tables.MONEY_CASH_WITHDRAWALS)
      .where({ from_pocket_id: pocketId })
      .sum({ total: 'amount' })
      .first<SumRow>(),
  ]);

  const txn = asNumber(txnRow?.total) ?? 0;
  const transferIn = asNumber(transferInRow?.total) ?? 0;
  const transferOut = asNumber(transferOutRow?.total) ?? 0;
  const cashIn = asNumber(cashInRow?.total) ?? 0;
  const cashOut = asNumber(cashOutRow?.total) ?? 0;

  return txn + transferIn - transferOut + cashIn - cashOut;
}

export async function computePocketBalances(
  pocketIds: number[],
): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  if (pocketIds.length === 0) return map;

  await Promise.all(
    pocketIds.map(async (id) => {
      map.set(id, await computePocketBalance(id));
    }),
  );
  return map;
}
