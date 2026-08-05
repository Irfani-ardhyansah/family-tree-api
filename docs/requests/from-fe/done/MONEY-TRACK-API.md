# Money Track — Kontrak API (to-be)

Dokumen target untuk implementasi BE (selesai).  
Related: [`MONEY-TRANSACTIONS-FILTER-API.md`](./MONEY-TRANSACTIONS-FILTER-API.md)

| | |
|--|--|
| **Base path** | `/api/v1/money` |
| **Auth** | Bearer JWT **wajib** |
| **Unlock** | Header `X-Module-Unlock: <unlockToken>` (password kedua) — lihat secondary-password |
| **Currency** | IDR only — **integer rupiah**, tanpa desimal |
| **Envelope** | `{ "data": … }` / error `{ "data": null, "error": { "code", "message" } }` |

---

## Status

| Area | BE | FE |
|------|----|----|
| Setup / accounts / pockets / categories / txn | ✅ | 🟡 read wired (API mode) |
| Transfers, cash, opening/balancing, dashboard | ✅ | 🟡 dashboard + lists read |
| Wishlist, debts, budgets, audit, reminders | ✅ | 🟡 wishlist/debts/balancing read |
| Secondary unlock di `/money/*` | ✅ | ✅ header `X-Module-Unlock` |
| Write/CRUD dari FE | ✅ | pending (modal masih dummy write) |

---

## 0. Keputusan produk

| Topik | Keputusan |
|-------|-----------|
| Scope v1 | Fitur PRD #1–#19. **Out:** spreadsheet sync (#20–#21) |
| Account ↔ Pocket | **1 Account → banyak Pocket** |
| Privacy couple v1 | **Full share** — pasangan lihat & edit semua; `scope` = filter tampilan, bukan ACL |
| Single mode | Tanpa joint pocket & transfer antar pasangan |
| Default seed | Kantong Transaksi / Tabungan / Investasi + kategori umum (editable) |
| Cicilan | Entity `DebtPayment` dari awal |
| Reminder | In-app only (boleh digabung dashboard) |
| Attachment | Reuse media upload; purpose di bawah |

---

## 1. Konvensi

### Auth & unlock

Semua route di bawah `/money/*` butuh:

```http
Authorization: Bearer <accessToken>
X-Module-Unlock: <unlockToken>
```

| HTTP | `error.code` | Arti |
|------|--------------|------|
| 401 | `UNAUTHORIZED` | Token access invalid |
| 403 | `SECONDARY_UNLOCK_REQUIRED` | Belum verify / header kosong |
| 403 | `SECONDARY_UNLOCK_INVALID` | Unlock expired/salah |
| 403 | `FORBIDDEN` | Tidak boleh akses resource |
| 404 | `NOT_FOUND` | Resource tidak ada |
| 409 | `CONFLICT` | Konflik bisnis (hapus account masih ada saldo, dll.) |
| 422 | `VALIDATION_ERROR` | Payload invalid |
| 422 | `INSUFFICIENT_BALANCE` | Transfer/tarik melebihi saldo (opsional; FE sudah preview) |

CORS: allow header `X-Module-Unlock` (sudah ada di spek secondary-password).

### Pagination

Di dalam `data` (bukan top-level `meta`):

```json
{
  "data": {
    "items": [],
    "page": 1,
    "pageSize": 20,
    "total": 100
  }
}
```

### Scope query (tampilan)

| Query | Nilai | Arti |
|-------|-------|------|
| `scope` | `all` \| `person` | Default `all` (couple); single selalu efektif `all` |
| `personId` | number | Wajib jika `scope=person` |

### ID

Pakai **number** (konsisten modul lain). FE mock sementara string — akan di-map saat wire API.

### Money workspace

Satu workspace per couple (atau single). Resource hidup di workspace user login. Linking couple mengasosiasikan 2 person ke 1 workspace.

---

## 2. Entities (ringkas)

