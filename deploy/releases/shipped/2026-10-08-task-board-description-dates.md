# task-board-description-dates

Tanggal: 2026-10-08

`GET /api/v1/tasks` dan `GET /api/v1/tasks/:id` sekarang mengembalikan `created_at` & `updated_at` (ISO 8601) di setiap entri `descriptions`. Kolomnya sudah ada di `tb_task_descriptions`; yang berubah hanya `select` + mapping di repository (tidak ada skema baru).

## Env

Tidak ada.

`RUN_SEED` tetap `false`. `SKIP_MIGRATE` tetap `false`.

## Migration

Tidak ada.

## Data awal

Tidak ada.

## Cek setelah naik

```bash
curl -fsS http://localhost:3000/api/v1/health
```

Harapan: `{"status":"ok"}`.

```bash
curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/v1/tasks/1
```

Harapan: `401` (route hidup, butuh login). `404` berarti build/commit belum naik.
