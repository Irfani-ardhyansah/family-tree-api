# Prompt: Owner-only Update/Delete — Events & Memoriam Tributes

## Konteks

FamilyRoots API v1. FE sudah punya:

- Events: `POST` / `PATCH` / `DELETE` `/api/v1/events` (+ list/detail)
- Memoriam: `POST` tribute `/api/v1/memoriam/:deceasedId/tributes` (+ list/detail/prayers)

Yang kurang:

1. **Ownership gate** untuk update/delete event (saat ini doc bilang semua member login boleh CRUD — itu diganti)
2. **Update + Delete tribute** (endpoint belum ada)
3. Field / flag supaya FE bisa tampilkan tombol Edit/Hapus hanya untuk pemilik

Semua endpoint tetap wajib query `focusPersonId` sesuai konvensi existing.

---

## Keputusan produk

| Resource | Create | Update / Delete | Siapa boleh |
|----------|--------|-----------------|-------------|
| **Event** | sudah (semua member login) | `PATCH` + `DELETE` (endpoint sudah ada) | hanya `createdById === selfPersonId` |
| **Tribute** (memoriam) | sudah | `PATCH` + `DELETE` (**belum ada**) | hanya `authorId === selfPersonId` |

Catatan:

- Halaman memorial sendiri tidak di-CRUD (itu orang meninggal dari tree). Yang di-CRUD adalah **tribute**.
- BE wajib enforce ownership (jangan andalkan FE saja).
- FE butuh flag helper: `canManage: boolean` supaya UI tidak tebak-tebakan.

---

## 1) Events — ubah aturan ownership

### Perubahan produk

- **Create event**: tetap semua member login (tanpa gate `isLegal`)
- **Update / Delete event**: **hanya creator** (`createdById === JWT selfPersonId`)
- Orang lain: list/detail tetap sesuai aturan akses existing (`canAccessEvent` / restricted), tapi **tidak** boleh edit/hapus

### Schema / response

Tambahkan ke `ApiEvent` (list + detail):

```ts
{
  id: number
  // ...field existing...
  createdById: number          // person id pembuat
  canManage: boolean           // true jika viewer (selfPersonId) === createdById
}
```

Saat `POST /events`, set `createdById = selfPersonId` dari JWT (bukan dari body client).

### Endpoint (sudah ada, tighten authz)

| Method | Path | AuthZ |
|--------|------|--------|
| PATCH | `/api/v1/events/:id?focusPersonId=` | hanya creator |
| DELETE | `/api/v1/events/:id?focusPersonId=` | hanya creator |

Body PATCH: sama seperti create (`EventWritePayload`), partial atau full — samakan dengan implementasi create existing.

DELETE response:

```json
{ "data": { "deleted": true } }
```

### Error codes

| Code | HTTP | Kapan |
|------|------|--------|
| `EVENT_NOT_FOUND` | 404 | id tidak ada / tidak visible |
| `EVENT_MANAGE_FORBIDDEN` | 403 | login tapi bukan creator (update/delete) |
| `EVENT_ACCESS_FORBIDDEN` | 403 | tetap untuk detail restricted (bukan owner gate) |
| `EVENT_VALIDATION_FAILED` | 400 | validasi body |

Jangan pakai `EVENT_ACCESS_FORBIDDEN` untuk kasus “bukan creator”; pakai `EVENT_MANAGE_FORBIDDEN` biar FE bisa bedakan pesan.

### Seed

Backfill `createdById` untuk event seed existing (mis. assign ke person yang masuk akal / admin seed). Pastikan `canManage` benar saat login demo `MIA210399` (self id 83).

---

## 2) Memoriam tributes — tambah Update + Delete

### Perubahan produk

- **Create tribute**: tetap (author = selfPersonId)
- **Update / Delete tribute**: **hanya author** (`authorId === selfPersonId`)
- Akses memorial existing tetap berlaku dulu (`canAccessMemorial`); baru cek ownership untuk write

### Endpoints baru