```
Workspace       id, mode (single|couple), …
Person          id, workspaceId, name, role (husband|wife|self),
                familyRootsPersonId?, userId?
CoupleLink      personAId, personBId, linkedAt
Account         id, personId, name, type (bank|ewallet|cash), bankName?
Pocket          id, accountId, ownerType (person|joint),
                category (transaksi|tabungan|investasi|custom),
                name, goalAmount?, goalDate?, archivedAt?
Category        id, name, type (income|expense), icon?, sortOrder, isSystem?
                // icon FE: id Feather MIT (mis. "coffee", "truck") — emoji lama tetap diterima
Transaction     id, pocketId, categoryId?, type, amount, date, note?,
                attachmentMediaId?, createdByPersonId
Transfer        id, kind (interpersonal|interpocket), fromPocketId, toPocketId,
                amount, date, note?, createdByPersonId
CashWithdrawal  id, fromAccountId, fromPocketId?, toCashAccountId,
                amount, date, note?, attachmentMediaId?, createdByPersonId
WishlistItem    id, personId?, name, estimatedPrice, priority,
                linkedPocketId?, imageMediaId?, purchasedAt?
Debt            id, personId, counterpartyName, direction (utang|piutang),
                directionLabel, amount, date, dueDate?, status (open|partial|paid),
                note?, paidTotal?, remaining?, remainingLabel?
DebtPayment     id, debtId, amount, date, note?, createdByPersonId
Budget          id, categoryId, yearMonth (YYYY-MM), limitAmount
AuditLog        id, actorPersonId, action, entityType, entityId, before, after, createdAt
```

**Saldo pocket (dihitung BE):**  
`opening + income + transfer_in + cash_in − expense − transfer_out − cash_out ± adjustment`

Cash withdrawal: kurangi sumber → tambah cash account person (bukan expense).

---

## 3. Setup & workspace

### 3.1 Status

`GET /money/setup`

```json
{
  "isConfigured": true,
  "mode": "couple",
  "persons": [
    { "id": 1, "name": "Irfan", "role": "husband", "userId": 10 }
  ],
  "coupleLinkedAt": "2026-07-01T00:00:00.000Z",
  "needsOpeningBalances": false,
  "hasSampleData": true
}
```

| Field | Arti |
|-------|------|
| `needsOpeningBalances` | Workspace masih perlu input opening balance (batch / pocket pending) |
| `hasSampleData` | Workspace masih berisi **seed/data contoh**. FE tampilkan tombol **Hapus Data Contoh** hanya jika `true`. Setelah wipe sukses → permanen `false` (meski user isi data real kemudian). |

### 3.2 Bootstrap persons

`POST /money/setup/persons`

```json
{
  "persons": [
    { "name": "Irfan", "role": "husband", "familyRootsPersonId": null },
    { "name": "Ayu", "role": "wife", "familyRootsPersonId": null }
  ]
}
```

- Single: 1 person, `role: "self"`
- Couple: tepat 2 person (`husband` + `wife`)

### 3.3 Couple link

`POST /money/couple-link`

```json
{
  "personAId": 1,
  "personBId": 2,
  "familyRootsPersonAId": null,
  "familyRootsPersonBId": null
}
```

`DELETE /money/couple-link` — putuskan link.  
Usulan: joint pockets → archived read-only (BE finalkan aturan).

---

## 4. Accounts

| Method | Path |
|--------|------|
| `GET` | `/money/accounts?personId=` |
| `POST` | `/money/accounts` |
| `PATCH` | `/money/accounts/:id` |
| `DELETE` | `/money/accounts/:id?cascade=true` |

```json
{
  "personId": 1,
  "name": "BCA",
  "type": "bank",
  "bankName": "BCA"
}
```

`type`: `bank` | `ewallet` | `cash`  
Account `cash`: **satu per person**, auto-create saat setup — **boleh dihapus** jika user konfirmasi cascade.

| Query | Nilai | Arti |
|-------|-------|------|
| `cascade=true` | disarankan FE selalu kirim | Hapus account **beserta** pocket (aktif+archived), transaksi/transfer/cash-withdrawal terkait, dll. di dalam account itu |
| tanpa cascade / `false` | | `409 CONFLICT` jika masih ada pocket / data terkait |

**FE:** tombol Hapus di modal account selalu tampil (termasuk cash). Konfirmasi menjelaskan cascade delete.

---

## 5. Pockets

