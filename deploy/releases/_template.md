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

<!-- Data referensi yang wajib ada di STB (jenis dokumen, tipe kalender, dll.)
     tulis di migration, bukan seeder.
     Jangan set RUN_SEED=true. Seed demo menghapus data keluarga lalu mengisi ulang.
-->

## Cek setelah naik

```bash
curl -fsS http://localhost:3000/api/v1/health
```

<!-- Tambah cek khusus fitur kalau ada, misalnya satu endpoint baru. -->
