# Money Transactions — Filter & list enrichment (FE → BE)

## Status

| Layer | Status |
|-------|--------|
| FE | 🟡 Client-side filter di `/money/transactions` (dummy + subset API) |
| BE | ✅ Enrichment DTO + `q`/`uncategorized` + `GET /money/activity` |

FE sudah menampilkan filter: **tipe, kategori, kantong, rentang tanggal, pencarian teks**.  
Untuk data besar / pagination akurat, butuh dukungan BE di bawah.

---

## Masalah sekarang

1. **DTO transaksi tidak punya `categoryName`** — FE harus join `/money/categories` sendiri. Rawan mismatch & ekstra round-trip.
2. **Tidak ada search teks (`q`)** — filter judul/catatan hanya bisa di client setelah load.
3. **List `/money/transactions` hanya income/expense/opening/adjustment** — transfer & cash withdrawal ada endpoint terpisah, jadi tab “Transfer / Tarik tunai” di FE tidak terisi dari API feed yang sama.
4. **Pagination `pageSize` default kecil** — FE load 50 lalu filter lokal; hasil filter bisa kosong padahal data ada di halaman lain.
5. **Tidak ada flag `uncategorized`** — FE ingin filter `categoryId` null (opening/adjustment / tanpa kategori).

---

## Request perubahan

### 1. Enrich `MoneyTransactionDto` (list + detail)

Tambah field opsional (non-breaking):

```json
{
  "id": 55,
  "pocketId": 101,
  "pocketName": "Transaksi",
  "accountName": "BCA",
  "categoryId": 3,
  "categoryName": "Makan",
  "categoryIcon": "🍜",
  "type": "expense",
  "amount": 85000,
  "date": "2026-07-26",
  "note": "Makan siang",
  "createdByPersonId": 1,
  "personId": 1,
  "personName": "Irfan"
}
```

| Field | Keterangan |
|-------|------------|
| `categoryName` / `categoryIcon` | null jika `categoryId` null |
| `pocketName` / `accountName` | untuk tampilan list tanpa N+1 |
| `personId` / `personName` | owner pocket (atau joint → `personId: null`) |

### 2. Query baru di `GET /money/transactions`

Sudah ada: `from`, `to`, `personId`, `pocketId`, `type`, `categoryId`, `page`, `pageSize`.

Tambah:

| Param | Tipe | Keterangan |
|-------|------|------------|
| `q` | string | cari di `note` (case-insensitive, partial) |
| `uncategorized` | `true`/`false` | jika `true`, hanya `category_id IS NULL` (abaikan `categoryId`) |

Contoh:

```
GET /money/transactions?type=expense&categoryId=3&from=2026-07-01&to=2026-07-31&q=makan&page=1&pageSize=50
GET /money/transactions?uncategorized=true
```

### 3. Unified activity feed

`GET /money/activity` menggabungkan transactions + transfers + cash withdrawals.

Query: mirror filter transaksi + `kind` (`income|expense|transfer|cash_withdrawal|all`).

---

## Prioritas

| # | Item | Priority | BE |
|---|------|----------|----|
| 1 | `categoryName` (+ pocket/person labels) di DTO | P0 | ✅ |
| 2 | `q` + `uncategorized` query | P0 | ✅ |
| 3 | Unified `/money/activity` | P1 | ✅ |

---

## Acceptance

- [x] List transaksi return `categoryName` tanpa FE join manual
- [x] Filter `categoryId` + `from`/`to` + `q` dihormati server-side + `total` akurat
- [x] `uncategorized=true` hanya baris tanpa kategori
- [x] (P1) FE bisa filter Transfer / Tarik tunai dari satu feed berpaginasi
