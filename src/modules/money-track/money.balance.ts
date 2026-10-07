import db from '../../config/database';
import { Tables } from '../../shared/database/tables';
import { asNumber } from './money.access';

type SumRow = { total: number | string | null };

/**
 * balance = opening + income + transfer_in + cash_in
 *         - expense - transfer_out - cash_out
 *         ± adjustment
 *         + debt_effect
 *
 * debt_effect = Σ debt di kantong ini → sign × (amount − paidTotal)
 *               sign = +1 (utang) | −1 (piutang)
 *
 * Efek utang/piutang dihitung derived dari `mt_debts` + `mt_debt_payments`
 * (tidak ada baris `mt_transactions` yang ditulis), jadi ubah/hapus debt atau
 * tambah pembayaran otomatis benar tanpa rewrite ledger.
 */
export async function computePocketBalance(pocketId: number): Promise<number> {
  const [txnRow, transferInRow, transferOutRow, cashInRow, cashOutRow, debtResult] =
    await Promise.all([
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
      db.raw(
        `SELECT COALESCE(SUM(
           CASE d.direction WHEN 'utang' THEN 1 ELSE -1 END
           * (d.amount - COALESCE(p.paid, 0))
         ), 0) AS total
         FROM ${Tables.MONEY_DEBTS} d
         LEFT JOIN (
           SELECT debt_id, SUM(amount) AS paid
           FROM ${Tables.MONEY_DEBT_PAYMENTS}
           GROUP BY debt_id
         ) p ON p.debt_id = d.id
         WHERE d.pocket_id = ?`,
        [pocketId],
      ),
    ]);

  const txn = asNumber(txnRow?.total) ?? 0;
  const transferIn = asNumber(transferInRow?.total) ?? 0;
  const transferOut = asNumber(transferOutRow?.total) ?? 0;
  const cashIn = asNumber(cashInRow?.total) ?? 0;
  const cashOut = asNumber(cashOutRow?.total) ?? 0;
  const debtEffect = asNumber(debtResult?.[0]?.[0]?.total ?? debtResult?.[0]?.total) ?? 0;

  return txn + transferIn - transferOut + cashIn - cashOut + debtEffect;
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
