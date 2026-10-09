# Rencana API — Tempat Kerja (Workplaces) Task Board + migrasi data lama

Status: **draft, menunggu review FE → BE**
Tanggal: 2026-10-09
Modul BE terkait: `family-tree-api` — Task Board
Kontrak resmi saat ini: `family-tree-api/docs/reference/TASK-BOARD-API.md`

---

## 1. Latar belakang

Task Board sekarang menampilkan **satu daftar task datar** (`GET /tasks`).
Pemilik board punya pekerjaan **fulltime** dan **freelance**, dan besar
kemungkinan menambah pekerjaan lain. Task perlu dikelompokkan per
**tempat kerja** supaya konteksnya jelas.

Kendala utama: **sudah ada data task di production** yang tidak boleh hilang.
Karena itu perubahan skema harus **aditif + backfill**, bukan mengganti
struktur task.

---

## 2. Alur FE yang diinginkan (sudah dibangun dengan data dummy)

| Route | Isi |
|---|---|
| `/task-board` | Hub daftar tempat kerja + ringkasan jumlah task |
| `/task-board/w/:workplaceId` | Daftar task dalam satu tempat kerja |
| `/task-board/all` | Semua task lintas tempat kerja |
| form task (baru/edit) | Pilihan `workplace_id` |

Task lama yang belum punya `workplace_id` dipetakan FE ke tempat kerja
**default** supaya tetap tampil (tidak hilang dari UI).

---

## 3. Model data

### 3.1 Tabel baru `workplaces`

| Kolom | Tipe | Catatan |
|---|---|---|
| `id` | bigint PK | |
| `person_id` | bigint FK → persons | pemilik (owner-scoped) |
| `name` | varchar(120) | nama kantor/proyek |
| `employment_type` | varchar/enum | `Fulltime` \| `Freelance` \| `Part-time` \| `Contract` \| `Personal` |
| `role` | varchar(120) NULL | mis. "Frontend Engineer" |
| `location` | varchar(160) NULL | mis. "Jakarta · Remote" |
| `accent` | varchar(24) NULL | kunci warna tema (mis. `amber`, `sky`) |
| `started_at` | date NULL | mulai |
| `ended_at` | date NULL | selesai (null = masih jalan) |
| `is_default` | boolean default false | bucket task lama |
| `archived_at` | timestamp NULL | arsip (soft delete) |
| `created_at` / `updated_at` | timestamp | |

Index: `(person_id, archived_at)`, unique parsial `(person_id)` saat
`is_default = true` (maks 1 default per pemilik).

### 3.2 Perubahan tabel `tasks`

- Tambah `workplace_id` bigint **NULL**, FK → `workplaces(id)`
  (`ON DELETE SET NULL`).
- Index: `(workplace_id)`.
- **Jangan** pasang `NOT NULL` dulu di rilis pertama — biarkan nullable agar
  aman dan bisa mundur.

---

## 4. Endpoint

### 4.1 Workplaces (owner-scoped, sama seperti task)

| Method | Path | Fungsi |
|---|---|---|
| GET | `/workplaces` | Daftar tempat kerja milik user (+ `archived`) |
| POST | `/workplaces` | Buat tempat kerja |
| PUT | `/workplaces/:id` | Ubah |
| PATCH | `/workplaces/:id/archive` | Arsipkan (soft delete) |
| PATCH | `/workplaces/:id/unarchive` | Pulihkan dari arsip |
| DELETE | `/workplaces/:id` | Hapus permanen — **hanya jika tidak punya task** (lihat §4.3) |

Contoh `GET /workplaces`:

```json
{
  "data": {
    "items": [
      {
        "id": 1,
        "name": "Nusantara Digital",
        "employment_type": "Fulltime",
        "role": "Frontend Engineer",
        "location": "Jakarta · Remote",
        "accent": "amber",
        "started_at": "2023-02-01",
        "ended_at": null,
        "is_default": true,
        "archived_at": null
      }
    ]
  }
}
```

### 4.2 Task

- `GET /tasks` tambah **`workplace_id`** di tiap item, dan dukung filter
  opsional `?workplace_id=`.
- `POST /tasks` / `PUT /tasks/:id` menerima `workplace_id` (nullable).
- `GET /tasks/:id` ikut mengirim `workplace_id`.

Aturan:
- `workplace_id` harus milik user yang sama → jika tidak, `422`.
- Kirim `null` = task tanpa tempat kerja (FE menaruhnya di bucket default).

### 4.3 Aturan hapus vs arsip (validasi)

Aturan produk: **tempat kerja yang masih punya task tidak boleh dihapus** —
harus **diarsipkan**. Ini mencegah task kehilangan konteks.

`DELETE /workplaces/:id`:

- Hitung `task_count` = jumlah task dengan `workplace_id = :id` (termasuk
  task yang sudah selesai/Merged dan task di tempat kerja terarsip).
- Jika `task_count > 0` → **tolak** dengan `409`:

  ```json
  { "error": { "code": "WORKPLACE_HAS_TASKS", "message": "Tempat kerja masih punya 12 task. Arsipkan saja." } }
  ```

  Catatan implementasi: envelope error BE seragam `{ code, message, requestId }`,
  jadi jumlah task disertakan di dalam `message` (FE menampilkannya apa adanya).
- Jika `task_count = 0` → hapus permanen, balas `{ "data": { "deleted": true } }`.
- Tempat kerja `is_default = true` → **selalu tolak** hapus (`422`
  `DEFAULT_WORKPLACE_PROTECTED`).

`PATCH /workplaces/:id/archive`:

- Boleh kapan saja (termasuk yang masih punya task) — task tetap aman dan
  `workplace_id` tidak berubah.
