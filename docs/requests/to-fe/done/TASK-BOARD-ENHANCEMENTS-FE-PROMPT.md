# TASK-BOARD-ENHANCEMENTS-FE-PROMPT

Prompt FE untuk integrasi enhancement Task Board. BE sudah live (naik bareng catatan deploy `deploy/releases/pending/2026-09-29-task-board-enhancements.md`).

**Status FE: sudah diimplementasi (2026-09-29)** — lihat `family-tree-fe/docs/requests/from-be/done/TASK-BOARD-ENHANCEMENTS-FE-PROMPT.md` (audit awal, catatan per file, dan hasil validasi E2E). Prompt di bawah dipertahankan sebagai arsip kontrak.

Kontrak resmi: [`docs/reference/TASK-BOARD-API.md`](../../../reference/TASK-BOARD-API.md). Spek asal: [`TASK-BOARD-enhancements.md`](../../from-fe/done/TASK-BOARD-enhancements.md).

## 1. Status "Done" hilang

- Nilai status sekarang hanya `To-Do`, `In Progress`, `Merged`.
- Ganti semua label/dropdown/kolom "Done" jadi "Merged". Hapus tipe `'Done'` dari union FE.
- Backend melebur task lama berstatus `Done` menjadi `Merged`, jadi badge/label lama otomatis hilang.
- Kalau masih ada kode yang mengirim `"Done"`, backend balas `422`: `status "Done" sudah tidak dipakai. Status yang valid: To-Do, In Progress, Merged.`

## 2. Deskripsi jadi array

- Model baru: `descriptions: [{ id, title, content }]`. Field `description` (string) masih dikirim backend (isi deskripsi pertama) untuk kompatibilitas, tapi jangan dipakai untuk menulis lagi — pakai `descriptions`.
- Form create/edit: input deskripsi jadi list (minimal 1 baris), tiap baris punya `title` dan `content` (TipTap).
- Kirim field `descriptions` lengkap saat `PUT`. Aturan backend:
  - entri dengan `id` milik task itu → di-update,
  - entri tanpa `id` → ditambah baru,
  - entri lama yang tidak dikirim → dihapus.
  Jadi tombol "hapus deskripsi" cukup membuang entri dari array sebelum PUT.
- Jangan kirim `descriptions` dan `description` bersamaan → `422`.
- `descriptions: []` juga `422` (`descriptions minimal berisi satu entri.`).
- Task lama: deskripsi lamanya otomatis muncul sebagai satu entri berjudul `Deskripsi`.

## 3. Migration files

- Field baru `migration_files: string[]` di Task dan di body create/update.
- Validasi backend: nama file (tanpa `/` atau `\`), ekstensi `.ts`, `.js`, atau `.sql`, maksimal 50 entri, duplikat dibuang otomatis. Kirim `[]` untuk mengosongkan.
- UI: input tag/chips sederhana; tampilkan di detail task dan badge jumlah di list.

## 4. Revisi (parent/child)

- Field `parent_task_id` di body create/update.
- Aturan backend: task induk harus ada, milik user yang sama, dan berstatus `Merged`. Selain itu `422`.
- Di `/task-board` buat aksi **"Buat revisi"** yang hanya muncul saat task berstatus `Merged` (misal di detail page), mengirim `parent_task_id` task tersebut.
- Tandai task revisi di list/detail (chip "Revisi dari #12").
- `GET /tasks/:id` sekarang mengembalikan `parent_task` (detail task induk atau `null`) dan `revisions` (array anak), jadi tidak perlu request tambahan.
- Ada juga `GET /tasks/:id/revisions` kalau daftar anak diambil terpisah.
- `parent_task_id: null` di `PUT` = melepas relasi revisi.
- Hapus task induk tidak menghapus revisinya — revisi kehilangan induk (`parent_task_id` jadi `null`).

## 5. History status + notes

- `GET /api/v1/tasks/:id/history` → array `{ id, status, notes, changed_at }`, terbaru lebih dulu.
- `GET /api/v1/tasks/:id` juga sudah menyertakan `history`, `parent_task`, dan `revisions` — pakai ini untuk halaman detail supaya cukup satu request.
- Saat menekan tombol ubah status, tampilkan dialog opsional untuk menulis catatan, lalu kirim:
  - `PUT /api/v1/tasks/:id` dengan `{ "status": "In Progress", "notes": "MR sudah dibuka" }` (alias `statusNotes` juga diterima).
- Backend otomatis menulis entri history saat status berubah; notes ikut tersimpan. Kalau status tidak berubah, tidak ada entri baru.
- UI: timeline kecil di detail task (badge status + catatan + waktu). Riwayat bisa panjang, ambil dari endpoint history kalau detail sudah padat.
- Saat create, task pertama punya satu entri history (`To-Do` atau status yang dikirim, plus `notes` kalau ada).

## 6. Ringkasan perubahan request/response

| Lama | Sekarang |
|---|---|
| `description: string` | `descriptions: [{ id, title, content }]` (+ `description` dipertahankan untuk baca) |
| status maksimal `Done` | status maksimal `Merged` |
| — | `migration_files: string[]` |
| — | `parent_task_id`, `parent_task`, `revisions` |
| — | `history` + `GET /tasks/:id/history` |
| `POST /tasks` wajib kirim `status` | `status` opsional (default `To-Do`) |
| — | `notes` / `statusNotes` di POST/PUT untuk catatan status |

## 7. Yang paling cepat diverifikasi

1. Create task tanpa `descriptions` → `422`.
2. Create task baru tanpa `status` → `201`, status `To-Do`, `history` panjang 1.
3. Ubah status ke `In Progress` + `notes` → `history` nambah dan notes tersimpan.
4. Task itu ke `Merged`, lalu buat task baru dengan `parent_task_id` task tersebut → `201`, `parent_task` terisi di detail.
5. Coba `parent_task_id` task yang masih `To-Do` → `422` dengan pesan induk belum `Merged`.
6. Kirim `migration_files: ["20260929100000_alter_task_board_enhancements.ts"]` → tersimpan dan muncul di response.
