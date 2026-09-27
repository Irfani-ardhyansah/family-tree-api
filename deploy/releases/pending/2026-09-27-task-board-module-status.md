# task-board-module-status

Tanggal: 2026-09-27

Modul Task Board naik ke STB: route `/api/v1/tasks` (list, detail, create, update, delete, upload gambar task) dan saklar modul `task-board` di panel admin. `DELETE /tasks/:id` balas `200 { "deleted": true }`.

Tanpa ini, kartu **Task Board** di halaman Status Modul dijawab `404 Modul tidak ditemukan.` — `MODULE_STATUS_IDS` di kode dan ENUM `core_module_statuses.module_id` di database belum punya nilai `task-board`.

## Env

Tidak ada.

`RUN_SEED` tetap `false`. `SKIP_MIGRATE` tetap `false`.

## Migration

Ada. Jalan otomatis saat container start (`SKIP_MIGRATE` tetap `false`).

- `src/database/migrations/20260927100000_create_task_board.ts` — tabel `tb_tasks`, `tb_task_links`, `tb_task_images`.
- `src/database/migrations/20260928100000_alter_module_statuses_add_task_board.ts` — menambah nilai `task-board` pada ENUM `core_module_statuses.module_id`. Lewat sendiri kalau kolomnya sudah punya nilai itu.

## Data awal

Tidak ada.

Nilai tetap `task-board` ikut lewat ENUM di migration, bukan seeder. Baris saklar per keluarga dibuat aplikasi sendiri saat admin membuka Status Modul atau men-toggle (`ensureDefaults` + upsert di `module-status.repository.ts`), jadi tidak ada data yang perlu disiapkan. Jangan set `RUN_SEED=true`.

## Cek setelah naik

```bash
curl -fsS http://localhost:3000/api/v1/health
```

Harapan: `{"status":"ok"}`.

```bash
curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/v1/tasks
```

Harapan: `401` (route hidup, butuh login). `404` berarti route task board belum naik.

```bash
curl -sS -o /dev/null -w "%{http_code}\n" -X PATCH -H 'Content-Type: application/json' -d '{"enabled":true}' http://localhost:3000/api/v1/admin/modules/task-board/status
```

Harapan: `401` (route hidup, butuh login). `404` berarti route admin panel belum naik.
