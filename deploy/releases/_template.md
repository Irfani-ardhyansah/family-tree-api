# nama-fitur

Tanggal: YYYY-MM-DD

Satu kalimat: apa yang naik ke STB.

## Env

Tidak ada.

<!-- Kalau ada key baru, ganti bagian di atas dengan daftar ini.
     Nilai contoh ada di .env.docker.example. Isi manual di .env.docker di STB
     (file itu tidak ikut git).

- `NAMA_KEY` — untuk apa. Wajib diisi / boleh kosong.
-->

## Migration

Tidak ada.

<!-- Kalau ada:
Ada. Jalan otomatis saat container start (`SKIP_MIGRATE` tetap `false`).

- `src/database/migrations/YYYYMMDDHHMMSS_nama.ts`
-->

## Data awal

Tidak ada.

<!-- Nilai baru yang tetap (modul, status, jenis): konstanta di kode + ENUM di migration.
     Jangan seeder. scripts/deploy.sh tidak menjalankan seeder.
     Jangan set RUN_SEED=true.
-->

## Cek setelah naik

```bash
curl -fsS http://localhost:3000/api/v1/health
```

<!-- scripts/deploy.sh menjalankan setiap curl di bagian ini.
     HTTP 404 atau 5xx = gagal, file tetap di pending/.
     Tambah curl endpoint fitur kalau ada. -->
