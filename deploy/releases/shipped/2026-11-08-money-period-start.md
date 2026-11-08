# Jadwal reset / gajian Money Track

Tanggal: 2026-11-08

Menambah pengaturan periode bulanan Money Track: tanggal mulai bisa tetap
(1–31), hari terakhir bulan, atau hari kerja terakhir (dengan opsi libur
manual). Default tetap tanggal 1, jadi perilaku lama tidak berubah. Dashboard,
laporan bulanan, budget, dan reminder memakai rentang periode yang sama.

## Env

Tidak ada.

## Migration

Ada. Jalan otomatis saat container start (`SKIP_MIGRATE` tetap `false`).

- `src/database/migrations/20261108100000_alter_mt_preferences_add_period_start.ts`

## Data awal

Tidak ada. Kolom baru punya default `fixed_day` + tanggal 1 + tanpa geser,
sehingga baris preferensi lama otomatis berperilaku seperti sebelumnya.

## Cek setelah naik

```bash
curl -fsS http://localhost:3000/api/v1/health
```

Harapan: `{"status":"ok"}`.

```bash
curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/v1/money/preferences
```

Harapan: `401` (route hidup, butuh login). `404` berarti route belum naik.

```bash
curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/v1/money/dashboard
```

Harapan: `401` (route hidup, butuh login). `404` berarti route belum naik.

Setelah login:
- `GET /money/preferences` mengembalikan `period.startMode = "fixed_day"`,
  `period.startDay = 1`, `period.weekendAdjust = "none"`, `period.holidays = []`,
  dan `period.current` berisi rentang bulan berjalan.
- `GET /money/dashboard` punya `period.from` & `period.to`.
- `PUT /money/preferences` dengan `period.startMode = "last_workday"` membuat
  `period.current` mulai di hari kerja terakhir bulan.