| Method | Path |
|--------|------|
| `GET` | `/money/pockets?personId=&ownerType=&includeArchived=` |
| `POST` | `/money/pockets` |
| `PATCH` | `/money/pockets/:id` |
| `DELETE` | `/money/pockets/:id` — hard delete pocket + data terkait; tidak bisa dipulihkan |
| `POST` | `/money/pockets/:id/archive` |
| `POST` | `/money/pockets/:id/unarchive` — set `archivedAt` kembali ke `null` |

`includeArchived=true` — sertakan pocket dengan `archivedAt != null` (default: hanya aktif).

**Hapus pocket (FE):** selalu pakai `DELETE` (bukan archive). Archive/unarchive tetap tersedia bila BE butuh soft-hide terpisah.

```json
{
  "accountId": 10,
  "ownerType": "person",
  "category": "transaksi",
  "name": "Transaksi",
  "goalAmount": null,
  "goalDate": null
}
```

- Joint: `ownerType: "joint"` — hanya mode couple; `accountId` tetap wajib  
- Response sertakan `balance` (computed) + `account: { id, name, type }`

---

## 6. Categories

| Method | Path |
|--------|------|
| `GET` | `/money/categories?type=income\|expense` |
| `POST` | `/money/categories` |
| `PATCH` | `/money/categories/:id` |
| `DELETE` | `/money/categories/:id` — soft / block jika dipakai |

**Seed expense:** Makan, Transport, Tagihan, Hiburan, Belanja, Kesehatan, Pendidikan, Lainnya  
**Seed income:** Gaji, Bonus, Freelance, Hasil Investasi, Lainnya

**Icon:** string id Feather MIT di FE (mis. `"coffee"`, `"truck"`). Emoji lama dari seed/mock tetap diterima sebagai fallback tampilan.

---

## 7. Dashboard

`GET /money/dashboard?period=2026-07&scope=all|person&personId=`

```json
{
  "period": { "yearMonth": "2026-07", "label": "Juli 2026" },
  "scope": "all",
  "mode": "couple",
  "summary": {
    "income": 24500000,
    "expense": 14180000,
    "net": 10320000,
    "incomeChangePct": 8,
    "expenseChangePct": 3,
    "totalSavings": 187400000
  },
  "persons": [
    {
      "id": 1,
      "name": "Irfan",
      "role": "husband",
      "initial": "I",
      "totalBalance": 96200000,
      "pockets": [
        {
          "id": 101,
          "name": "Transaksi",
          "category": "transaksi",
          "balance": 8450000,
          "accountName": "BCA"
        }
      ]
    }
  ],
  "jointPockets": [
    {
      "id": 201,
      "name": "Dana Darurat",
      "balance": 34500000,
      "goalAmount": 60000000,
      "goalDate": "2026-12-31",
      "progressPct": 57
    }
  ],
  "recentActivity": [
    {
      "id": "txn:55",
      "kind": "expense",
      "title": "Makan siang",
      "meta": "26 Jul · Transaksi · Irfan",
      "amount": 85000,
      "signed": "neg"
    }
  ],
  "alerts": [],
  "reminders": [
    {
      "id": "debt_due:9",
      "type": "debt_due",
      "title": "Piutang Budi jatuh tempo",
      "body": "Sisa piutang Rp 800.000",
      "dueAt": "2026-08-01T00:00:00.000Z",
      "relatedType": "debt",
      "relatedId": 9,
      "link": "/money/debts/9"
    }
  ]
}
```

`recentActivity.kind`: `income` | `expense` | `transfer` | `cash_withdrawal`  
`signed`: `pos` | `neg` | `neutral`

`alerts` — `balance_mismatch` (kosong dulu sampai balancing mismatch diisi).  
`reminders` — `debt_due` / `budget_near` / `budget_over` saja; jangan di-copy ke `alerts`.

---

## 8. Transactions

| Method | Path |
|--------|------|
| `GET` | `/money/transactions?from=&to=&personId=&pocketId=&type=&categoryId=&q=&uncategorized=&page=&pageSize=` |
| `GET` | `/money/transactions/:id` |
| `POST` | `/money/transactions` |
| `PATCH` | `/money/transactions/:id` |
| `DELETE` | `/money/transactions/:id` — audit wajib |
| `GET` | `/money/activity?kind=&from=&to=&personId=&pocketId=&categoryId=&q=&uncategorized=&page=&pageSize=` — unified feed (txn + transfer + cash) |

