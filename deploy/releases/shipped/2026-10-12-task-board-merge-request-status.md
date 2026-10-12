# task-board-merge-request-status

Tanggal: 2026-10-12

Task Board dapat status baru `Merge Request` di antara `In Progress` dan `Merged`:

- Alur status: `To-Do` → `In Progress` → `Merge Request` → `Merged`.
- `POST /api/v1/tasks` dan `PUT /api/v1/tasks/:id` menerima `status: "Merge Request"`.
- `GET /api/v1/tasks?status=Merge Request` memfilter status ini.
- Riwayat (`task_history`) ikut menyimpan `status: "Merge Request"`.
- Aturan revisi tidak berubah: hanya task induk `Merged` yang boleh direvisi;
  induk `Merge Request` tetap `422`.
- `Done` tetap ditolak `422` (pesannya kini menyebut `Merge Request`).

Nilai `Merge Request` ditulis persis (spasi, title case), sama seperti label link `mr`.

## Env

Tidak ada.

`RUN_SEED` tetap `false`. `SKIP_MIGRATE` tetap `false`.

## Migration

Ada. Jalan otomatis saat container start (`SKIP_MIGRATE` tetap `false`).

- `src/database/migrations/20261012100000_alter_task_board_merge_request_status.ts` — tambah `'Merge Request'` ke ENUM `tb_tasks.status`. Tidak ada perubahan data (semua baris lama tetap valid). Idempotent (guard `hasColumn`/`enumHasValue`).

## Data awal

Tidak ada.

## Cek setelah naik

```bash
curl -fsS http://localhost:3000/api/v1/health
```

Harapan: `{"status":"ok"}`.

```bash
curl -sS -o /dev/null -w "%{http_code}\n" -X POST -H 'Content-Type: application/json' -d '{"type":"Feature","title":"cek merge request","branchName":"cek/merge-request","status":"Merge Request","descriptions":[{"title":"a","content":"b"}]}' http://localhost:3000/api/v1/tasks
```

Harapan: `401` (route hidup, butuh login). Setelah login, create dengan `status: "Merge Request"` harus `201`; kirim `status: "Done"` harus `422`.
