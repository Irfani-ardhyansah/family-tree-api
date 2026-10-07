# Money Track (`mt_`)

Modul keuangan couple/single di bawah `/api/v1/money`.

## Auth

Semua route membutuhkan:

- `Authorization: Bearer <accessToken>`
- `X-Module-Unlock: <unlockToken>` (secondary password, module `money`)

## Fitur

- Phase 1: setup, accounts, pockets, categories, transactions
- Phase 2: transfers, cash withdrawals, opening/balancing, dashboard
- Phase 3: wishlist, debts + payments, budgets, audit logs, reminders, media purposes `money_*`

## Utang/piutang nempel ke kantong

`mt_debts.pocket_id` (nullable) menautkan satu catatan utang/piutang ke satu kantong:

- Efek saldo **derived**, tidak ada baris `mt_transactions` baru:
  `debtEffect = sign × (amount − paidTotal)`, `sign = +1` (utang) / `−1` (piutang) —
  lihat `money.balance.ts` dan helper `debtNetEffect` di `money.helpers.ts`.
- `pocket_id = NULL` (debt lama / belum di-link) = catatan saja, saldo tidak berubah.
- `GET /money/activity` punya `kind: "debt"`: satu baris agregat per debt (tanggal = `mt_debts.date`),
  field `direction`/`status`/`principalAmount`/`paidTotal`/`remaining`/`netAmount`/`interestAmount`
  + `link` ke `/money/debts/:id`. Opt-out: `?includeDebts=false`.
- Bunga = kelebihan bayar (`interestAmount = max(0, paidTotal − amount)`), pembayaran boleh
  melebihi pokok. Saldo kantong boleh minus → response mutasi kasih `balanceWarning` (info, bukan error).
- Hapus kantong melepas link (`ON DELETE SET NULL` + `deletePocketsCascade`), catatan utang tetap ada.

Spek lengkap: [`docs/requests/from-fe/done/MONEY-DEBT-POCKET-LINKING-BE-PROMPT.md`](../../docs/requests/from-fe/done/MONEY-DEBT-POCKET-LINKING-BE-PROMPT.md).

## Seed dummy

`npm run seed` menjalankan `03_money_track_data.ts` — workspace couple **Irfan + Ayu** (login `MIA210399` / `AK170501`) dengan account, pocket, txn, transfer, cash, wishlist, debt, budget.

## Prefix tabel

`mt_*` — lihat `src/shared/database/tables.ts` dan migration `create_money_track`.
