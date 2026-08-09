# Prompt BE — Activity transfer: kantong asal + tujuan

Lempar prompt ini ke AI BE.

Related kontrak: [`docs/requests/to-be/MONEY-TRACK-API.md`](../../to-be/MONEY-TRACK-API.md) §8 Activity / §9 Transfers.

---

## Konteks

FE list **Transaksi** (`GET /money/activity`) menampilkan kolom kantong sebagai:

```text
asal
→ tujuan
```

untuk `kind: "transfer"` dan `kind: "cash_withdrawal"`.

Saat ini item activity sering hanya punya `pocketLabel` / `pocketId` sisi **asal**, jadi tujuan tidak muncul di tabel.

FE juga butuh `toPocketId` saat buka modal edit transfer (prefill kantong tujuan).

---

## Request

### 1. Enrichment di `GET /money/activity` (dan dashboard `recentActivity` bila sama shape)

Untuk setiap item `kind === "transfer"`:

| Field | Type | Arti |
|-------|------|------|
| `pocketId` | number \| null | Kantong **asal** (`fromPocketId`) |
| `pocketLabel` | string | Label kantong asal (boleh sama dengan `fromPocketLabel`) |
| `fromPocketLabel` | string \| null | Label kantong asal (opsional, lebih eksplisit) |
| `toPocketId` | number \| null | Kantong **tujuan** |
| `toPocketLabel` | string \| null | Label kantong tujuan |

Contoh:

```json
{
  "id": "transfer-12",
  "kind": "transfer",
  "title": "Uang belanja",
  "categoryName": "Transfer",
  "categoryId": null,
  "personId": 1,
  "personName": "Irfan",
  "pocketId": 101,
  "pocketLabel": "Transaksi · BCA",
  "fromPocketLabel": "Transaksi · BCA",
  "toPocketId": 201,
  "toPocketLabel": "Transaksi · Seabank",
  "amount": 3000000,
  "date": "2026-08-01",
  "signed": "neutral",
  "link": "/money/transactions"
}
```

Alternatif yang juga diterima FE: `pocketLabel` sudah berbentuk  
`"Transaksi · BCA → Transaksi · Seabank"` **dan** tetap kirim `toPocketId` / `toPocketLabel` terpisah.

### 2. `cash_withdrawal`

| Field | Contoh |
|-------|--------|
| `pocketLabel` / `fromPocketLabel` | `"Transaksi · BCA"` |
| `toPocketLabel` | `"Cash"` atau nama cash account |
| `toPocketId` | id pocket/account cash bila ada; boleh `null` |

### 3. Detail + PATCH (edit form FE sudah siap)

Pastikan sudah ada / lengkap:

`GET /money/transfers/:id` — include `fromPocketId`, `toPocketId`, `kind`, `amount`, `date`, `note` (+ nama bila ada).

`PATCH /money/transfers/:id` — partial update:

```json
{
  "kind": "interpersonal",
  "fromPocketId": 101,
  "toPocketId": 201,
  "amount": 3000000,
  "date": "2026-08-01",
  "note": "opsional"
}
```

Recompute saldo: reverse efek lama + apply nilai baru (kedua sisi).

`GET /money/cash-withdrawals/:id`  
`PATCH /money/cash-withdrawals/:id` — boleh update `fromAccountId` / `fromPocketId` / `amount` / `date` / `note`.

### 4. Auth

Sama seperti `/money/*`: JWT + `X-Module-Unlock`.

---

## Acceptance criteria

- [ ] Item activity transfer punya `toPocketLabel` (dan idealnya `toPocketId`).
- [ ] FE list transaksi menampilkan asal → tujuan tanpa fetch per baris.
- [ ] Item cash withdrawal punya `toPocketLabel` (min. `"Cash"`).
- [ ] `GET /money/transfers/:id` mengembalikan kedua pocket.
- [ ] `PATCH /money/transfers/:id` bisa ganti pocket asal/tujuan + amount/date/note dengan saldo benar.

---

## FE (sudah siap)

- `mapActivityToUiTx` menyusun `"asal → tujuan"` dari `fromPocketLabel` / `pocketLabel` + `toPocketLabel`.
- Tabel transaksi render dua baris untuk transfer/cash.
- Modal edit transfer load detail + kirim PATCH lengkap (pocket + nominal + tanggal + catatan).
