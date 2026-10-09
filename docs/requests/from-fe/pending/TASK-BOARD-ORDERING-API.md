# Rencana API — Urutan manual & sortir tanggal Task Board

Status: **draft, menunggu review FE → BE**
Tanggal: 2026-10-09
Modul BE terkait: `family-tree-api` — Task Board
Kontrak resmi saat ini: `family-tree-api/docs/reference/TASK-BOARD-API.md`

---

## 1. Latar belakang / tujuan

Halaman awal Task Board (`/task-board`) menampilkan daftar task. Saat ini FE
selalu mengurutkan **menurut `updated_at` DESC** (lihat
`src/modules/task-board/pages/TaskListPage.tsx`). Belum ada cara untuk:

1. Mengubah urutan task secara manual (drag & drop).
2. Memilih arah sortir tanggal (terbaru / terlama).

Permintaan produk:

- Ada tombol/ikon **drag handle** di paling kiri tiap baris untuk
  drag & drop mengubah urutan.
- Ada **badge angka urutan** (1, 2, 3, …) di paling kiri baris.
- Sortir tanggal bisa **DESC** maupun **ASC**.

Sortir tanggal murni bisa dikerjakan di FE (data `GET /tasks` sudah memuat
`updated_at`). Yang **butuh kontrak API baru** adalah **urutan manual** agar
urutan yang digeser user tersimpan di server dan tidak hilang saat ganti
perangkat / muat ulang.

---

## 2. Keputusan desain (ringkas)

| Hal | Keputusan |
|---|---|
| Penyimpanan urutan | Kolom integer `sort_order` di tabel `tasks`, terpisah per pemilik (task memang per `person_id`). |
| Default list | `sort_order ASC`, tie-break `id ASC` / `updated_at DESC`. Task baru ditaruh di **paling bawah** (`sort_order = max + 1`). |
| Update urutan | Endpoint **bulk** `PUT /tasks/reorder` menerima array id berurutan — bukan N kali `PATCH`. |
| Sortir tanggal | FE (client-side) lewat toggle. Tidak wajib ubah API. Opsi query server disediakan sebagai *opsional* di §5. |
| Scope | Endpoint per pemilik task (konsisten dengan `GET /tasks` yang sudah owner-scoped). |

---

## 3. Perubahan kontrak API

### 3.1 Field baru pada Task

Tambahkan `sort_order` (integer ≥ 0) pada objek Task, minimal di
`GET /tasks`, `GET /tasks/:id`, `POST /tasks`, `PUT /tasks/:id`,
`PUT /tasks/reorder`.

```json
{
  "id": 12,
  "title": "Perbaiki validasi form",
  "status": "In Progress",
  "sort_order": 3,
  "updated_at": "2026-10-09T12:30:00.000Z"
}
```

### 3.2 `GET /tasks` — urutan default

- Default: `ORDER BY sort_order ASC, id ASC`.
- Semua task lama yang belum punya `sort_order` diisi saat migrasi
  (lihat §4) supaya tidak ada nilai `NULL`.
- Sorting tanggal tetap dilakukan FE. Kalau BE ingin menyediakan opsional,
  lihat §5.

### 3.3 `PUT /tasks/reorder` — endpoint baru (wajib)

Menyimpan urutan manual sekaligus untuk banyak task.

**Request**

```
PUT /api/v1/tasks/reorder
Content-Type: application/json
Authorization: Bearer <accessToken>

{
  "order": [12, 7, 15, 9]
}
```

- `order`: array id task, urut dari atas ke bawah. Semua id harus milik user
  yang login.
- FE mengirim **seluruh id task user** (urutan induk), bukan hanya yang
  terlihat setelah filter, supaya posisi task yang tersembunyi filter tidak
  melompat.

> **Catatan routing BE:** daftarkan `PUT /tasks/reorder` **sebelum** route
> berparameter `PUT /tasks/:id`, atau pastikan router memprioritaskan path
> statis. Kalau ragu, alternatif path: `PUT /tasks/order` /
> `POST /tasks/reorder` (pilih satu, jangan dua-duanya).

**Perilaku**

- `sort_order` task di-set `0..n-1` mengikuti posisi di array `order`.
- Operasi idempoten: mengirim ulang array yang sama menghasilkan state sama.
- Task yang ada di DB tapi tidak ada di array: `sort_order` dibiarkan.

**Respons sukses (200)**

```json
{
  "data": {
    "items": [
      { "id": 12, "sort_order": 0, "title": "…" },
      { "id": 7,  "sort_order": 1, "title": "…" }
    ]
  }
}
```

Format `items` konsisten dengan list yang sudah didukung FE
(`toTaskList` menerima array langsung atau `{ items }`).

