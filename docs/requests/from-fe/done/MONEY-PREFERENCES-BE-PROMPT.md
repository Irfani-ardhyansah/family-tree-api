# Prompt BE — User Preferences API (Money Track)

> Request **FE → BE**. Status: ✅ **Implemented**.
>
> Kontrak: `GET /money/preferences`, `PUT /money/preferences`.
> Related: [`MONEY-TRACK-API.md`](./MONEY-TRACK-API.md).

---

## 1. Konteks

Halaman FE **Pengaturan** (`/money/settings`) menyimpan preferensi user, dan
form **Catat Transaksi** memakainya untuk auto-pilih kantong/kategori + preset
nominal.

- User menetapkan **kantong default pengeluaran** → tiap buka form Catat,
  kantong itu otomatis terpilih (masih bisa diganti manual).
- **Override per-person** dipakai saat scope = person (mode couple); kalau tidak
  ada override → pakai default `shared`.

---

## 2. Endpoint

Auth + header `X-Module-Unlock` sama seperti route `/money/*` lain
(`requireAuth` + `requireModuleUnlock('money')`).

### `GET /money/preferences`

Balikan preferensi workspace user yang login. Jika belum pernah disimpan,
balikan objek default (HTTP 200, bukan 404).

### `PUT /money/preferences`

Body = objek preferensi utuh (replace), lalu balikan objek tersimpan.

### Response / body shape

```json
{
  "defaultTxType": "expense",
  "quickAmounts": [10000, 20000, 50000, 100000, 200000],
  "shared": {
    "expensePocketId": 101,
    "incomePocketId": 102,
    "expenseCategoryId": 3,
    "incomeCategoryId": 10
  },
  "persons": {
    "1": {
      "expensePocketId": 101,
      "incomePocketId": 102,
      "expenseCategoryId": 3,
      "incomeCategoryId": 10
    }
  }
}
```

| Field | Tipe | Ket |
|-------|------|-----|
| `defaultTxType` | `"expense"` \| `"income"` | Tipe yang aktif saat form dibuka |
| `quickAmounts` | `number[]` | Preset nominal numpad, digit rupiah, maks 6 |
| `shared` | object | Default scope "Gabungan" |
| `shared.expensePocketId` | `number \| null` | Kantong default pengeluaran |
| `shared.incomePocketId` | `number \| null` | Kantong default pemasukan |
| `shared.expenseCategoryId` | `number \| null` | Kategori default pengeluaran |
| `shared.incomeCategoryId` | `number \| null` | Kategori default pemasukan |
| `persons` | `Record<personId, object>` | Override per-person; shape sama `shared` |

Aturan:

- `null` = tidak ada default (FE fallback ke opsi pertama).
- `quickAmounts` di-dedupe, hanya angka > 0, dibatasi **6** item; kosong → default.
- ID pocket/category yang **bukan milik workspace / archived / tipe salah**
  dinormalkan jadi `null` (bukan error).
- Key `persons` yang bukan person workspace dilewati (bukan error).
- Key `persons` = `mt_persons.id` (bukan `userId`).

---

## 3. Implementasi

- Tabel baru **`mt_preferences`** (1 baris per workspace, FK `workspace_id →
  mt_workspaces.id` ON DELETE CASCADE, unique per workspace). Override per-person
  disimpan di kolom JSON `persons`.
- Migration: `src/database/migrations/20261008100000_create_mt_preferences.ts`.
- Modul: `src/modules/money-track/preferences/`
  - `preferences.controller.ts` — `get`, `update`
  - `preferences.service.ts` — validasi + sanitasi ID, resolve workspace
  - `preferences.repository.ts` — upsert 1 baris per workspace
  - `preferences.helpers.ts` — normalisasi JSON/nominal + mapping DTO (+ unit test)
- Route terdaftar di `money.routes.ts` (setelah `/categories`).

### Acceptance (terpenuhi)

- `GET` mengembalikan default bila belum ada data (200).
- `PUT` menyimpan replace penuh dan mengembalikan objek tersimpan.
- ID tidak valid → `null`, bukan error.
- `quickAmounts` dedupe + limit 6.
- Sejalan dengan pola auth `/money/*`.
