# Tutorial STB — Pembersihan Otomatis (logs, backup/export, data lama DB)

Status: **draft** — berlaku setelah prompt `docs/requests/from-fe/pending/ADMIN-AUTO-CLEANUP-BE-PROMPT.md` dikerjakan & rilis ke STB.
Terakhir diperbarui: 2026-10-12.

Dokumen ini menjelaskan **apa yang perlu di-setting di STB** supaya fitur
Pembersihan Otomatis (Admin → *Pembersihan Otomatis*) jalan: menghapus log, file
backup/export, dan baris data lama sesuai retensi (mis. 2 minggu / 1 bulan).

---

## 0. Ringkas

- **UI admin** (`/admin/cleanup`) yang menentukan on/off + retensi (2 minggu, 1 bulan, dst).
- **Env di STB** hanya mengatur *seberapa sering scheduler ngecek* dan *batas aman minimum*.
- Scheduler jalan **di dalam container API** (interval), bukan cron OS.
- Tiap eksekusi menulis file laporan di `logs/cleanup/` (jendela penghapusan + jumlah).
- File backup/export ada di dalam volume `UPLOADS_HOST_PATH` (subfolder `backups/`).

---

## 1. Prasyarat

- Kode sudah ter-deploy ke STB (migration `core_auto_cleanup_settings` jalan saat container start).
- `.env.docker` di STB sudah lengkap (dicek otomatis oleh `scripts/deploy.sh`).
- Kamu login sebagai admin untuk membuka `/admin/cleanup`.

---

## 2. Setting env di STB

Edit `.env.docker` di STB (file ini **tidak** ikut git):

```bash
CLEANUP_ENABLED=false
CLEANUP_INTERVAL_MINUTES=1440
CLEANUP_MIN_RETENTION_DAYS=7
```

| Key | Nilai saran | Arti |
|---|---|---|
| `CLEANUP_ENABLED` | `false` | Nilai awal saat baris settings belum ada. Biarkan `false`; nyalakan dari UI admin. |
| `CLEANUP_INTERVAL_MINUTES` | `1440` | Scheduler cek tiap 1440 menit (harian). Cukup hemat untuk STB; boleh diperkecil (mis. `720`) kalau ingin lebih sering. |
| `CLEANUP_MIN_RETENTION_DAYS` | `7` | Batas aman: retensi tidak boleh kurang dari 7 hari walau di UI. |

> Nilai contoh juga ada di `.env.docker.example` (di repo). Salin lalu sesuaikan.
> Jangan taruh retensi (2 minggu/1 bulan) di env — itu diatur dari UI admin.

---

## 3. Pastikan folder host untuk file

`scripts/deploy.sh` otomatis membuat folder dari `UPLOADS_HOST_PATH` dan
`LOGS_HOST_PATH`. Cek di `.env.docker`:

```bash
UPLOADS_HOST_PATH=/srv/family-suite/uploads
LOGS_HOST_PATH=/srv/family-suite/logs
```

Kalau di STB pakai SD card / filesystem tanpa `chown`, pastikan folder itu
sudah dibuat manual sebelum deploy (lihat pesan `deploy.sh`). File backup/export
ada di dalam `<UPLOADS_HOST_PATH>/backups/<family_id>/`.

---

## 4. Naikkan & nyalakan

```bash
cd /path/ke/family-tree-api
git pull
bash scripts/deploy.sh
```

Setelah sehat:

1. Buka Admin → **Pembersihan Otomatis** (`/admin/cleanup`).
2. Nyalakan toggle **Aktif**.
3. Pilih **Batas usia data**: `2 minggu` atau `1 bulan` (atau lainnya).
4. Centang jenis data yang mau dibersihkan.
5. Klik **Simpan pengaturan**.
6. (Disarankan) klik **Jalankan sekarang** dulu untuk 1x bersih-bersih awal,
   atau tunggu scheduler tick berikutnya (≤ `CLEANUP_INTERVAL_MINUTES`).

---

## 5. Cek berhasil jalan

Tanpa login (memastikan route hidup) — dari STB:

```bash
curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/v1/admin/cleanup/settings
```

Harapan: `401` (butuh login). `404` berarti endpoint belum naik.

Lihat log container:

```bash
docker compose --env-file .env.docker logs --tail=100 api
```

Cari jejak pembersihan (ringkasan "deleted … / freed …").

Lihat file laporan tiap eksekusi (di volume `LOGS_HOST_PATH`, subfolder `cleanup/`):

```bash
docker compose --env-file .env.docker exec api ls -lt logs/cleanup | head
```

Isi satu file mencatat jendela penghapusan (`window: <cutoff> → <waktu eksekusi>`) plus jumlah yang dihapus per target.

---

## 6. Mengubah retensi nanti

- **2 minggu ⇄ 1 bulan**: cukup lewat UI Admin → Pembersihan Otomatis → ubah
  **Batas usia data** → Simpan. Tidak perlu restart container.
- **Frekuensi cek**: ubah `CLEANUP_INTERVAL_MINUTES` di `.env.docker`, lalu
  `bash scripts/deploy.sh` (atau `docker compose up -d`) untuk reload.

---

## 7. Aman / rollback

- **Matiin cepat**: set `enabled=false` di UI (atau `CLEANUP_ENABLED=false` kalau
  settings belum ada) lalu redeploy. Scheduler berhenti menghapus.
- Fitur ini **hanya** menyentuh log & file backup/export — media keluarga
  (foto/dokumen) tidak dihapus.
- Sebelum menyalakan di production, biasakan klik **preview**/jalankan saat
  retensi `1 bulan` dulu, lalu perketat kalau perlu.
- Kalau habis bersih-bersih lalu butuh data lama: pulihkan dari backup SQL
  terbaru (Admin → Backup & Export). Karena itu, jangan set retensi file
  backup **lebih pendek** dari jadwal backup rutinmu.

---

## 8. Troubleshooting

| Gejala | Kemungkinan |
|---|---|
| `404` di `/admin/cleanup/settings` | Kode belum naik / container belum rebuild. |
| Tidak ada yang terhapus padahal enabled | Belum ada data lebih lama dari cutoff, atau semua target tidak dicentang. |
| File backup tidak terhapus | File gagal dihapus (permission) → baris `core_backup_jobs` sengaja tidak dihapus agar bisa di-retry. Cek permission `UPLOADS_HOST_PATH/backups`. |
| Scheduler tidak jalan | `CLEANUP_INTERVAL_MINUTES` salah, atau container di-restart terus. Cek log container. |
