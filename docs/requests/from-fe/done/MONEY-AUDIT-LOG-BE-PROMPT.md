# Money Track — Audit Log (FE → BE)

## Status

| Layer | Status |
|-------|--------|
| BE | ⏳ pending |
| FE | 🟡 UI + client wired; menunggu endpoint & write-path |

Related: [`../../to-be/MONEY-TRACK-API.md`](../../to-be/MONEY-TRACK-API.md) §15, PRD §6.17.

---

## Tujuan

Setiap mutasi penting di Money Track tercatat **siapa** (dari session login → person), **kapan**, **aksi**, dan **before/after**.  
Pasangan di workspace couple (dengan modul unlock) boleh membaca semua log workspace — **bukan admin-only**.

FE tidak menulis audit. FE hanya `GET` list + detail.

---

## Auth & akses

| | |
|--|--|
| Auth | Bearer JWT **wajib** |
| Unlock | Header `X-Module-Unlock` (sama semua `/money/*`) |
| Scope | Workspace money aktif |
| Couple | Kedua person boleh baca semua audit money workspace |
| Envelope | `{ "data": … }` / error `{ "data": null, "error": { "code", "message" } }` |

---

## 1. Write-side (wajib, otomatis di BE)

Setiap endpoint di bawah **harus** menghasilkan ≥1 baris `AuditLog` dalam transaksi DB yang sama (atau immediately setelah commit sukses).

| `entityType` | Endpoint trigger | `action` |
|--------------|------------------|----------|
| `transaction` | `POST` / `PATCH` / `DELETE` `/money/transactions` | create / update / delete |
| `transfer` | `POST` / `PATCH` / `DELETE` `/money/transfers` | create / update / delete |
| `cash_withdrawal` | `POST` / `PATCH` / `DELETE` `/money/cash-withdrawals` | create / update / delete |
| `opening_balance` | `POST` `/money/opening-balances` | create — per item **atau** 1 log batch dengan `after.items[]` |
| `balancing_adjustment` | `POST` `/money/balancing/adjust` | create |
| `category` | `POST` / `PATCH` / `DELETE` `/money/categories` | create / update / delete |
| `pocket` | `POST` / `PATCH` / `DELETE` `/money/pockets` (+ archive / unarchive) | create / update / delete |
| `account` | `POST` / `PATCH` / `DELETE` `/money/accounts` | create / update / delete |
| `debt` | `POST` / `PATCH` / `DELETE` `/money/debts` | create / update / delete |
| `debt_payment` | `POST` `/money/debts/:id/payments` (+ `DELETE` jika ada) | create / delete |

### Actor

- `actorPersonId` + `actorName` dari user login → map ke `Person.userId` di workspace.
- Jika person belum ter-map: fallback `actorUserId` + display name dari user record; `actorPersonId` boleh `null` hanya dalam kasus itu (dokumentasikan).

### `summary` (wajib)

String human-readable untuk kolom list FE, tanpa parse JSON. Contoh:

- `Catat pengeluaran Makan Rp 85.000`
- `Ubah pengeluaran Makan Rp 85.000 → Rp 90.000`
- `Hapus transfer ke Ayu Rp 3.000.000`
- `Sesuaikan saldo Transaksi · BCA (selisih Rp −50.000)`

### `before` / `after`

- `create`: `before: null`, `after: { …snapshot relevan }`
- `update`: snapshot field yang berubah (minimal) atau full DTO sebelum/sesudah
- `delete`: `before: { … }`, `after: null`

Simpan amount sebagai **integer rupiah**. Tanggal sebagai **date-only** `YYYY-MM-DD` bila relevan.

---

## 2. Read endpoints

### List

`GET /money/audit-logs`

**Query:**

| Param | Tipe | Keterangan |
|-------|------|------------|
| `q` | string | cari di `summary`, `actorName`, `entityId` |
| `actorPersonId` | number/string | filter siapa |
| `entityType` | enum | lihat di bawah |
| `entityId` | string | deep link dari baris transaksi / entity |
| `action` | `create` \| `update` \| `delete` | |
| `from` | `YYYY-MM-DD` | inclusive (berdasarkan `createdAt` lokal / date-only) |
| `to` | `YYYY-MM-DD` | inclusive |
| `page` | number | default 1 |
| `pageSize` | number | default 20 |

**`entityType` enum v1:**

`transaction` | `transfer` | `cash_withdrawal` | `opening_balance` | `balancing_adjustment` | `category` | `pocket` | `account` | `debt` | `debt_payment`

**Response `data`:**

```json
{
  "items": [
    {
      "id": "1",
      "createdAt": "2026-07-26T10:00:00.000Z",
      "actorPersonId": 1,
      "actorName": "Irfan",
      "action": "update",
      "entityType": "transaction",
      "entityId": "55",
      "summary": "Ubah pengeluaran Makan Rp 85.000 → Rp 90.000",
      "before": { "amount": 85000, "date": "2026-07-26", "note": "Makan siang" },
      "after": { "amount": 90000, "date": "2026-07-26", "note": "Makan siang" }
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 42
}
```

Pagination di dalam `data` (bukan top-level `meta`) — konsisten admin audit.

Sort default: `createdAt` **desc**.

### Detail

`GET /money/audit-logs/:id`

Response: satu item (sama shape). `before` / `after` lengkap.  
404 jika tidak ada / di luar workspace.

---

## 3. Relasi dengan Admin Audit (opsional v1)

Fan-out event penting ke `GET /admin/audit-logs` dengan `moduleId: "money"` **tidak wajib** v1.  
Money Track punya UX audit sendiri untuk pasangan.

---

## 4. Enrichment opsional (follow-up)

Di DTO transaksi / activity, field opsional:

| Field | Keterangan |
|-------|------------|
| `createdByPersonName` | Display name actor create (selain `createdByPersonId`) |

FE bisa menampilkan “Dibuat oleh …” di modal edit tanpa hit audit list.

---

## 5. Acceptance criteria

- [ ] Setiap write path di tabel §1 menghasilkan ≥1 baris audit dengan `actorName` benar dari user login
- [ ] `GET /money/audit-logs` filter `q`, `actorPersonId`, `entityType`, `entityId`, `action`, `from`, `to` bekerja
- [ ] Pagination `page` / `pageSize` / `total` akurat
- [ ] `GET /money/audit-logs/:id` mengembalikan before/after lengkap
- [ ] Couple: person A melihat log yang dibuat person B di workspace yang sama
- [ ] Tanpa unlock → 401/403 sesuai gate modul existing
- [ ] `summary` selalu terisi string non-kosong

---

## 6. FE wiring (referensi)

| FE | Path |
|----|------|
| Halaman | `/money/audit` |
| Client | `fetchMoneyAuditLogs` / `fetchMoneyAuditLogDetail` di `moneyApi.ts` |
| Deep link | `/money/audit?entityType=transaction&entityId=55` dari list transaksi |