**Error**

| Status | Kapan | Pesan contoh |
|---|---|---|
| 422 | `order` bukan array / kosong / non-integer / duplikat / id bukan milik user | `order harus array id dan tidak boleh kosong.` · `order[0] harus id berupa angka positif.` · `order memuat id duplikat.` · `Task #99 tidak ditemukan.` |
| 401 | Belum login | — |

---

## 4. Perubahan skema DB + migrasi

- Tambah kolom `sort_order` ke tabel `tasks`:
  - type: integer, `NOT NULL DEFAULT 0` (atau nullable lalu diisi, lalu `NOT NULL`).
  - index: `(person_id, sort_order)` untuk `GET /tasks`.
- Backfill: untuk tiap `person_id`, urutkan task lama berdasarkan
  `updated_at DESC, id DESC` lalu beri `sort_order = 0..n-1`.
- `POST /tasks`: set `sort_order = COALESCE(MAX(sort_order) + 1, 0)` untuk
  pemilik yang sama (task baru muncul paling bawah).
- `DELETE /tasks`: biarkan gap; nilai urutan bersifat relatif, tidak perlu
  dirapikan.
- Revisi (`parent_task_id`): ikut kolom yang sama; tidak butuh perlakuan
  khusus selain aturan create di atas.

Contoh nama migrasi (sesuaikan konvensi repo BE):
`20261009120000_add_sort_order_to_tasks.ts`.

---

## 5. Opsional — sortir tanggal di server

Kalau nanti daftar task besar dan ingin paging, sediakan query berikut
(tidak wajib untuk rilis pertama):

```
GET /tasks?sort=updated_at&order=desc
```

- `sort`: `updated_at` | `created_at`.
- `order`: `asc` | `desc`.
- Tanpa query → perilaku default §3.2.

FE saat ini menyortir tanggal di client, jadi bagian ini bisa ditunda.

---

## 6. Dampak / kompatibilitas

- FE lama yang tidak mengirim `sort_order` tetap aman: BE mengisi default dan
  task baru masuk paling bawah.
- `GET /tasks` FE lama tidak membaca `sort_order` → tetap tampil (sortir
  tanggal FE). Tidak ada breaking change.
- Endpoint `PUT /tasks/reorder` baru; tidak mengubah endpoint lama.

---

## 7. Deploy ke STB

Saat BE diimplementasi, ikuti skill/panduan deploy BE: tambahkan catatan
di `family-tree-api/deploy/releases/pending/` yang mencakup:

- File migrasi `add_sort_order_to_tasks`.
- Backfill data existing (jalankan migrasi → pastikan tidak ada `NULL`).
- Endpoint baru `PUT /tasks/reorder`.
- Perubahan urutan default `GET /tasks`.
- Sifat perubahan: **additive + backfill**, tidak perlu downtime.

---

## 8. Pertanyaan untuk reviewer

1. Setuju dengan `PUT /tasks/reorder` (bulk) vs `PATCH /tasks/:id` per task?
2. Path `PUT /tasks/reorder` aman terhadap tabrakan `PUT /tasks/:id`? Kalau
   tidak, mau pakai `PUT /tasks/order`?
3. Id di luar kepemilikan user: tolak `404` (rekomendasi) atau abaikan?
4. Task baru: paling bawah (rekomendasi) atau paling atas?
5. Perlu endpoint undo / reset ke default? (belum diminta)

---

## 9. Kondisi FE saat ini (sementara)

Supaya fitur bisa dicoba sebelum BE rilis, FE menyimpan urutan manual di
`localStorage` (`task-board:manual-order`) dan tetap mencoba memanggil
`PUT /tasks/reorder`. Kalau endpoint belum ada (404), FE memakai urutan lokal
dan menandai bahwa sinkronisasi server belum aktif. Setelah endpoint BE live,
urutan otomatis tersinkron tanpa perubahan kode FE tambahan.

---

## 10. Checklist uji manual (setelah BE live)

1. `GET /tasks` memuat `sort_order` di tiap item.
2. Geser 3 task di halaman awal → muat ulang → urutan tetap.
3. Logout/login akun lain → urutan akun lain tidak berubah.
4. Buat task baru → muncul di paling bawah.
5. Hapus task di tengah → urutan sisanya tetap relatif benar.
6. Kirim `order` berisi id task user lain → `404` dengan pesan jelas.
7. Kirim `order` dengan id duplikat → `422`.
8. Aktifkan filter status tipe lalu geser → posisi task yang tersembunyi filter
   tetap terjaga (urutan induk yang dikirim FE).
9. Sortir tanggal DESC/ASC berfungsi di FE (tanpa panggilan API).
