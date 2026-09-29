# task-board-enhancements

Tanggal: 2026-09-29

Enhancement modul Task Board: status "Done" dibuang (puncak status = "Merged"), task bisa punya banyak deskripsi (`descriptions`), menyimpan `migration_files`, relasi revisi parent/child (`parent_task_id`), plus riwayat status + notes.

Endpoint baru: `GET /api/v1/tasks/:id/history` (riwayat status, terbaru dulu) dan `GET /api/v1/tasks/:id/revisions` (daftar revisi). `GET /tasks/:id` sekarang mengembalikan `descriptions`, `migration_files`, `parent_task_id`, `parent_task`, `revisions`, dan `history`.

`PUT /tasks/:id` otomatis menulis entri history baru saat status berubah; notes dikirim lewat field `notes` (alias `statusNotes`) dan ikut disimpan di entri itu.

## Env

Tidak ada.

`RUN_SEED` tetap `false`. `SKIP_MIGRATE` tetap `false`.

## Migration

Ada. Jalan otomatis saat container start (`SKIP_MIGRATE` tetap `false`).

- `src/database/migrations/20260929100000_alter_task_board_enhancements.ts` — menambah `tb_tasks.parent_task_id` (FK ke `tb_tasks.id`, `ON DELETE SET NULL`) dan `tb_tasks.migration_files` (JSON), membuat tabel `tb_task_descriptions` dan `tb_task_history` (dengan index `task_id` / `changed_at`), melebur status `Done` → `Merged`, memindahkan isi `tb_tasks.description` ke `tb_task_descriptions` (judul "Deskripsi") lalu menghapus kolom itu, dan membuat satu entri history awal per task sesuai status terakhirnya. Idempotent — aman kalau dijalankan ulang.

`tb_tasks.description` hilang sebagai kolom, tapi API tetap mengembalikan field `description` (isi deskripsi pertama) supaya FE lama tidak error.

## Data awal

Tidak ada.

Data lama dipindah oleh migration, bukan seeder. Jangan set `RUN_SEED=true`.

## Cek setelah naik

```bash
curl -fsS http://localhost:3000/api/v1/health
```

Harapan: `{"status":"ok"}`.

```bash
curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/v1/tasks/1/history
```

Harapan: `401` (route hidup, butuh login). `404` berarti route history belum naik.

```bash
curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/v1/tasks/1/revisions
```

Harapan: `401` (route hidup, butuh login). `404` berarti route revisi belum naik.

```bash
curl -sS -o /dev/null -w "%{http_code}\n" -X POST -H 'Content-Type: application/json' -d '{"type":"Feature","title":"cek","branchName":"cek","status":"Done","descriptions":[{"title":"a","content":"b"}]}' http://localhost:3000/api/v1/tasks
```

Harapan: `401` (butuh login sebelum validasi jalan). Setelah login, status `Done` dijawab `422` dengan pesan bahwa "Done" sudah tidak dipakai.
