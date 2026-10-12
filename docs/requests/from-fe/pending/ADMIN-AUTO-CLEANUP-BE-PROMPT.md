# Prompt BE — Admin: Pembersihan Otomatis (logs, file backup/export, data lama DB)

Status: **draft, menunggu dikerjakan BE**
Tanggal: 2026-10-10
Modul BE: `family-tree-api` — Admin (settings) + Logs + Backup
Tutorial STB: `docs/reference/ADMIN-AUTO-CLEANUP-STB.md`
UI FE: `family-tree-fe` → Admin → **Pembersihan Otomatis** (`/admin/cleanup`)

---

## 1. Tujuan

Sediakan fungsi admin untuk **on/off** dan **konfigurasi retensi** pembersihan
otomatis (default: 2 minggu atau 1 bulan ke belakang) atas:

1. **Log** — baris di `core_app_logs` (dan opsional `core_admin_audit_logs`,
   `mt_audit_logs`).
2. **File backup & export** — file yang tersimpan lewat media storage dengan
   `core_backup_jobs.storage_key` (`backups/<family_id>/<jobId>.sql.zip|.json`).
3. **Data di database** — baris `core_backup_jobs` lama (metadata job) yang
   file-nya sudah dihapus, plus baris log di atas.
4. (Opsional) **File log server** — `logs/app.log` (rotasi/trim).

UI-nya sudah ada di FE dengan data dummy; kontrak API di bawah harus cocok
dengan bentuk itu.

## 2. Pengaturan (settings)

### 2.1 Tabel baru `core_auto_cleanup_settings` (per family)

| Kolom | Tipe | Catatan |
|---|---|---|
| `family_id` | int PK/FK → `core_families.id` (CASCADE) | 1 baris per keluarga |
| `enabled` | boolean not null default false | on/off |
| `retention_days` | int not null default 14 | batas usia (hari) |
| `targets` | json not null | `{ app_logs, backup_history, backup_files, log_files }` |
| `last_run_at` | timestamp null | |
| `last_result` | json null | `{ app_logs, backup_history, backup_files, log_files, freed_bytes }` |
| `updated_by` | int null FK → `core_persons.id` (SET NULL) | |
| `created_at` / `updated_at` | timestamps | |

Nilai default baris (kalau belum ada) = `enabled=false`, `retention_days=14`,
semua target `true` kecuali `log_files` (default `false`).

### 2.2 Minimal retensi

`retention_days` tidak boleh `< CLEANUP_MIN_RETENTION_DAYS` (default 7). Tolak
`422` kalau di bawah floor.

## 3. API (admin, di bawah guard modul sensitif existing)

| Method | Path | Fungsi |
|---|---|---|
| GET | `/api/v1/admin/cleanup/settings` | Ambil pengaturan + `last_run_at`/`last_result` |
| PUT | `/api/v1/admin/cleanup/settings` | `{ enabled, retentionDays, targets }` |
| GET | `/api/v1/admin/cleanup/preview` | Dry-run: jumlah & ukuran yang **akan** dihapus |
| POST | `/api/v1/admin/cleanup/run` | Jalankan sekarang (manual) |

Bentuk respons (camelCase, cocokkan dengan FE):

```json
{
  "data": {
    "enabled": false,
    "retentionDays": 14,
    "targets": {
      "appLogs": true,
      "backupHistory": true,
      "backupFiles": true,
      "logFiles": false
    },
    "minRetentionDays": 7,
    "scheduleLabel": "Setiap hari 03:00 (waktu server)",
    "lastRunAt": null,
    "lastResult": null
  }
}
```

`GET /preview` mengembalikan `{ appLogs, backupHistory, backupFiles, logFiles, freedBytes }`.

`POST /run` menjalankan pembersihan sekali lalu mengembalikan settings terbaru
(termasuk `lastRunAt` + `lastResult`).

## 4. Scheduler (in-process)

- Interval dicek `CLEANUP_INTERVAL_MINUTES` (default 60). Tiap tick:
  baca settings; kalau `enabled=false` → skip.
- Hitung cutoff = `now - retention_days`.
- Jalankan pembersihan target yang aktif, lalu tulis `last_run_at` +
  `last_result`.
- **Single instance guard**: STB jalan 1 container API. Beri kunci sederhana
  (mis. flag in-memory + `updated_at`/`last_run_at`) supaya tidak dobel kalau
  proses restart bersamaan. Jangan pakai cron OS — cukup interval di app start.
- Jalankan juga sekali saat boot (opsional, kalau `enabled`).

## 5. Aturan hapus (hati-hati)

- **Log DB**: hapus `core_app_logs` (`occurred_at < cutoff`). Opsional admin
  audit & money audit.
- **File backup/export**: untuk tiap `core_backup_jobs` dengan
  `created_at < cutoff` dan `status='success'`:
  1. hapus file via media storage pakai `storage_key`;
  2. hapus barisnya.
  File yang gagal dihapus → **jangan** hapus barisnya (biar bisa di-retry).
- **Data DB**: baris `core_backup_jobs` di atas.
- **File log server**: trim/rotate `logs/app.log` (mis. simpan N hari,
  sisakan file aktif). Best-effort.
- Batas keamanan: **hanya** sentuh `core_app_logs`, `core_admin_audit_logs`,
  `mt_audit_logs`, `core_backup_jobs`, file di bawah prefix `backups/`, dan
  `logs/app.log`. Jangan pernah menghapus media lain (foto/dokumen keluarga).
- Tulis satu baris `core_app_logs` (category `system`) berisi ringkasan
  pembersihan yang dijalankan (biar ada jejaknya).
- Semua operasi best-effort per item; satu error tidak menggagalkan seluruh run.

## 6. Env baru (tambahkan ke `.env.example` & `.env.docker.example`)

| Key | Default | Untuk apa |
|---|---|---|
| `CLEANUP_INTERVAL_MINUTES` | `60` | Frekuensi cek scheduler |
| `CLEANUP_MIN_RETENTION_DAYS` | `7` | Floor retensi (safety) |
| `CLEANUP_ENABLED` | `false` | Bootstrap awal; nilai efektif dari DB (`settings.enabled`) |

> `CLEANUP_ENABLED` hanya dipakai saat baris settings belum ada (seed baris
> pertama). Setelah itu UI admin yang jadi sumber kebenaran.

## 7. Migration + deploy

- Migration baru: `core_auto_cleanup_settings`.
- Tambah catatan `deploy/releases/pending/YYYY-MM-DD-admin-auto-cleanup.md`
  (Env + Migration + Cek setelah naik).
- Tambahkan key env baru ke `.env.docker.example`; STB mengisi manual di
  `.env.docker` (lihat tutorial STB).

## 8. Checklist uji

1. `GET /admin/cleanup/settings` mengembalikan default (enabled=false, 14 hari).
2. `PUT` dengan `retentionDays=5` → `422` (di bawah floor 7).
3. `PUT` `{ enabled: true, retentionDays: 14, targets: {...} }` → tersimpan.
4. `GET /preview` menghitung jumlah & ukuran (tidak menghapus).
5. `POST /run` menghapus sesuai target, set `lastRunAt`/`lastResult`.
6. Log lama benar-benar hilang; media keluarga **tidak** tersentuh.
7. File backup lama terhapus dari disk + baris `core_backup_jobs` ikut terhapus.
8. Scheduler berjalan tiap `CLEANUP_INTERVAL_MINUTES` saat enabled.
9. Nonaktifkan (`enabled=false`) → scheduler tidak menghapus apa pun.
