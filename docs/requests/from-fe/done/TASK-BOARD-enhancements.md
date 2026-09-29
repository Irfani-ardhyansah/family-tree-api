# Task Board Enhancements Request

## Overview
Need to enhance the Task Board module to support new features: status update with notes, parent/child relationship for revisions, multiple descriptions, and migration file tracking.

**Important Status Change**: Remove "Done" status. Task status should only go up to "Merged". The valid statuses are: "To-Do", "In Progress", "Merged".

## Required Changes

### 1. Database Schema Changes

#### Update `tasks` table:
- **Status column**: Remove "Done" from the status ENUM/allowed values. Valid statuses: "To-Do", "In Progress", "Merged"
- Add `parent_task_id` (integer, nullable, foreign key to `tasks.id`) - for parent/child relationship
- Add `migration_files` (JSON, nullable) - to store array of migration file names

#### Create new table `task_descriptions`:
```sql
CREATE TABLE task_descriptions (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Create new table `task_history`:
```sql
CREATE TABLE task_history (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL,
  notes TEXT,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 2. API Changes

#### Update Task Model/DTO:
- Change `description` (single string) to `descriptions` (array of objects with `title` and `content`)
- Add `migration_files` field (array of strings)
- Add `parent_task_id` field

#### Update Task Endpoints:

**GET /api/tasks/:id**
- Return task with:
  - `descriptions: [{ id, title, content }]` instead of `description: string`
  - `migration_files: string[]` (array of migration file names)
  - `parent_task_id: number | null`
  - `parent_task: Task | null` (include parent task details if it's a revision)
  - `revisions: Task[]` (include list of child tasks/revisions if it's a parent)
  - Optionally include `history: [{ id, status, notes, changed_at }]`

**POST /api/tasks**
- Accept:
  - `descriptions: [{ title, content }]` (array, at least one required)
  - `migration_files: string[]` (array, optional)
  - `parent_task_id: number` (optional, for revisions)
- Automatically create initial history entry with "To-Do" status

**PUT /api/tasks/:id**
- Accept same fields as POST
- Automatically create history entry when status changes
- If status changes and notes provided, store notes in history

**GET /api/tasks/:id/history**
- Return array of history entries sorted by `changed_at` desc
- Each entry: `{ id, status, notes, changed_at }`

### 3. Business Logic

#### Status Update with Notes:
- When task status changes, automatically create a new `task_history` entry
- Store the notes (if provided) in the history entry
- Notes are optional but recommended for status changes

#### Revision Task (Parent/Child):
- When creating a task with `parent_task_id`, it's marked as a revision
- Only allow creating revisions when parent task status is "Merged"
- Consider adding a visual indicator for revision tasks in the UI
- Optionally: Add endpoint to get all revisions of a task

#### Multiple Descriptions:
- Allow multiple description entries per task
- Each description has a title and content
- Support adding/removing descriptions via API
- Maintain backward compatibility by treating old single `description` as a single entry in the new structure

### 4. Migration Strategy

#### Database Migration:
1. Update `tasks` table:
   - Remove "Done" from status ENUM/allowed values
   - Add `parent_task_id` column
   - Add `migration_files` column
2. Create `task_descriptions` table
3. Create `task_history` table
4. Migrate existing data:
   - For each existing task with status "Done", consider whether to keep as "Merged" or handle differently
   - For each existing task, create a `task_descriptions` entry with title "Deskripsi" and content from old `description` field
   - For each existing task with `migration_file`, convert to JSON array in new `migration_files` column
   - Optionally: Create initial history entries based on current status

#### API Compatibility:
- Maintain backward compatibility during transition
- Consider supporting both old `description` and new `descriptions` format temporarily
- Provide clear error messages for deprecated fields

### 5. Additional Considerations

#### Validation:
- Ensure `parent_task_id` references an existing task
- Validate that parent task exists and is in "Merged" status when creating revision
- Ensure at least one description is provided when creating/updating task
- Validate migration file format if needed (e.g., timestamp naming convention)
- Ensure migration_files array contains valid filenames

#### Performance:
- Add indexes on `task_descriptions.task_id`
- Add indexes on `task_history.task_id` and `task_history.changed_at`
- Consider pagination for history endpoint if history can be long

#### Future Enhancements:
- Consider adding endpoint to get task hierarchy (parent + all children)
- Consider adding endpoint to bulk create history entries for data migration
- Consider adding search/filter by migration file status

## Acceptance Criteria

- [x] Database schema updated with new tables and columns
- [x] API endpoints updated to handle new fields
- [x] Existing data migrated to new structure
- [x] Status changes automatically create history entries
- [x] Revision tasks can be created with parent_task_id
- [x] Multiple descriptions supported per task
- [x] Migration file field stored and returned correctly
- [x] History endpoint returns chronological status changes
- [x] Backward compatibility maintained during transition

## Backend Implementation Status

Dikerjakan 2026-09-29.

- ✅ Migration `src/database/migrations/20260929100000_alter_task_board_enhancements.ts` (kolom baru, tabel `tb_task_descriptions` + `tb_task_history`, pindah data lama, `Done` → `Merged`)
- ✅ Tabel baru didaftarkan di `src/shared/database/tables.ts`
- ✅ Types: `TaskStatus` tanpa `Done`, `TaskDescription`, `TaskHistoryEntry`, field baru di `Task`/`TaskCreateInput`/`TaskUpdateInput`
- ✅ Repository: `descriptions`, `migration_files`, `parent_task_id`, `parent_task`, `revisions`, `history`, `getHistory`, `getRevisions`, `findRowById`, create/update dalam transaction
- ✅ Service: validasi deskripsi, `migration_files`, revisi (induk wajib `Merged`, tanpa siklus), notes status, pesan khusus untuk `Done`
- ✅ Controller + routes: `GET /tasks/:id/history`, `GET /tasks/:id/revisions`
- ✅ Unit test `src/modules/task-board/task-board.service.test.ts` (26 test) + build hijau
- ✅ Smoke test manual di MySQL lokal: create/detail/update/history/revisions/validasi gagal

### Catatan implementasi

- Kolom `tb_tasks.description` dihapus dari DB, tapi API tetap mengembalikan field `description` (isi deskripsi pertama) supaya FE lama tidak error. Kirim deskripsi baru lewat `descriptions`.
- Mengirim `descriptions` dan `description` bersamaan dijawab `422` supaya tidak ada dua sumber kebenaran.
- `parent_task_id` pakai `ON DELETE SET NULL`: hapus task induk tidak menghapus revisinya.
- `status` saat create boleh dikosongkan → default `To-Do`.
- Notes status dikirim lewat `notes` (alias `statusNotes`) di POST/PUT, tersimpan di `task_history`.
- Belum ada pagination untuk `GET /tasks/:id/history` (dicatat sebagai enhancement berikutnya).
- Kontrak lengkap: [`../../../reference/TASK-BOARD-API.md`](../../../reference/TASK-BOARD-API.md)

