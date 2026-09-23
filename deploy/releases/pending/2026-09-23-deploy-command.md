# deploy-command

Tanggal: 2026-09-23

Satu perintah naik STB: `bash scripts/deploy.sh` (atau `npm run deploy`). Container di-build ulang. Migration baru jalan saat start. Seeder tidak dijalankan.

## Env

Tidak ada.

`RUN_SEED` tetap `false`. `SKIP_MIGRATE` tetap `false`. Perintah ini berhenti kalau salah satu diset `true`.

## Migration

Tidak ada.

Migration fitur lain yang belum ada di database tetap jalan otomatis saat container start.

## Data awal

Tidak ada.

Seeder tidak ikut perintah ini. Nilai baru yang tetap (modul, status, jenis) ditambah sebagai ENUM lewat migration fitur itu, plus konstanta di kode. Jangan set `RUN_SEED=true`.

## Cek setelah naik

```bash
curl -fsS http://localhost:3000/api/v1/health
```

Harapan: `{"status":"ok"}`.
