# task-board-workplaces

Tanggal: 2026-10-09

Tempat kerja (workplaces) untuk task board: tabel `tb_workplaces`, kolom `tb_tasks.workplace_id`, plus backfill data lama (task lama masuk ke tempat kerja default "Utama" milik pemiliknya).

- `GET /api/v1/workplaces` — daftar tempat kerja user (termasuk yang diarsipkan).
- `POST /api/v1/workplaces` — `{ name, employment_type, role?, location?, accent?, started_at?, ended_at? }`.
- `PUT /api/v1/workplaces/:id` — ubah.
- `PATCH /api/v1/workplaces/:id/archive` — arsipkan (boleh walau masih punya task).
- `PATCH /api/v1/workplaces/:id/unarchive` — pulihkan.
- `DELETE /api/v1/workplaces/:id` — hapus permanen, hanya kalau tidak punya task (`409 WORKPLACE_HAS_TASKS`).
- `GET /api/v1/tasks?workplace_id=` — filter task per tempat kerja; `POST/PUT /tasks` menerima `workplace_id`.

Tempat kerja default tidak bisa diarsipkan/dihapus (`422 DEFAULT_WORKPLACE_PROTECTED`).

## Env

Tidak ada.

`RUN_SEED` tetap `false`. `SKIP_MIGRATE` tetap `false`.

## Migration

Ada. Jalan otomatis saat container start (`SKIP_MIGRATE` tetap `false`).

- `src/database/migrations/20261009110000_create_task_board_workplaces.ts` — buat tabel `tb_workplaces` (`person_id` FK `ON DELETE CASCADE`, `name`, `employment_type` ENUM, `role`, `location`, `accent`, `started_at`, `ended_at`, `is_default`, `archived_at`, timestamps, index person/archived + person/default); tambah `tb_tasks.workplace_id` (nullable, FK `ON DELETE SET NULL`, index); backfill: tiap pemilik yang punya task dibuatkan satu workplace default "Utama", lalu task yang `workplace_id` NULL diisi ke situ. Idempotent (guard `hasTable`/`hasColumn`, cek `is_default` sebelum insert).

## Data awal

Tidak ada.

Backfill tempat kerja default ditangani di migration, bukan seeder. `scripts/deploy.sh` tidak menjalankan seeder.

## Cek setelah naik

```bash
curl -fsS http://localhost:3000/api/v1/health
```

Harapan: `{"status":"ok"}`.

```bash
curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/v1/workplaces
```

Harapan: `401` (route hidup, butuh login). `404` berarti route workplace belum naik.

```bash
curl -sS -o /dev/null -w "%{http_code}\n" -X POST -H 'Content-Type: application/json' -d '{"name":"Cek","employment_type":"Fulltime"}' http://localhost:3000/api/v1/workplaces
```

Harapan: `401` (butuh login sebelum validasi jalan).

```bash
curl -sS -o /dev/null -w "%{http_code}\n" -X PATCH http://localhost:3000/api/v1/workplaces/1/archive
```

Harapan: `401` (route hidup, butuh login).

```bash
curl -sS -o /dev/null -w "%{http_code}\n" -X DELETE http://localhost:3000/api/v1/workplaces/1
```

Harapan: `401` (route hidup, butuh login).
