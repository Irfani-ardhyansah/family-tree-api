# Prompt BE — Task Board: Todo (checklist) per task

> Request **FE → BE**. Status: ✅ **Implemented**.
>
> Related: [`TASK-BOARD-API.md`](./TASK-BOARD-API.md),
> [`TASK-BOARD-enhancements.md`](./TASK-BOARD-enhancements.md),
> [`TASK-BOARD-DESCRIPTION-DATES-BE-PROMPT.md`](./TASK-BOARD-DESCRIPTION-DATES-BE-PROMPT.md).

---

## 1. Konteks

Satu task bisa punya **banyak todo** (checklist). Tiap todo punya **judul** dan
**deskripsi** (HTML, seperti deskripsi task, boleh kosong) serta status
**selesai/belum** (`is_done`). Di halaman detail FE, checklist tampil **di bawah
card Deskripsi**, tiap item punya checkbox untuk toggle selesai.

---

## 2. Data model

Tabel baru **`tb_task_todos`**:

| Kolom | Tipe | Ket |
|-------|------|-----|
| `id` | int unsigned PK | |
| `task_id` | int unsigned | FK `tb_tasks.id` ON DELETE CASCADE |
| `title` | varchar(255) | Wajib |
| `description` | text | HTML, boleh kosong (`''`) |
| `is_done` | boolean | default `false` |
| `created_at` / `updated_at` | timestamp | |

Index: `tb_task_todos_task_idx` (`task_id`).

Migration: `src/database/migrations/20261008110000_create_task_board_todos.ts`.

---

## 3. Endpoint

Auth sama seperti route task board lain (`requireAuth`).

### `GET /tasks/:id/todos`

Balikan `TaskTodo[]` (urut `id` naik). `404` kalau task bukan milik user.

```json
[
  {
    "id": 3,
    "task_id": 11,
    "title": "Tambah index",
    "description": "<p>Di kolom status</p>",
    "is_done": false,
    "created_at": "2026-10-08T10:00:00.000Z",
    "updated_at": "2026-10-08T10:00:00.000Z"
  }
]
```

### `POST /tasks/:id/todos`

Body: `{ "title": string, "description"?: string }` → `201` + TaskTodo baru.
`title` wajib (di-trim, maks 255). `description` opsional (default `''`).

### `PATCH /tasks/:id/todos/:todoId`

Body (minimal salah satu): `{ "title"?: string, "description"?: string, "is_done"?: boolean }`.
Balikan TaskTodo yang diupdate. `404` kalau task/todo tidak ditemukan (todo bukan
milik task itu juga `404`). `description: null`/`""` → dikosongkan.

### `DELETE /tasks/:id/todos/:todoId`

`200` + `{ "deleted": true }`. `404` kalau tidak ada.

### Embed di detail

`GET /tasks/:id` juga menyertakan `todos: TaskTodo[]` (bersama `descriptions`,
`revisions`, `history`) supaya FE tidak perlu request tambahan saat membuka
detail.

---

## 4. Implementasi

- Modul: `src/modules/task-board/`
  - `task-board.types.ts` — `TaskTodo`, `TaskTodoCreateInput`, `TaskTodoUpdateInput`, `Task.todos`.
  - `task-board.repository.ts` — `listTodos`, `findTodoById`, `createTodo`, `updateTodo`, `deleteTodo`; `findById(includeRelations)` mengisi `task.todos`.
  - `task-board.service.ts` — validasi (task ownership, judul wajib, `is_done` boolean, deskripsi boleh kosong).
  - `task-board.controller.ts` + `task-board.routes.ts` — 4 endpoint di atas.
  - Unit test di `task-board.service.test.ts`.

---

## 5. Acceptance (terpenuhi)

- Task → banyak todo; tiap todo punya `title` + `description` + `is_done`. ✅
- CRUD todo lengkap + toggle `is_done` via `PATCH`. ✅
- `GET /tasks/:id` menyertakan `todos`. ✅
- Ownership: task/todo bukan milik user → `404`. ✅
