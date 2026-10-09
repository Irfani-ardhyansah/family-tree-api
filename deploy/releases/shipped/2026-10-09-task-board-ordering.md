# task-board-ordering

Tanggal: 2026-10-09

Urutan manual list task: kolom `sort_order` di `tb_tasks` (0 = paling atas, per pemilik) dan endpoint bulk:

- `PUT /api/v1/tasks/reorder` — `{ "order": [12, 7, 15] }`, set `sort_order = 0..n-1` sesuai urutan id.
- `GET /api/v1/tasks` sekarang default urut `sort_order ASC, id ASC` dan menyertakan `sort_order` di tiap item.
- Task baru otomatis `sort_order = max + 1` (muncul paling bawah).

## Env

Tidak ada.

`RUN_SEED` tetap `false`. `SKIP_MIGRATE` tetap `false`.

## Migration

Ada. Jalan otomatis saat container start (`SKIP_MIGRATE` tetap `false`).

- `src/database/migrations/20261009100000_alter_task_board_add_sort_order.ts` — tambah kolom `tb_tasks.sort_order` (integer, not null, default 0) + index `(person_id, sort_order)`. Backfill task lama per `person_id` dengan urutan `updated_at DESC, id DESC` → `sort_order = 0..n-1`. Idempotent (guard `hasColumn`).

## Data awal

Tidak ada.

## Cek setelah naik

```bash
curl -fsS http://localhost:3000/api/v1/health
```

Harapan: `{"status":"ok"}`.

```bash
curl -sS -o /dev/null -w "%{http_code}\n" -X PUT -H 'Content-Type: application/json' -d '{"order":[1]}' http://localhost:3000/api/v1/tasks/reorder
```

Harapan: `401` (route hidup, butuh login). `404` berarti endpoint reorder belum naik.
