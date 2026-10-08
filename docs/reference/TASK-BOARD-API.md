# Task Board API

Kontrak endpoint Task Board (`/api/v1/tasks`). Personal scope: setiap task milik satu `person_id` (dari token login). Semua endpoint butuh `Authorization: Bearer <accessToken>`.

Asal spek: [`../requests/from-fe/done/TASK-BOARD-API.md`](../requests/from-fe/done/TASK-BOARD-API.md) dan [`../requests/from-fe/done/TASK-BOARD-enhancements.md`](../requests/from-fe/done/TASK-BOARD-enhancements.md).

## Status

| Status | Arti |
|---|---|
| `To-Do` | belum dikerjakan (status awal saat create kalau `status` tidak dikirim) |
| `In Progress` | sedang dikerjakan |
| `Merged` | sudah di-merge. Status terakhir — `Done` sudah dihapus |

`Done` dijawab `422` dengan pesan `status "Done" sudah tidak dipakai. Status yang valid: To-Do, In Progress, Merged.` Baris lama berstatus `Done` dilebur migration menjadi `Merged`.

## Bentuk Task

```json
{
  "id": 12,
  "person_id": 95,
  "type": "Feature",
  "title": "Tambah filter status",
  "branch_name": "feature/filter-status",
  "status": "In Progress",
  "descriptions": [
    {
      "id": 3,
      "title": "Konteks",
      "content": "<p>Isi deskripsi…</p>",
      "created_at": "2026-09-29T10:00:00.000Z",
      "updated_at": "2026-09-29T12:30:00.000Z"
    },
    { "id": 4, "title": "Acceptance", "content": "<p>Filter jalan…</p>", "created_at": "2026-09-29T10:05:00.000Z", "updated_at": "2026-09-29T10:05:00.000Z" }
  ],
  "description": "<p>Isi deskripsi…</p>",
  "deploy_notes": "<p>Deploy 2026-09-29</p>",
  "migration_files": ["20260929100000_alter_task_board_enhancements.ts"],
  "parent_task_id": null,
  "links": [{ "id": 5, "task_id": 12, "type": "mr", "url": "https://github.com/…" }],
  "images": [{ "id": 2, "task_id": 12, "url": "/media/uploads/tasks/12/1699-foto.png" }],
  "created_at": "2026-09-29T10:00:00.000Z",
  "updated_at": "2026-09-29T12:30:00.000Z"
}
```

Catatan field:

- `descriptions` — array deskripsi (judul + isi, HTML dari editor). Urut `id` naik. Tiap entri menyertakan `created_at` & `updated_at` (ISO 8601) — dipakai kartu deskripsi di FE.
- `description` — kolom lama. Dipertahankan untuk kompatibilitas: isinya `descriptions[0].content` atau `null`. Kirim balik lewat `descriptions`.
- `migration_files` — array nama file migration. Tidak boleh path, harus berekstensi `.ts`, `.js`, atau `.sql`, tanpa duplikat.
- `parent_task_id` — `null` untuk task biasa; berisi id task induk kalau task ini revisi.
- `type` — `Bugfixing`, `Feature`, atau `Refactor`.
- `links[].type` — `discord`, `notion`, atau `mr`.

Field tambahan khusus `GET /tasks/:id`:

| Field | Isi |
|---|---|
| `parent_task` | task induk (semua field seperti di atas) kalau task ini revisi, kalau tidak `null` |
| `revisions` | array task anak/revisi (urut `created_at` naik), `[]` kalau tidak punya |
| `history` | riwayat aksi, terbaru lebih dulu: `[{ id, action, status, notes, related_task_id, related_task_title, changed_at }]` — jenis aksi ada di tabel `action` di bawah |

List (`GET /tasks`) dan `GET /tasks/:id/revisions` mengembalikan task tanpa `parent_task`, `revisions`, dan `history`.

## Endpoint

| Method | Path | Keterangan |
|---|---|---|
| `GET` | `/api/v1/tasks` | list task milik user |
| `GET` | `/api/v1/tasks/:id` | detail + `parent_task`, `revisions`, `history` |
| `POST` | `/api/v1/tasks` | create task / revisi |
| `PUT` | `/api/v1/tasks/:id` | update task (status/deskripsi/revisi → history baru) |
| `DELETE` | `/api/v1/tasks/:id` | hapus task → `200 { "data": { "deleted": true } }` |
| `GET` | `/api/v1/tasks/:id/history` | riwayat status, terbaru lebih dulu |
| `GET` | `/api/v1/tasks/:id/revisions` | daftar revisi (task anak) |
| `POST` | `/api/v1/tasks/:id/images` | upload gambar task (`multipart/form-data`, field `file`) |

