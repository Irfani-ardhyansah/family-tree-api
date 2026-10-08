# task-board-todos

Tanggal: 2026-10-08

Todo (checklist) per task: 1 task → banyak todo, tiap todo punya `title`, `description` (HTML, boleh kosong), dan `is_done`. Endpoint baru:

- `GET /api/v1/tasks/:id/todos`
- `POST /api/v1/tasks/:id/todos` — `{ title, description? }`
- `PATCH /api/v1/tasks/:id/todos/:todoId` — `{ title?, description?, is_done? }`
- `DELETE /api/v1/tasks/:id/todos/:todoId`

`GET /api/v1/tasks/:id` juga menyertakan `todos` (bersama `descriptions`, `revisions`, `history`).

## Env

Tidak ada.

`RUN_SEED` tetap `false`. `SKIP_MIGRATE` tetap `false`.

## Migration

Ada. Jalan otomatis saat container start (`SKIP_MIGRATE` tetap `false`).

- `src/database/migrations/20261008110000_create_task_board_todos.ts` — membuat tabel `tb_task_todos` (`task_id` FK ke `tb_tasks.id` `ON DELETE CASCADE`, `title` varchar(255), `description` text, `is_done` boolean default false, timestamps, index `tb_task_todos_task_idx`). Idempotent (guard `hasTable`).

## Data awal

Tidak ada.

## Cek setelah naik

```bash
curl -fsS http://localhost:3000/api/v1/health
```

Harapan: `{"status":"ok"}`.

```bash
curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/v1/tasks/1/todos
```

Harapan: `401` (route hidup, butuh login). `404` berarti route todo belum naik.

```bash
curl -sS -o /dev/null -w "%{http_code}\n" -X POST -H 'Content-Type: application/json' -d '{"title":"cek"}' http://localhost:3000/api/v1/tasks/1/todos
```

Harapan: `401` (butuh login sebelum validasi jalan).

```bash
curl -sS -o /dev/null -w "%{http_code}\n" -X PATCH -H 'Content-Type: application/json' -d '{"is_done":true}' http://localhost:3000/api/v1/tasks/1/todos/1
```

Harapan: `401` (butuh login sebelum validasi jalan).

```bash
curl -sS -o /dev/null -w "%{http_code}\n" -X DELETE http://localhost:3000/api/v1/tasks/1/todos/1
```

Harapan: `401` (route hidup, butuh login).
