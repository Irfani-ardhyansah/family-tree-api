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

## Seed dummy

`npm run seed` menjalankan `03_money_track_data.ts` — workspace couple **Irfan + Ayu** (login `MIA210399` / `AK170501`) dengan account, pocket, txn, transfer, cash, wishlist, debt, budget.

## Prefix tabel

`mt_*` — lihat `src/shared/database/tables.ts` dan migration `create_money_track`.