### GET /api/v1/tasks

Query opsional: `type`, `status`, `search`. `search` mencari di `title`, `deploy_notes`, `migration_files`, judul dan isi deskripsi. Urut `updated_at` desc.

### POST /api/v1/tasks

```json
{
  "type": "Feature",
  "title": "Tambah filter status",
  "branchName": "feature/filter-status",
  "status": "To-Do",
  "descriptions": [{ "title": "Konteks", "content": "<p>…</p>" }],
  "deployNotes": "",
  "migration_files": ["20260929100000_alter_task_board_enhancements.ts"],
  "links": [{ "type": "mr", "url": "https://github.com/…" }],
  "parent_task_id": null,
  "notes": "mulai dikerjakan"
}
```

- `type`, `title`, `branchName` wajib; `status` opsional (default `To-Do`).
- `descriptions` wajib, minimal satu entri `{ title, content }`.
- `description` (string lama) masih diterima dan dibungkus menjadi satu entri berjudul `Deskripsi`. Jangan kirim `descriptions` dan `description` bersamaan → `422`.
- `parent_task_id` → task ini jadi revisi. Task induk harus ada, milik user yang sama, dan berstatus `Merged`. BE otomatis menulis entri `revision_created` di history induk (`related_task_id` = id task baru ini).
- `notes` (alias `statusNotes`) opsional → tersimpan di entri history pertama (`action: created`).
- Respons `201` berisi Task lengkap (termasuk `history`).

### PUT /api/v1/tasks/:id

Body sama seperti POST, semua field opsional. Yang penting:

- Kirim `descriptions` lengkap setiap kali mengubah deskripsi. Entri dengan `id` milik task ini di-update, entri yang tidak dikirim lagi dihapus, entri tanpa `id` ditambah sebagai baru. `descriptions: []` dijawab `422`.
- Deskripsi berubah → `task_history` otomatis dapat entri baru per entri yang berubah: `description_added` (entri baru), `description_updated` (judul/isi berubah), `description_removed` (entri tidak dikirim lagi). `notes` berisi judul deskripsinya. Payload sama persis tidak menulis entri.
- `migration_files: []` mengosongkan daftar.
- `parent_task_id: null` melepas relasi revisi (tidak menulis entri).
- `parent_task_id` melekat ke induk baru → entri `revision_created` ditulis di history task induk itu (`related_task_id` = id task ini).
- Status berubah → otomatis ditulis ke `task_history` (`action: status_changed`), memakai `notes`/`statusNotes` kalau dikirim. Status yang sama dengan sebelumnya tidak menulis entri baru.
- Respons `200` berisi Task lengkap.

### GET /api/v1/tasks/:id/history

Riwayat aksi task — bukan cuma perubahan status: pembuatan task, ganti status, tambah/ubah/hapus deskripsi. Urut terbaru lebih dulu (`changed_at` desc, lalu `id` desc).

| Field | Isi |
|---|---|
| `id` | id entri history |
| `action` | jenis aksi (tabel di bawah) |
| `status` | status task (pemilik entri) saat kejadian |
| `notes` | isi tergantung aksi: `created`/`status_changed` → catatan user (`notes`/`statusNotes`, boleh `null`); `description_added`/`description_updated`/`description_removed` → judul deskripsi yang berubah; `revision_created` → judul task anak |
| `related_task_id` | id task terkait; hanya terisi untuk `revision_created` (id task anak/revisi — `null` lagi kalau anak sudah dihapus, FK `ON DELETE SET NULL`) |
| `related_task_title` | judul task terkait (join `tb_tasks`); untuk label link tanpa request tambahan |
| `changed_at` | waktu kejadian |

| `action` | Kapan ditulis | Ditulis di history |
|---|---|---|
| `created` | task dibuat (entri pertama) | task itu sendiri |
| `status_changed` | status berubah | task itu sendiri |
| `description_added` | `PUT` menambahkan entri `descriptions` baru (tanpa `id`, atau `id` asing) | task itu sendiri |
| `description_updated` | `PUT` mengubah judul/isi entri `descriptions` yang sudah ada | task itu sendiri |
| `description_removed` | `PUT` tidak lagi mengirim `id` entri lama | task itu sendiri |
| `revision_created` | task dibuat dengan `parent_task_id`, atau `parent_task_id` melekat lewat `PUT` | **task induk** (`related_task_id` = id anak) |

