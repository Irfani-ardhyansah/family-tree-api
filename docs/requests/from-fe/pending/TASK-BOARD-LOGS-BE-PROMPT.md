# Prompt BE — Logs untuk fitur Task Board

Status: **draft, menunggu dikerjakan BE**
Tanggal: 2026-10-10
Modul BE: `family-tree-api` — Task Board + Logs + Admin Audit
Kontrak terkait: `docs/reference/TASK-BOARD-API.md`

---

## 1. Masalah

Task Board belum punya log yang berarti:

- `httpAuditLog` middleware (`src/shared/middleware/httpAuditLog.middleware.ts`)
  memang menulis tiap request non-GET ke `core_app_logs`, tapi `inferAuditAction`
  (`src/modules/core/logs/logs.service.ts`) tidak mengenal route task board →
  aksinya cuma fallback `http.post` / `http.put` / `http.delete`. Tidak ada
  konteks (task mana, aksi apa).
- Admin → Audit Log membaca `core_admin_audit_logs` + `mt_audit_logs`, dan
  `ADMIN_AUDIT_MODULE_IDS` (`src/modules/core/admin/admin.constants.ts`) **belum
  memuat `task-board`**. Jadi aksi task board tak muncul di sana.
- Akibatnya sulit menelusuri "siapa mengubah apa" di task board, dan tidak ada
  dasar untuk retensi/pembersihan log per modul.

## 2. Tujuan

1. Tiap aksi **tulis** task board tercatat di `core_app_logs` (`core_app_logs`)
   dengan `action` yang bermakna + konteks (`resource_type`, `resource_id`,
   `message`).
2. Aksi domain Task Board juga masuk **Admin → Audit Log** (`core_admin_audit_logs`)
   lewat `adminAuditService.record`, sehingga bisa difilter per modul.
3. Tidak menambah log untuk operasi **baca** (GET) — biar tidak banjir.
4. Tidak ada migration baru (tabel log sudah ada).

## 3. Perubahan yang diminta

### 3.1 `core_admin_audit_logs` — izinkan modul `task-board`

Di `src/modules/core/admin/admin.constants.ts`:

```ts
export const ADMIN_AUDIT_MODULE_IDS = [
  ...ADMIN_MODULE_IDS,
  'admin',
  'auth',
  'task-board',
] as const;
```

`ADMIN_AUDIT_ACTIONS` tetap (`create`, `update`, `delete`, …). Aksi domain
dipetakan ke aksi yang sudah ada, bukan bikin enum baru.

Helper `isAdminAuditModuleId` otomatis ikut menerima `task-board`.

> FE sudah ditambah opsi filter modul **Task Board** di halaman Audit Log
> (`src/modules/admin/pages/AuditLogPage.tsx`).

### 3.2 Task Board menulis audit domain

Di `task-board.service.ts` (dan workplace service), panggil
`adminAuditService.record(...)` pada aksi tulis. Contoh pemetaan:

| Aksi | moduleId | action | summary |
|---|---|---|---|
| Create task | `task-board` | `create` | `Buat task "<title>"` |
| Update task (field dasar) | `task-board` | `update` | `Ubah task "<title>"` |
| Ubah status | `task-board` | `update` | `Status "<title>": To-Do → In Progress` |
| Tambah/ubah/hapus deskripsi | `task-board` | `update` | `Deskripsi "<judul>" ditambah/…` |
| Todo create/update/delete | `task-board` | `create`/`update`/`delete` | `Todo "<title>" …` |
| Buat revisi | `task-board` | `create` | `Revisi dari task #<induk>` |
| Reorder task/deskripsi/todo | `task-board` | `update` | `Urutkan ulang …` |
| Delete task | `task-board` | `delete` | `Hapus task "<title>"` |
| Workplace CRUD/archive | `task-board` | `create`/`update`/`delete` | `Tempat kerja "<name>" …` |

Wajib diisi: `familyId`, `actorPersonId` (dari `req.auth`), `moduleId`,
`action`, `summary`. `before`/`after` opsional — isi untuk update status
(`{ status }`) dan update task, agar detail audit berguna.

`adminAuditService.record` sudah menelan error sendiri (tidak menggagalkan
request) — aman dipanggil setelah operasi sukses.

### 3.3 `core_app_logs` — action bermakna

Tambahkan pemetaan task board di `inferAuditAction`
(`src/modules/core/logs/logs.service.ts`) supaya log HTTP tidak lagi `http.post`:

```ts
if (normalized.startsWith('/tasks')) {
  if (normalized === '/tasks/reorder' && method === 'PUT') return 'task.reorder';
  if (normalized.endsWith('/descriptions/reorder') && method === 'PUT') return 'task.description.reorder';
  if (normalized.endsWith('/todos/reorder') && method === 'PUT') return 'task.todo.reorder';
  if (normalized.includes('/todos') && method === 'POST') return 'task.todo.create';
  if (normalized.includes('/todos') && method === 'PATCH') return 'task.todo.update';
  if (normalized.includes('/todos') && method === 'DELETE') return 'task.todo.delete';
  if (method === 'POST') return 'task.create';
  if (method === 'PUT' || method === 'PATCH') return 'task.update';
  if (method === 'DELETE') return 'task.delete';
}

if (normalized.startsWith('/workplaces')) {
  if (normalized.endsWith('/archive') && method === 'PATCH') return 'workplace.archive';
  if (normalized.endsWith('/unarchive') && method === 'PATCH') return 'workplace.unarchive';
  if (method === 'POST') return 'workplace.create';
  if (method === 'PUT' || method === 'PATCH') return 'workplace.update';
  if (method === 'DELETE') return 'workplace.delete';
}
```

`parseResource` di middleware sudah otomatis mengambil `resource_type` dari
segmen pertama path (`tasks` / `workplaces`) dan `resource_id` dari segmen
angka. Tidak perlu diubah.

> Catatan: action di `core_app_logs` bebas string (kolom varchar 64), jadi
> `task.todo.create` aman.

## 4. Yang **tidak** perlu

- Migration baru.
- Log untuk GET (list/detail/history/revisions/todos).
- Perubahan kontrak response API Task Board.

## 5. Checklist uji

1. Create task → muncul 1 baris `core_app_logs` action `task.create` +
   1 baris `core_admin_audit_logs` module `task-board`, action `create`.
2. Ubah status → audit `update` dengan summary "Status … → …".
3. Tambah todo → `task.todo.create` di `core_app_logs`; audit `create`.
4. Reorder task → `task.reorder`.
5. Hapus task → audit `delete`.
6. Admin → Audit Log, filter modul **Task Board** → entri tampil.
7. GET list/detail **tidak** menambah baris log.
8. Workplace create/archive/hapus → tercatat.

## 6. Deploy

- Tidak ada env baru, tidak ada migration.
- Tetap buat catatan `deploy/releases/pending/YYYY-MM-DD-task-board-logs.md`
  (perubahan perilaku API/observability).
