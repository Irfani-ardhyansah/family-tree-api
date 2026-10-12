# task-board-item-ordering

Tanggal: 2026-10-09

Urutan manual penjelasan (descriptions) & todo per task: kolom `sort_order` di `tb_task_descriptions` dan `tb_task_todos`, plus endpoint bulk:

- `PUT /api/v1/tasks/:id/descriptions/reorder` — `{ "order": [31, 27, 35] }`.
- `PUT /api/v1/tasks/:id/todos/reorder` — `{ "order": [5, 2, 8] }`.

`GET /api/v1/tasks/:id` mengurutkan descriptions & todos by `sort_order`, dan menyertakan `sort_order` di tiap item. Entri baru otomatis `sort_order = max + 1` (paling bawah). Reorder tidak membuat entri riwayat aktivitas.

## Env

Tidak ada.

`RUN_SEED` tetap `false`. `SKIP_MIGRATE` tetap `false`.

## Migration

Ada. Jalan otomatis saat container start (`SKIP_MIGRATE` tetap `false`).

- `src/database/migrations/20261009120000_alter_task_board_item_sort_order.ts` — tambah `sort_order` (integer, not null, default 0) + index `(task_id, sort_order)` di `tb_task_descriptions` dan `tb_task_todos`. Backfill per parent mengikuti `created_at ASC, id ASC` → `sort_order = 0..n-1`. Idempotent (guard `hasTable`/`hasColumn`).

## Data awal

Tidak ada.

## Cek setelah naik

```bash
curl -fsS http://localhost:3000/api/v1/health
```

Harapan: `{"status":"ok"}`.

```bash
curl -sS -o /dev/null -w "%{http_code}\n" -X PUT -H 'Content-Type: application/json' -d '{"order":[1]}' http://localhost:3000/api/v1/tasks/1/descriptions/reorder
```

Harapan: `401` (route hidup, butuh login). `404` berarti endpoint reorder penjelasan belum naik.

```bash
curl -sS -o /dev/null -w "%{http_code}\n" -X PUT -H 'Content-Type: application/json' -d '{"order":[1]}' http://localhost:3000/api/v1/tasks/1/todos/reorder
```

Harapan: `401` (route hidup, butuh login). `404` berarti endpoint reorder todo belum naik.