```json
{
  "data": [
    { "id": 12, "action": "revision_created", "status": "Merged", "notes": "Revisi filter", "related_task_id": 21, "related_task_title": "Revisi filter", "changed_at": "2026-09-29T12:30:00.000Z" },
    { "id": 11, "action": "description_removed", "status": "Merged", "notes": "Acceptance", "related_task_id": null, "related_task_title": null, "changed_at": "2026-09-29T12:20:00.000Z" },
    { "id": 10, "action": "status_changed", "status": "Merged", "notes": "sudah merge", "related_task_id": null, "related_task_title": null, "changed_at": "2026-09-29T12:00:00.000Z" },
    { "id": 9, "action": "created", "status": "To-Do", "notes": null, "related_task_id": null, "related_task_title": null, "changed_at": "2026-09-29T10:00:00.000Z" }
  ]
}
```

Catatan:

- Entri history data lama di-backfill migration: semua jadi `status_changed`, kecuali entri terawal tiap task yang jadi `created`.
- Buat task dengan deskripsi awal tidak menulis entri `description_*` — pembuatan sudah tercakup `created`.
- Kirim `descriptions` yang sama persis tidak menulis entri deskripsi apa pun.
- Melepas relasi revisi (`parent_task_id: null`) tidak menulis entri; pindah induk menulis entri `revision_created` ke induk baru, entri lama di induk sebelumnya dibiarkan (sifat log append-only).
- Anak dihapus → entri `revision_created` di induk tetap ada, `related_task_id` jadi `null`, `notes` masih menyimpan judul anak terakhir.

### GET /api/v1/tasks/:id/revisions

```json
{ "data": [ { "id": 21, "title": "Revisi filter", "parent_task_id": 12, "status": "To-Do" } ] }
```

## Todo (checklist)

Satu task → banyak todo. Tiap todo punya `title`, `description` (HTML, boleh `""`), dan `is_done`. `GET /tasks/:id` menyertakan `todos: TaskTodo[]`.

```json
{
  "id": 3,
  "task_id": 11,
  "title": "Tambah index kolom status",
  "description": "<p>Di kolom status</p>",
  "is_done": false,
  "created_at": "2026-10-08T10:00:00.000Z",
  "updated_at": "2026-10-08T10:00:00.000Z"
}
```

| Method | Path | Body | Ket |
|--------|------|------|-----|
| `GET` | `/api/v1/tasks/:id/todos` | — | `TaskTodo[]` urut `id` naik |
| `POST` | `/api/v1/tasks/:id/todos` | `{ title, description? }` | `201` + TaskTodo; `title` wajib |
| `PATCH` | `/api/v1/tasks/:id/todos/:todoId` | `{ title?, description?, is_done? }` | TaskTodo hasil update |
| `DELETE` | `/api/v1/tasks/:id/todos/:todoId` | — | `{ deleted: true }` |

- `404 NOT_FOUND` bila task bukan milik user atau todo bukan milik task itu.
- `description: null`/`""` → dikosongkan. `is_done` terima boolean / `0` / `1`.

## Error

Format umum: `{ "error": { "code": "VALIDATION_ERROR", "message": "Pesan Bahasa Indonesia", "requestId": "…" } }`.

| Kode | Situasi |
|---|---|
| `401 UNAUTHORIZED` | tanpa / token tidak valid |
| `404 NOT_FOUND` | task tidak ada atau bukan milik user |
| `422 VALIDATION_ERROR` | enum tidak valid, `descriptions` kosong/absen, `migration_files` bukan nama file valid, `parent_task_id` tidak ada / induk belum `Merged` / menunjuk diri sendiri / membentuk siklus, `descriptions` + `description` dikirim bersamaan |

## Catatan perilaku

- Hapus task induk: revisi tidak ikut terhapus, `parent_task_id`-nya jadi `null` (FK `ON DELETE SET NULL`). Deskripsi, history, links, dan images milik task yang dihapus terhapus otomatis (cascade).
- `descriptions` dan `history` hanya diubah lewat `POST`/`PUT` task; tidak ada endpoint per entri.
- Revisi hanya boleh dibuat dari task berstatus `Merged` (induk belum Merged → `422`).

