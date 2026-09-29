# task-board-activity-history

Tanggal: 2026-09-29

Riwayat task bukan cuma perubahan status: tambah/ubah/hapus deskripsi sekarang otomatis masuk `tb_task_history` (satu entri per deskripsi yang berubah, `notes` = judulnya), dan pembuatan revisi menulis entri `revision_created` ke history task INDUK dengan `related_task_id` menunjuk task anak supaya FE bisa menautkan ke detail child. `GET /tasks/:id/history` dan field `history` di `GET /tasks/:id` mengembalikan field baru `action`, `related_task_id`, `related_task_title`.

## Env

Tidak ada.

`RUN_SEED` tetap `false`. `SKIP_MIGRATE` tetap `false`.

## Migration

Ada. Jalan otomatis saat container start (`SKIP_MIGRATE` tetap `false`).

- `src/database/migrations/20260929200000_alter_task_board_history_actions.ts` — menambah `tb_task_history.action` (default `status_changed`) dan `tb_task_history.related_task_id` (FK ke `tb_tasks.id`, `ON DELETE SET NULL`, + index), lalu backfill: entri terawal tiap task di-set `created`. Idempotent — aman kalau dijalankan ulang.

## Data awal

Tidak ada.

## Cek setelah naik

```bash
curl -fsS http://localhost:3000/api/v1/health
```

Harapan: `{"status":"ok"}`.

```bash
curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/v1/tasks/1/history
```

Harapan: `401` (route hidup, butuh login). `404` berarti kolom/history baru belum naik.

```bash
curl -sS http://localhost:3000/api/v1/tasks/1 | head -c 200; echo
```

Harapan: `401` (route hidup, butuh login).