List/detail transaksi menyertakan enrichment: `categoryName`, `categoryIcon`, `pocketName`, `accountName`, `personId`, `personName`.

`kind` di activity: `all` \| `income` \| `expense` \| `transfer` \| `cash_withdrawal`.

```json
{
  "pocketId": 101,
  "categoryId": 3,
  "type": "expense",
  "amount": 85000,
  "date": "2026-07-26",
  "note": "Makan siang",
  "attachmentMediaId": null
}
```

`type`: `income` | `expense` | `opening_balance` | `adjustment`  
Untuk `adjustment` / `opening_balance`: `note` **wajib**; `categoryId` boleh null.  
Response boleh include `balanceAfter`.

---

## 9. Transfers

`POST /money/transfers`

```json
{
  "kind": "interpersonal",
  "fromPocketId": 101,
  "toPocketId": 201,
  "amount": 3000000,
  "date": "2026-07-26",
  "note": "Uang belanja bulan ini"
}
```

| `kind` | Aturan |
|--------|--------|
| `interpersonal` | Pocket 2 person berbeda; hanya couple |
| `interpocket` | Pocket person sama, atau personal ↔ joint |

Atomic (satu record, update kedua sisi).  
`GET /money/transfers/:id`  
`DELETE /money/transfers/:id` — reverse + audit

---

## 10. Cash withdrawals

`POST /money/cash-withdrawals`

```json
{
  "fromAccountId": 10,
  "fromPocketId": 101,
  "amount": 500000,
  "date": "2026-07-24",
  "note": "Buat bayar tukang",
  "attachmentMediaId": null
}
```

`toCashAccountId` diisi BE (cash account owner `fromAccount`).  
`GET /money/cash-withdrawals?from=&to=&page=`  
`DELETE /money/cash-withdrawals/:id`

---

## 11. Opening balance & balancing

### Opening (batch)

`POST /money/opening-balances`

```json
{
  "date": "2026-07-01",
  "items": [{ "pocketId": 101, "amount": 8450000 }]
}
```

→ transaksi `opening_balance` per item.

### Balancing

`GET /money/balancing` — pocket + `recordedBalance`  
`POST /money/balancing/check`

```json
{
  "items": [{ "pocketId": 101, "actualBalance": 8330000 }]
}
```

Response per item: `diff = actual − recorded`.

`POST /money/balancing/adjust`

```json
{
  "pocketId": 101,
  "actualBalance": 8330000,
  "note": "Selisih ATM belum dicatat"
}
```

→ `adjustment` sebesar `diff` + audit.

---

## 12. Wishlist

| Method | Path |
|--------|------|
| `GET` | `/money/wishlist` |
| `POST` | `/money/wishlist` |
| `PATCH` | `/money/wishlist/:id` |
| `DELETE` | `/money/wishlist/:id` |

```json
{
  "name": "Vacuum cleaner",
  "estimatedPrice": 2500000,
  "priority": "medium",
  "linkedPocketId": null,
  "personId": null,
  "imageMediaId": null
}
```

`priority`: `low` | `medium` | `high`  
Jika `linkedPocketId` set: response include `progressAmount`, `progressPct`.

---

## 13. Debts & payments

| Method | Path |
|--------|------|
| `GET` | `/money/debts?status=&direction=` |
| `POST` | `/money/debts` |
| `PATCH` | `/money/debts/:id` |
| `DELETE` | `/money/debts/:id` |
| `POST` | `/money/debts/:id/payments` |
| `GET` | `/money/debts/:id` — include `payments[]`, `paidTotal`, `remaining` |

```json
{
  "personId": 1,
  "counterpartyName": "Budi",
  "direction": "piutang",
  "amount": 1000000,
  "date": "2026-07-01",
  "dueDate": "2026-08-01",
  "note": null
}
```

Response list/detail juga mengirim label siap tampil:

```json
{
  "id": 9,
  "direction": "piutang",
  "directionLabel": "Piutang",
  "amount": 1000000,
  "paidTotal": 200000,
  "remaining": 800000,
  "remainingLabel": "Sisa piutang"
}
```

