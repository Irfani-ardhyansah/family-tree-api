# Prompt BE — Task Board: tanggal deskripsi, edit per-deskripsi, filter tanggal

> Request **FE → BE**. Status: ✅ **Implemented** (bagian 1) — bagian 2 & 3 opsional.
>
> Related: [`TASK-BOARD-API.md`](./TASK-BOARD-API.md),
> [`TASK-BOARD-enhancements.md`](./TASK-BOARD-enhancements.md).

---

## 1. Tanggal per deskripsi (Implement ✅)

### Konteks

Halaman detail task menampilkan tiap deskripsi sebagai kartu. FE butuh **tanggal**
(`created_at` / `updated_at`) di kartu deskripsi — kolomnya **sudah ada** di
`tb_task_descriptions` (`timestamps(true, true)`), tapi response API belum
mengirimkannya karena `hydrate()` hanya men-`select` `id, task_id, title, content`.

### Perubahan

`GET /tasks` dan `GET /tasks/:id` sekarang mengembalikan tiap entri `descriptions`
beserta timestamp:

```json
{
  "descriptions": [
    {
      "id": 15,
      "title": "Konteks",
      "content": "<p>…</p>",
      "created_at": "2026-09-29T15:55:42.000Z",
      "updated_at": "2026-09-29T15:55:57.000Z"
    }
  ]
}
```

- Tidak ada migrasi baru (kolom sudah ada).
- Perubahan: `src/modules/task-board/task-board.repository.ts` — tambah
  `created_at`/`updated_at` di `TaskDescriptionRow`, `select`, dan mapping
  `hydrate()`.

---

## 2. Edit satu deskripsi (pakai endpoint yang ada)

FE sudah bisa edit **satu entri deskripsi** tanpa endpoint baru: kirim ulang
seluruh array `descriptions` (dengan `id`) lewat `PUT /tasks/:id`, isi yang tidak
berubah tetap dikirim dengan `id`-nya sehingga BE hanya meng-update yang berubah
(diff sudah ada di `diffDescriptions`) dan menulis entri history
`description_updated`.

Contoh body:

```json
{
  "descriptions": [
    { "id": 15, "title": "Konteks", "content": "<p>isi baru</p>" },
    { "id": 16, "title": "Langkah", "content": "<p>…</p>" }
  ]
}
```

### Opsional — endpoint khusus

Kalau mau lebih hemat dan aman (tidak men-resend seluruh deskripsi):

### `PATCH /tasks/:id/descriptions/:descriptionId`

Body: `{ "title"?: string, "content"?: string }` (minimal salah satu).
Balikan deskripsi yang diupdate (`200`). Validasi:

- `descriptionId` harus milik task ini (kalau tidak → `404 NOT_FOUND`).
- Tulis entri history `description_updated` (notes = judul deskripsi).

---

## 3. Opsional — filter tanggal di `GET /tasks`

Halaman list punya filter tanggal (berdasarkan `updated_at`). Saat ini FE filter
**client-side** (semua task di-fetch lalu disaring), jadi belum butuh BE. Kalau
nanti data membesar, tambahkan query:

| Param | Contoh | Ket |
|-------|--------|-----|
| `from` | `2026-10-01` | `updated_at >= from` (date-only, inklusif) |
| `to` | `2026-10-08` | `updated_at <= to` (date-only, inklusif) |

Balikan tetap `Task[]`.

---

## Acceptance

- `GET /tasks` / `GET /tasks/:id` → setiap deskripsi punya `created_at` &
  `updated_at` (ISO 8601). ✅
- `PUT /tasks/:id` dengan subset `descriptions` (id dipertahankan) hanya
  meng-update entri yang berubah + menulis history. ✅ (sudah ada)
- (Opsional) `PATCH /tasks/:id/descriptions/:descriptionId` dan filter `from`/`to`.
