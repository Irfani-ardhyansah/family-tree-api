# secondary-unlock-ttl

Tanggal: 2026-10-08

Durasi token "password kedua" (header `X-Module-Unlock`, dipakai modul sensitif: money-track, admin, core, household) dinaikkan dari 15 menit (`900`) ke **12 jam (`43200`)** lewat env `SECONDARY_UNLOCK_TTL`. Tidak ada perubahan kode selain nilai env.

## Env

`SECONDARY_UNLOCK_TTL` — nilai contoh di `.env.docker.example` sudah `43200`.

Penting: key ini **sudah ada** di `.env.docker` STB (nilainya masih `900`), jadi langkah key-check di `scripts/deploy.sh` tidak akan mengubah nilainya. **Ubah manual di `.env.docker` di STB** menjadi:

```
SECONDARY_UNLOCK_TTL=43200
```

Setelah diubah, container perlu restart/recreate (`bash scripts/deploy.sh` sudah menjalankan `docker compose up -d --build`). Kalau tidak diubah, service tetap jalan tapi unlock tetap 15 menit.

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