- Set `archived_at = now()`. Data tetap muncul di `GET /workplaces` dengan
  penanda `archived_at` (FE menampilkannya di tab "Arsip").
- Tempat kerja `is_default = true` disarankan **tidak** bisa diarsipkan
  (`422`) karena menjadi penampung task lama.

`PATCH /workplaces/:id/unarchive`:

- Set `archived_at = NULL`, tempat kerja kembali ke daftar aktif.

---

## 5. Migrasi + seeder (bagian paling penting)

Tujuan: **task lama tidak rusak, tetap bisa dibuka, dan langsung punya
tempat kerja.**

### 5.1 Langkah migrasi (urut)

1. `CREATE TABLE workplaces`.
2. `ALTER TABLE tasks ADD COLUMN workplace_id BIGINT NULL`.
3. Backfill (di migrasi yang sama atau data-migration terpisah, idempotent):
   - Untuk **setiap `person_id` yang punya minimal satu task**, buat satu
     workplace default:
     - `is_default = true`
     - `name` saran: `"Utama"` (atau bisa diganti user nanti)
     - `employment_type`: `Fulltime` (nilai netral; bisa diubah user)
   - Set semua task milik person itu dengan `workplace_id` workplace default
     **hanya jika masih `NULL`** (jangan menimpa yang sudah terisi).
   - Kalau person tidak punya task, jangan buat workplace.
4. `CREATE INDEX` di `tasks(workplace_id)`.

### 5.2 Prinsip aman

- **Idempotent**: jalankan ulang tidak menggandakan workplace default
  (cek `is_default = true` per `person_id` sebelum insert).
- **Tidak menghapus/ubah kolom lama** task.
- **Tidak mengganti `NOT NULL`** di rilis ini.
- **Rollback**: drop index → drop column `workplace_id` → drop table
  `workplaces`. Data task inti tetap utuh.

### 5.3 Seeder (opsional, terpisah dari backfill)

Seeder boleh menyiapkan daftar contoh tempat kerja (mis. "Nusantara Digital"
fulltime, "Studio Kreasi" freelance) **hanya untuk environment dev/staging**.
Jangan jalankan seeder nama contoh di production — production cukup dapat
workplace default `"Utama"` dari backfill, sisanya dibuat user sendiri.

> Catatan: FE saat ini memakai `src/modules/task-board/lib/workplaceStore.ts`
> (seed dari `mocks/workplaces.ts`, disimpan di `localStorage`) supaya
> tambah/edit/arsip/hapus bisa dicoba sebelum BE siap. Setelah BE rilis, ganti
> isi store dengan panggilan `apiFetch` ke `/workplaces` — halaman tidak perlu
> diubah.

---

## 6. Aturan bisnis & edge case

| Kasus | Perilaku yang diusulkan |
|---|---|
| Hapus tempat kerja yang masih punya task | **Tolak `409 WORKPLACE_HAS_TASKS`** + `task_count`; FE menawarkan arsip (§4.3) |
| Arsip tempat kerja | Boleh walau masih punya task; `workplace_id` tidak berubah |
| Tempat kerja default | Tidak bisa dihapus/diarsipkan (`422`) |
| Pulihkan arsip | `unarchive` → kembali ke daftar aktif |
| `workplace_id` task milik user lain | `422` |
| User tanpa tempat kerja | `GET /tasks` tetap jalan; FE menampilkan semua di bucket default |

---

## 7. Deploy ke STB

Saat BE diimplementasi, tambahkan catatan di
`family-tree-api/deploy/releases/pending/` yang mencakup:

- `CREATE TABLE workplaces` + `ALTER TABLE tasks ADD workplace_id` (nullable).
- Backfill default workplace per person pemilik task.
- Endpoint `/workplaces` + `workplace_id` di task.
- Sifat: **additive + backfill**, aman tanpa downtime.
- Langkah verifikasi: hitung `tasks WHERE workplace_id IS NULL` **harus 0**
  untuk person yang punya task setelah migrasi.

---

## 8. Pertanyaan untuk reviewer

1. Nama tempat kerja default: `"Utama"` (rekomendasi) atau pakai nama
   perusahaan/instansi yang sudah ada?
2. Aturan hapus §4.3 (`409 WORKPLACE_HAS_TASKS` + `task_count`) sudah pas?
   Field apa saja yang perlu ada di error body?
3. `employment_type` pakai enum DB atau varchar bebas?
4. Perlu endpoint khusus pindah massal task ke tempat kerja lain (sebelum
   hapus tempat kerja lama)?
5. `accent` disimpan di BE (biar konsisten antar device) atau cukup dipilih FE?

---

## 9. Checklist uji manual (setelah BE live)

1. Migrasi jalan → **0 task** tanpa `workplace_id` untuk person yang punya task.
2. Task lama muncul di tempat kerja default `"Utama"`, judul/deskripsi utuh.
3. `GET /workplaces` mengembalikan default + tempat kerja buatan user.
4. Buat task baru dengan `workplace_id` → muncul di tempat kerja itu.
5. Filter `GET /tasks?workplace_id=` mengembalikan hanya task terkait.
6. `DELETE` tempat kerja yang masih punya task → `409 WORKPLACE_HAS_TASKS`
   beserta `task_count`.
7. `DELETE` tempat kerja kosong → `{ deleted: true }`; hapus tempat kerja
   default → `422 DEFAULT_WORKPLACE_PROTECTED`.
8. `archive` → `archived_at` terisi dan masih muncul di `GET /workplaces`;
   `unarchive` mengembalikan ke daftar aktif.
9. Kirim `workplace_id` milik user lain → `422`.
10. Task tanpa `workplace_id` (jika diizinkan) tetap tampil di UI bucket default.
