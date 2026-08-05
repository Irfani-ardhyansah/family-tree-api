# BE Prompt — Date-only + PATCH transfer / cash withdrawal

## Context
FE Money Track already sends and displays dates as **calendar date-only** `YYYY-MM-DD` (timezone-safe). Previously FE used `toISOString().slice(0,10)` which shifted WIB → UTC and made **1 Agustus** appear as **31 Juli**.

## Required BE behavior

### 1. Date fields (transactions, transfers, cash-withdrawals, opening balances)
- Accept and store `date` as **date-only** `YYYY-MM-DD` (not UTC datetime).
- When returning JSON, prefer `"2026-08-01"` (string date) or at least a value whose calendar day matches what the user entered.
- Do **not** persist local midnight as UTC instant without converting back to the user’s calendar date.

### 2. PATCH endpoints (for list edit)
FE calls:

`PATCH /money/transfers/:id`
```json
{ "amount": 100000, "date": "2026-08-01", "note": "opsional" }
```

`PATCH /money/cash-withdrawals/:id`
```json
{ "amount": 100000, "date": "2026-08-01", "note": "opsional" }
```

- Partial update; recompute saldo both sides (transfer) / bank+cash (withdrawal).
- Keep existing `DELETE` reverse + audit.

`PATCH /money/transactions/:id` already expected for income/expense.

## Done when
- Create with `date: "2026-08-01"` → list/API returns the same calendar day.
- PATCH transfer / cash-withdrawal updates amount/date/note and balances.