| Method | Path |
|--------|------|
| PATCH | `/api/v1/memoriam/:deceasedId/tributes/:tributeId?focusPersonId=` |
| DELETE | `/api/v1/memoriam/:deceasedId/tributes/:tributeId?focusPersonId=` |

### Request body PATCH

Sama spirit dengan create:

```json
{
  "content": "<p>teks HTML disanitasi</p>",
  "mediaIds": ["uuid-optional"],
  "photoUrls": ["legacy-optional"]
}
```

Aturan media:

- Ikuti kontrak media upload existing (`memoriam_tribute`)
- Max **8 foto** per tribute tetap berlaku setelah update
- Jika FE kirim `mediaIds`, prefer **replace-all** dari daftar final yang dikirim FE (bukan merge diam-diam)

### Response

- PATCH: kembalikan **single tribute** yang diupdate
- DELETE:

```json
{ "data": { "deleted": true } }
```

### Response tribute (list + create + update)

Pastikan field ini ada:

```ts
{
  id: number
  deceasedId: number
  authorId: number
  authorName?: string
  content: string
  photoUrls: string[]
  createdAt: string
  updatedAt: string
  canManage: boolean   // authorId === selfPersonId
}
```

### Error codes

| Code | HTTP | Kapan |
|------|------|--------|
| `MEMORIAL_ACCESS_FORBIDDEN` | 403 | tidak punya akses memorial |
| `TRIBUTE_NOT_FOUND` | 404 | tributeId tidak ada / bukan milik deceasedId itu |
| `TRIBUTE_MANAGE_FORBIDDEN` | 403 | login + akses memorial, tapi bukan author |
| `TRIBUTE_VALIDATION_FAILED` | 400 | content kosong / >8 foto / HTML invalid, dll |
| `MEMORIAL_NOT_DECEASED` | 400 | tetap seperti existing |

### Bonus (opsional tapi helpful)

Perbaiki `POST .../tributes` agar response-nya **single created tribute** (bukan full list), supaya FE tidak perlu `reduce` by max id. Kalau breaking, boleh tetap list + tambah field `created` di response.

---

## 3) Acceptance / smoke test

Login demo `MIA210399` → token → `selfPersonId = 83`.

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"code":"MIA210399"}' | jq -r '.data.accessToken')

# 1) Create event → response punya createdById=83, canManage=true
# 2) PATCH/DELETE event itu → 200
# 3) Login user lain → PATCH/DELETE event milik 83 → 403 EVENT_MANAGE_FORBIDDEN
# 4) List events → hanya event milik viewer yang canManage=true

# 5) Create tribute → authorId=83, canManage=true
# 6) PATCH/DELETE tribute itu → 200
# 7) User lain (punya akses memorial) → PATCH/DELETE → 403 TRIBUTE_MANAGE_FORBIDDEN
# 8) User tanpa akses memorial → 403 MEMORIAL_ACCESS_FORBIDDEN
```

---

## 4) Deliverables yang diharapkan dari BE

1. Migration/backfill `created_by_id` (atau setara) di tabel events
2. Enforce ownership di service layer (bukan cuma controller)
3. Endpoint `PATCH` / `DELETE` tributes
4. Field `createdById` + `canManage` di event; `canManage` (+ `updatedAt`) di tribute
5. Update docs / OpenAPI / error code list
6. Seed + smoke test di atas hijau

Tolong balas dengan:

- final request/response sample JSON
- apakah PATCH tribute replace-all media atau merge
- apakah response POST tribute akan diubah ke single object

---

## Status implementasi (BE)

- [x] Ownership gate event PATCH/DELETE + `createdById` / `canManage` (kolom `created_by_person_id` sudah ada; seed sudah assign)
- [x] Tribute PATCH/DELETE + `canManage` / `deceasedId` / `updatedAt`
- [x] Media tribute PATCH = **replace-all**
- [x] POST tribute response = **single** `{ tribute }`
- [x] Error codes baru + docs/Postman/audit logs
