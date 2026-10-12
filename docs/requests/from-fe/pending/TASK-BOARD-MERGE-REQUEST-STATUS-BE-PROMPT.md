# Prompt BE — Task Board: status baru `Merge Request`

Status: **draft, menunggu review FE → BE**
Tanggal: 2026-10-12
Modul BE terkait: `family-tree-api` — Task Board
Kontrak resmi saat ini: `family-tree-api/docs/reference/TASK-BOARD-API.md`

---

## 1. Latar belakang

Alur task sekarang hanya punya tiga status: `To-Do`, `In Progress`, `Merged`.
Di praktiknya ada satu tahap penting sebelum `Merged`, yaitu **MR (Merge
Request) sudah dibuka tapi belum di-merge**. Tahap ini sering dipakai untuk
menandai "sudah selesai dikerjakan, menunggu review/merge", dan saat ini
dipaksa masuk `In Progress` sehingga progress board kurang akurat.

FE (`family-tree-fe`) sudah menambahkan status keempat di UI:

```
To-Do  →  In Progress  →  Merge Request  →  Merged
```

Karena BE memvalidasi enum status (`Done` ditolak `422`), FE tidak bisa
mengirim `Merge Request` sebelum BE mengizinkannya.

---

## 2. Perubahan yang diminta (aditif)

| Area | Sekarang | Diminta |
|---|---|---|
| Enum status task | `To-Do` \| `In Progress` \| `Merged` | tambah `Merge Request` |
| Validasi `POST /tasks` & `PUT /tasks/:id` | tolak status di luar enum | terima `Merge Request` |
| Filter `GET /tasks?status=` | enum lama | terima `Merge Request` |
| History `status` | string bebas | ikut menyimpan `Merge Request` |
| Aturan revisi | hanya boleh dari induk `Merged` | tetap `Merged` saja (tidak berubah) |

Catatan:
- **Nama status persis** `Merge Request` (spasi, title case) — sama seperti
  label link `mr` yang sudah dipakai FE.
- Tidak ada perubahan skema kolom; `status` kemungkinan `varchar/enum`.
  Kalau `enum` di DB, perlu `ALTER TYPE ... ADD VALUE 'Merge Request'`.
- Backfill tidak perlu — data lama tetap valid.

---

## 3. Kontrak

### Request

```http
PUT /api/v1/tasks/42
Content-Type: application/json

{ "status": "Merge Request", "notes": "MR sudah dibuka, menunggu review" }
```

### Response (ringkas)

```json
{
  "id": 42,
  "status": "Merge Request",
  "history": [
    {
      "id": 10,
      "action": "status_changed",
      "status": "Merge Request",
      "notes": "MR sudah dibuka, menunggu review",
      "changed_at": "2026-10-12T09:30:00.000Z"
    }
  ]
}
```

Status lama yang tetap ditolak: `Done` → `422` dengan pesan jelas
(mis. `"Status tidak valid. Pilihan: To-Do, In Progress, Merge Request, Merged"`).

---

## 4. Perubahan di FE (sudah dikerjakan)

| File | Perubahan |
|---|---|
| `src/modules/task-board/types.ts` | `TaskStatus` + `'Merge Request'` |
| `src/modules/task-board/lib/taskMeta.ts` | meta warna/ikon `GitPullRequest` (orange) + urutan status |
| `src/modules/task-board/pages/TaskFormPage.tsx` | opsi dropdown status |
| `src/modules/task-board/components/TaskStatusUpdateModal.tsx` | grid pilihan status jadi 2 kolom |
| `src/modules/task-board/components/TaskHistoryModal.tsx` | kenali `Merge Request` sebagai status |
| `src/modules/task-board/lib/workplaceMeta.ts` | bucket statistik `mergeRequest` |
| `src/modules/task-board/components/WorkplaceCard.tsx`, `pages/WorkplaceListPage.tsx` | legend + tile `Merge Request` |

Tambahan (tidak terkait BE): tab **"Semua"** di daftar task menyembunyikan
status `Merged` supaya bisa difilter sendiri; tombol salin nama branch.

---

## 5. Test yang diharapkan di BE

1. `POST /tasks` dengan `status: "Merge Request"` → tersimpan & tampil di list.
2. `PUT /tasks/:id` ubah ke `Merge Request` + `notes` → riwayat bertambah
   dengan `status: "Merge Request"` dan catatan tersimpan.
3. `GET /tasks?status=Merge Request` → hanya task berstatus itu.
4. `PUT` dengan `status: "Done"` → tetap `422`.
5. Aturan revisi tidak berubah: buat revisi dari induk `Merge Request` →
   tetap `422`; hanya induk `Merged` boleh.
