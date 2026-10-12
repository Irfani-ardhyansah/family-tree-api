# admin-auto-cleanup

Tanggal: 2026-10-10

Fitur Admin → **Pembersihan Otomatis**: on/off + retensi (mis. 2 minggu / 1 bulan) untuk menghapus log, file backup/export, dan data lama di database.

- `GET /api/v1/admin/cleanup/settings`
- `PUT /api/v1/admin/cleanup/settings` — `{ enabled, retentionDays, targets }`
- `GET /api/v1/admin/cleanup/preview` — dry-run (hitung yang akan dihapus)
- `POST /api/v1/admin/cleanup/run` — jalankan sekarang
- Scheduler in-process: tiap `CLEANUP_INTERVAL_MINUTES`, hanya jalan untuk keluarga dengan `enabled=true`.
- Tiap eksekusi (manual/auto) menulis satu file laporan `logs/cleanup/cleanup-YYYYMMDD-HHmmss.log`: trigger, keluarga, retensi, jendela penghapusan (cutoff → waktu eksekusi), target, dan jumlah yang dihapus.

## Env

Ada key baru (tambahkan manual ke `.env.docker` di STB; contoh nilai ada di `.env.docker.example`):

- `CLEANUP_ENABLED` — nilai awal `enabled` saat baris settings pertama dibuat. `false` (disarankan) / `true`.
- `CLEANUP_INTERVAL_MINUTES` — frekuensi scheduler cek (menit). Default `1440` (harian).
- `CLEANUP_MIN_RETENTION_DAYS` — batas aman minimum retensi (hari). Default `7`.

Key sudah ada dari catatan ini sebelumnya. **Nilai berubah:** kalau di STB `.env.docker` masih `CLEANUP_INTERVAL_MINUTES=60`, ubah manual jadi `1440` (`.env.docker` tidak ikut `git pull` dan tidak ditimpa skrip deploy). Kalau tidak diubah, scheduler tetap jalan tiap jam (lebih sering dari yang diperlukan).

`RUN_SEED` tetap `false`. `SKIP_MIGRATE` tetap `false`.

## Migration

Ada. Jalan otomatis saat container start (`SKIP_MIGRATE` tetap `false`).

- `src/database/migrations/20261010100000_create_auto_cleanup_settings.ts` — membuat tabel `core_auto_cleanup_settings` (`family_id` PK/FK `core_families` CASCADE, `enabled`, `retention_days`, `targets` json, `last_run_at`, `last_result` json, `updated_by` FK `core_persons` SET NULL, timestamps, index `enabled`). Idempotent (guard `hasTable`).

## Data awal

Tidak ada.

Baris settings dibuat otomatis (lazy saat dibuka di UI, dan oleh scheduler untuk semua keluarga). Nilai awal `enabled` mengikuti `CLEANUP_ENABLED`.

## Cek setelah naik

```bash
curl -fsS http://localhost:3000/api/v1/health
```

Harapan: `{"status":"ok"}`.

```bash
curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/v1/admin/cleanup/settings
```

Harapan: `401` (route hidup, butuh login). `404` berarti route belum naik.

```bash
curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/v1/admin/cleanup/preview
```

Harapan: `401` (route hidup, butuh login).

```bash
curl -sS -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/v1/admin/cleanup/run
```

Harapan: `401` (route hidup, butuh login).

Setelah login admin & jalankan `POST /admin/cleanup/run`, cek file laporan baru: `docker compose --env-file .env.docker exec api ls -lt logs/cleanup | head` (volume `family_suite_logs`, jadi ikut persist saat container di-build ulang).
