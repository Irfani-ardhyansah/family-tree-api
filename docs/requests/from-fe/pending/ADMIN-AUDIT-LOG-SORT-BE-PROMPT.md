# Prompt BE — Admin Audit Log: urutan waktu `asc` / `desc`

Status: **draft, menunggu review FE → BE**
Tanggal: 2026-10-12
Modul BE terkait: `family-tree-api` — Admin Panel (Audit Log)
Kode acuan: `src/modules/core/admin/admin-audit.service.ts`,
`admin-audit.repository.ts`, `admin.types.ts`

---

## 1. Latar belakang

Halaman **Audit Log** (`/admin/audit-logs` di FE) sekarang selalu menampilkan
log **terbaru dulu**. Repository BE mengunci urutan itu secara hardcode:

```ts
// src/modules/core/admin/admin-audit.repository.ts — findByFilters()
.orderBy('occurred_at', 'desc')
.orderBy('source', 'asc')
.orderBy('id', 'desc')
```

FE menambahkan kontrol **"Terbaru / Terlama"** (dan klik header kolom
`Waktu`), jadi butuh parameter urutan dari BE. Selain itu, karena FE memakai
pagination server-side, urutan **harus** ditentukan BE (tidak bisa di-sort di
client).

Dua permintaan FE lain di halaman yang sama **tidak butuh** perubahan BE:
- Nomor halaman (pagination) → murni FE.
- Filter user berupa input pencarian → FE memakai `GET /admin/users?for=broadcast`
  yang sudah mengembalikan semua user, lalu difilter di client.

---

## 2. Perubahan yang diminta (aditif)

Tambah query param opsional **`sort`** di `GET /api/v1/admin/audit-logs`.

| Param | Nilai | Default | Catatan |
|---|---|---|---|
| `sort` | `asc` \| `desc` | `desc` | urutan kolom waktu (`occurred_at`). Absen = `desc` (perilaku lama, tidak breaking). |

Validasi: nilai selain `asc`/`desc` → `422 VALIDATION_ERROR` dengan pesan
jelas (konsisten dengan `moduleId`/`action` yang sudah divalidasi).

> Alternatif nama `order` juga boleh, mohon dikonfirmasi supaya FE
> menyesuaikan. FE saat ini mengirim `sort=asc|desc`.

---

## 3. Detail implementasi BE yang disarankan

### 3.1 `admin.types.ts`

```ts
export type AdminAuditSortOrder = 'asc' | 'desc';

export type AdminAuditLogQuery = {
  q?: string;
  userId?: number;
  moduleId?: string;
  action?: string;
  from?: string;
  to?: string;
  sort: AdminAuditSortOrder; // baru
  page: number;
  pageSize: number;
};
```

### 3.2 `admin-audit.service.ts` — `parseListQuery()`

```ts
const sortRaw = typeof query.sort === 'string' ? query.sort.trim() : '';
if (sortRaw && sortRaw !== 'asc' && sortRaw !== 'desc') {
  throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'sort harus "asc" atau "desc".');
}
const sort: AdminAuditSortOrder = sortRaw === 'asc' ? 'asc' : 'desc';

return { q, userId, moduleId, action, from, to, sort, page, pageSize };
```

### 3.3 `admin-audit.repository.ts` — `findByFilters()`

```ts
const direction = filters.sort === 'asc' ? 'asc' : 'desc';
return db
  .from(union)
  .orderBy('occurred_at', direction)
  .orderBy('source', 'asc')
  .orderBy('id', direction)
  .limit(filters.pageSize)
  .offset(offset)
  .select<UnifiedRow[]>('*');
```

Catatan: `countByFilters()` tidak terpengaruh `sort` (hanya hitung total), jadi
tidak perlu diubah.

---

## 4. Kontrak

### Request

```http
GET /api/v1/admin/audit-logs?sort=asc&page=1&pageSize=8
```

### Response (bentuk tetap)

```json
{
  "items": [
    { "id": 1, "timestamp": "2026-09-01T02:00:00.000Z", "userName": "Budi", "...": "..." }
  ],
  "pagination": { "page": 1, "pageSize": 8, "total": 128, "totalPages": 16 }
}
```

`items` diurutkan `occurred_at ASC` (paling lama dulu) saat `sort=asc`, dan
`occurred_at DESC` saat `sort=desc` / tidak dikirim.

---

## 5. Test yang diharapkan di BE

1. `GET /admin/audit-logs` tanpa `sort` → urutan `desc` (tidak breaking).
2. `GET /admin/audit-logs?sort=desc` → item pertama paling baru.
3. `GET /admin/audit-logs?sort=asc` → item pertama paling lama.
4. `sort=asc` + pagination: halaman 2 melanjutkan urutan asc (bukan reset desc).
5. `GET /admin/audit-logs?sort=foo` → `422` dengan pesan jelas.
6. `sort=asc` tetap menghormati filter `userId`, `moduleId`, `action`,
   `from`/`to`, dan `q`.

---

## 6. FE yang sudah disiapkan

| File | Perubahan |
|---|---|
| `src/modules/admin/api/adminApi.ts` | `AuditQuery.sort` + kirim `sort` ke query string |
| `src/modules/admin/pages/AuditLogPage.tsx` | Toggle "Terbaru/Terlama", header `Waktu` klik-untuk-sort, nomor halaman, dan filter user berupa combobox pencarian |

Selama BE belum rilis, `sort` yang dikirim FE akan diabaikan BE (default
`desc`); FE tidak error — hanya arah urutan belum berubah.
