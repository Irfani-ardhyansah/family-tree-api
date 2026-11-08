# task-board-logs

Tanggal: 2026-10-10

Task Board kini menulis log aksi:

- `core_app_logs`: action bermakna (`task.create`, `task.update`, `task.delete`, `task.todo.*`, `task.reorder`, `workplace.*`, …) — sebelumnya cuma fallback `http.post/put/delete`.
- `core_admin_audit_logs`: aksi tulis Task Board tercatat dengan `module_id = 'task-board'`, sehingga muncul di **Admin → Audit Log** (filter modul Task Board).

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
curl -sS -o /dev/null -w "%{http_code}\n" -X POST -H 'Content-Type: application/json' -d '{"type":"Feature","title":"cek log","branchName":"cek/log","descriptions":[{"title":"a","content":"b"}]}' http://localhost:3000/api/v1/tasks
```

Harapan: `401` (route hidup, butuh login). Setelah login & create task, cek baris baru di `core_app_logs` (action `task.create`) dan `core_admin_audit_logs` (`module_id='task-board'`).
