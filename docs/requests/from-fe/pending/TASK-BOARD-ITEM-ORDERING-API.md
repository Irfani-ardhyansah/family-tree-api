# Rencana API — Urutan Penjelasan (descriptions) & Todo di Detail Task

Status: **draft, menunggu review FE → BE**
Tanggal: 2026-10-09
Modul BE terkait: `family-tree-api` — Task Board
Kontrak resmi saat ini: `family-tree-api/docs/reference/TASK-BOARD-API.md`
Terkait: `TASK-BOARD-ORDERING-API.md` (urutan list task di halaman awal)

---

## 1. Latar belakang

Di halaman detail task, daftar **Penjelasan Task** (descriptions) dan **Todo**
sekarang bisa di-drag untuk diubah urutannya (FE sudah jalan dengan cadangan
lokal). Supaya urutan tersimpan di server dan konsisten antar perangkat,
dibutuhkan dukungan BE.

Saat ini:

- `descriptions` dikirim sebagai **array** di `POST/PUT /tasks/:id`, tapi tidak
  ada jaminan urutan array dipakai saat disimpan/dibaca kembali.
- `todos` punya endpoint per-item (`POST`/`PATCH`/`DELETE /tasks/:id/todos/:todoId`)
  tapi belum ada cara menyimpan urutannya.

---

## 2. Model data

### 2.1 `task_descriptions`

Tambah kolom `sort_order` (integer, `NOT NULL DEFAULT 0`).
Index: `(task_id, sort_order)`.

### 2.2 `task_todos`

Tambah kolom `sort_order` (integer, `NOT NULL DEFAULT 0`).
Index: `(task_id, sort_order)`.

> "task_id" mengacu ke parent task; todo memang 1 task → banyak todo.

### 2.3 Aturan nilai

- Saat **create** entri baru (deskripsi/todo): `sort_order = COALESCE(MAX(sort_order) + 1, 0)`
  untuk parent yang sama → entri baru muncul di paling bawah.
- Urutan bersifat **relatif**; gap setelah delete boleh dibiarkan.
- `GET /tasks/:id` dan endpoint list terkait mengembalikan `sort_order` dan
  **diurutkan** `ORDER BY sort_order ASC, id ASC`.

---

## 3. Endpoint

### 3.1 `PUT /tasks/:id/descriptions/reorder`

**Request**

```json
{ "order": [31, 27, 35] }
```

- `order`: array `id` description milik task tersebut, urut atas→bawah.
- Semua id harus milik `:id` (task) dan user pemilik.

**Perilaku**

- Set `sort_order = 0..n-1` sesuai posisi.
- Idempotent.
- Tidak mengubah `title`/`content`, **tidak membuat entri riwayat aktivitas**
  (reorder bukan perubahan konten).

**Respons (200)**

```json
{
  "data": {
    "items": [
      { "id": 31, "title": "…", "content": "…", "sort_order": 0 },
      { "id": 27, "title": "…", "content": "…", "sort_order": 1 }
    ]
  }
}
```

### 3.2 `PUT /tasks/:id/todos/reorder`

**Request**

```json
{ "order": [5, 2, 8] }
```

**Perilaku**

- Set `sort_order = 0..n-1` untuk todo task tersebut.
- Idempotent, tidak mengubah `is_done`/`title`/`description`.

**Respons (200)**

```json
{
  "data": {
    "items": [
      { "id": 5, "title": "…", "is_done": false, "sort_order": 0 },
      { "id": 2, "title": "…", "is_done": true, "sort_order": 1 }
    ]
  }
}
```

### 3.3 Error

| Status | Kapan | Pesan contoh |
|---|---|---|
| 422 | `order` bukan array / kosong / non-integer / duplikat, atau tidak memuat tepat semua id milik task | `order harus array id dan tidak boleh kosong.` · `order memuat id duplikat.` · `order harus memuat tepat semua id penjelasan task ini.` |
| 401 | Belum login | — |

---

## 4. Hubungan dengan `PUT /tasks/:id` (penting)

FE **tidak lagi** mengandalkan urutan array `descriptions` di `PUT /tasks/:id`
untuk mengubah urutan (memakai endpoint reorder di §3). Tetap disarankan:

- `PUT /tasks/:id` dengan `descriptions` **tetap menerima array** untuk
  tambah/ubah/hapus seperti biasa (lihat kontrak lama).
- Urutan array input di `PUT /tasks/:id` **boleh diabaikan** (urutan ditentukan
  oleh `sort_order`/endpoint reorder). Asalkan entri baru tetap dapat
  `sort_order` terbesar.
- Jangan buat entri riwayat hanya karena urutan array berubah.

Keputusan ini menghindari riwayat aktivitas palsu saat user hanya menggeser.

---

## 5. Migrasi + backfill

1. `ALTER TABLE task_descriptions ADD COLUMN sort_order INT NOT NULL DEFAULT 0`.
2. `ALTER TABLE task_todos ADD COLUMN sort_order INT NOT NULL DEFAULT 0`.
3. Backfill (idempotent): untuk tiap `task_id`, urutkan entri berdasarkan
   `created_at ASC, id ASC` (urutan tampil saat ini) → set `sort_order = 0..n-1`.
4. Buat index `(task_id, sort_order)`.
5. Rollback: drop index → drop column.

**Aman**: aditif, tidak menghapus data, tidak mengubah kolom lama.

---

## 6. Deploy ke STB

Catatan di `family-tree-api/deploy/releases/pending/` harus mencakup:

- 2 kolom `sort_order` + backfill.
- 2 endpoint reorder.
- `GET /tasks/:id` mengurutkan descriptions & todos by `sort_order`.
- Sifat: additive + backfill, tanpa downtime.
- Verifikasi: tidak ada `sort_order` duplikat per parent setelah backfill.

---

## 7. Kondisi FE saat ini (sementara)

Supaya bisa dicoba sebelum BE rilis:

- Drag & drop di detail task sudah jalan; urutan disimpan di `localStorage`
  (`task-board:description-order:<taskId>` dan `task-board:todo-order:<taskId>`).
- FE tetap memanggil `PUT /tasks/:id/descriptions/reorder` dan
  `PUT /tasks/:id/todos/reorder`. Kalau endpoint belum ada (404), error
  diabaikan dan urutan lokal tetap dipakai.
- Setelah BE rilis, urutan otomatis tersinkron tanpa ubah komponen.

---

## 8. Pertanyaan untuk reviewer

1. Setuju pakai 2 endpoint `.../descriptions/reorder` & `.../todos/reorder`,
   atau lebih suka satu endpoint gabungan `PATCH /tasks/:id/item-order`?
2. Urutan array `descriptions` di `PUT /tasks/:id`: diabaikan (rekomendasi)
   atau tetap dihormati?
3. Reorder harus bebas dari entri riwayat — benar?

---

## 9. Checklist uji manual (setelah BE live)

1. `GET /tasks/:id` mengembalikan `sort_order` pada descriptions & todos.
2. Reorder 3 penjelasan → reload → urutan tetap.
3. Reorder 3 todo → reload → urutan tetap.
4. Tambah penjelasan/todo baru → muncul di paling bawah.
5. Hapus entri di tengah → urutan sisanya tetap benar.
6. Reorder beberapa kali → riwayat aktivitas **tidak** bertambah.
7. Kirim id milik task/user lain → `404` dengan pesan jelas.
8. Kirim id duplikat → `422`.