`directionLabel`: `"Piutang"` | `"Utang"`  
`remainingLabel`: `"Sisa piutang"` | `"Sisa utang"`

Payment:

```json
{ "amount": 200000, "date": "2026-07-15", "note": "Cicilan 1" }
```

BE update `status`: `open` → `partial` → `paid`.

---

## 14. Budgets

`GET /money/budgets?yearMonth=2026-07`  
`PUT /money/budgets` — upsert per kategori

```json
{
  "yearMonth": "2026-07",
  "items": [{ "categoryId": 3, "limitAmount": 2000000 }]
}
```

Response include `spentAmount`, `remaining`, `pctUsed`.

---

## 15. Audit logs

`GET /money/audit-logs?entityType=&entityId=&from=&to=&page=`

```json
{
  "id": 1,
  "actorPersonId": 1,
  "actorName": "Irfan",
  "action": "create",
  "entityType": "transaction",
  "entityId": 55,
  "before": null,
  "after": {},
  "createdAt": "2026-07-26T10:00:00.000Z"
}
```

Wajib untuk create/update/delete: transaction, transfer, cash withdrawal, adjustment, debt payment.

---

## 16. Reminders

`GET /money/reminders`  
(juga di `dashboard.reminders`)

```json
{
  "items": [
    {
      "id": "debt_due:9",
      "type": "debt_due",
      "title": "Piutang Budi jatuh tempo",
      "body": "Sisa piutang Rp 800.000",
      "dueAt": "2026-08-01T00:00:00.000Z",
      "relatedType": "debt",
      "relatedId": 9,
      "link": "/money/debts/9"
    },
    {
      "id": "budget_near:3",
      "type": "budget_near",
      "title": "Budget Makan hampir habis",
      "body": "Terpakai Rp 900.000 / Rp 1.000.000 (90%)",
      "dueAt": null,
      "relatedType": "budget",
      "relatedId": 3,
      "link": "/money/budgets?yearMonth=2026-07"
    }
  ]
}
```

`type` di reminders: `debt_due` | `budget_near` | `budget_over`  
`type` di alerts (dashboard): `balance_mismatch` — terpisah, jangan duplikasi debt/budget ke `alerts`.  
Debt body: `Sisa piutang Rp …` / `Sisa utang Rp …` (bukan cuma “Sisa”).  
`link` relatif untuk navigasi FE (`/money/debts/{id}`, `/money/budgets?yearMonth=YYYY-MM`).  
Tidak perlu push channel di v1.

---

## 17. Attachments (media)

Reuse media API existing. Purpose baru:

| purpose | Max | Dipakai di |
|---------|-----|------------|
| `money_transaction` | 3 | Transaction |
| `money_cash_withdrawal` | 3 | CashWithdrawal |
| `money_wishlist` | 1 | WishlistItem |

FE upload dulu → kirim `attachmentMediaId` / `imageMediaId`.

---

## 18. Seed defaults (setup pertama)

Urutan usulan:

1. Persons  
2. Accounts (min 1 bank/ewallet + auto cash)  
3. Pockets default (Transaksi, Tabungan, Investasi) assign ke account  
4. Opening balances batch  
5. Categories seed otomatis  

---

## 19. Out of scope (jangan buat dulu)

- Export / sync Google Sheets  
- Approval workflow transfer  
- Multi-currency  
- Open banking  
- Push/email/WA untuk reminder money  

---

## 20. Checklist BE

- [x] Workspace single & couple  
- [x] Gate `X-Module-Unlock` di semua `/money/*`  
- [x] Account / Pocket CRUD + balance computed  
- [x] Categories + seed  
- [x] Transactions (4 types)  
- [x] Transfers interpersonal & interpocket (atomic)  
- [x] Cash withdrawal → cash account  
- [x] Opening + balancing adjust  
- [x] Dashboard aggregate  
- [x] Wishlist, debts + payments, budgets  
- [x] Audit log  
- [x] Reminders in-app  
- [x] Media purpose `money-*`  
- [x] `hasSampleData` + wipe sticky clear  
- [x] `DELETE /accounts/:id?cascade=true`  
- [x] `DELETE /pockets/:id` hard delete  

