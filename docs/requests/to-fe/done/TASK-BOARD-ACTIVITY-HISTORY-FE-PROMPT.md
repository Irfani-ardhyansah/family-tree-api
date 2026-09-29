# TASK-BOARD-ACTIVITY-HISTORY-FE-PROMPT

**Status FE: sudah diimplementasi (2026-09-29)** — lihat `family-tree-fe/docs/requests/from-be/done/TASK-BOARD-ACTIVITY-HISTORY-FE-PROMPT.md` (catatan implementasi per file dan hasil validasi E2E). Prompt di bawah dipertahankan sebagai arsip kontrak.

Prompt FE untuk integrasi riwayat aktivitas Task Board. History bukan lagi cuma perubahan status: BE sekarang mencatat semua perbuatan — pembuatan task, ganti status, tambah/ubah/hapus deskripsi — plus event "revisi dibuat" di history task induk dengan link ke detail child.

BE sudah live (naik bareng catatan deploy `deploy/releases/pending/2026-09-29-task-board-activity-history.md`).

Kontrak resmi: [`docs/reference/TASK-BOARD-API.md`](../../../reference/TASK-BOARD-API.md). Prompt sebelumnya (status `Merged`, deskripsi array, revisi): [`TASK-BOARD-ENHANCEMENTS-FE-PROMPT.md`](../done/TASK-BOARD-ENHANCEMENTS-FE-PROMPT.md) — tetap berlaku, file ini hanya tambahan.

## 1. Bentuk entri history baru

`GET /api/v1/tasks/:id/history` dan field `history` di `GET /api/v1/tasks/:id` sekarang mengembalikan:

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

Perubahan dari sebelumnya: tambah field `action`, `related_task_id`, `related_task_title`. Field lama (`id`, `status`, `notes`, `changed_at`) tetap ada, urutan tetap terbaru lebih dulu.

## 2. Cara render timeline per `action`

| `action` | Ikon/label saran | Teks saran |
|---|---|---|
| `created` | ➕ "Dibuat" | `Dibuat — {status}` (+ `notes` kalau ada) |
| `status_changed` | 🔁 "Status" | `Status → {status}` (+ `notes` kalau ada) |
| `description_added` | 📝 "Deskripsi" | `Deskripsi ditambahkan: "{notes}"` |
| `description_updated` | ✏️ "Deskripsi" | `Deskripsi diperbarui: "{notes}"` |
| `description_removed` | 🗑️ "Deskripsi" | `Deskripsi dihapus: "{notes}"` |
| `revision_created` | 🌿 "Revisi" | `Revisi dibuat: "{related_task_title}"` + **link ke detail child** |

Keterangan field untuk timeline:

- `status` = status task (pemilik entri itu) saat kejadian — tetap bisa dipakai untuk badge seperti sekarang.
- `notes` untuk `description_*` berisi **judul deskripsi** yang berubah (bukan isinya) — aman ditampilkan langsung.
- `notes` untuk `revision_created` berisi **judul task anak** (snapshot) — dipakai sebagai teks cadangan.
- Data lama: semua entri lama di-backfill jadi `status_changed`, kecuali entri terawal tiap task yang jadi `created`. Render FE lama yang mengabaikan `action` tetap jalan.

## 3. Link ke detail revisi child

Entri `revision_created` muncul **di history task induk**. Cara menautkannya:

- Kalau `related_task_id` terisi (mis. `21`) → render sebagai link ke halaman detail task FE (mis. `/task-board/21`), dengan label `related_task_title` ("Lihat detail revisi").
- Kalau `related_task_id` `null` (task anak sudah dihapus) → render teks polos tanpa link; `notes` masih menyimpan judul anak terakhir jadi timeline tidak kosong.

Contoh teks timeline di halaman detail induk: `🌿 Revisi dibuat: "Revisi filter" — 29 Sep 2026, 12:30 [lihat detail →]`.

Aksi di dalam child (ganti status, tambah/hapus deskripsi di child) **tidak** di-mirror ke history induk — masing-masing tetap tercatat di `history` milik task itu sendiri.

## 4. Yang berubah di request/response

Tidak ada perubahan request (tidak ada endpoint baru, tidak ada body baru). Yang berubah hanya isi response `history`:

| Lama | Sekarang |
|---|---|
| entri `{ id, status, notes, changed_at }` cuma untuk status | entri `{ id, action, status, notes, related_task_id, related_task_title, changed_at }` untuk semua aksi |
| — | deskripsi tambah/ubah/hapus otomatis jadi entri history |
| — | buat revisi / tempelkan `parent_task_id` → entri `revision_created` di history induk |

Perilaku yang perlu diketahui FE (tidak perlu aksi khusus):

- Satu `PUT` bisa menambah beberapa entri sekaligus (mis. dua deskripsi dihapus → dua entri).
- `PUT` yang mengirim `descriptions` sama persis tidak menambah entri deskripsi.
- Melepas relasi (`parent_task_id: null`) tidak menambah entri.

## 5. Yang paling cepat diverifikasi

1. Buka detail task → `history` sekarang punya `action` (entri pertama `created`).
2. Tambah satu entri deskripsi via `PUT` (`descriptions` lengkap + satu entri baru tanpa `id`) → muncul entri `description_added` dengan `notes` = judulnya.
3. Hapus satu entri deskripsi via `PUT` (buang dari array) → muncul entri `description_removed`.
4. Ubah judul/isi satu deskripsi → muncul entri `description_updated`.
5. Buat revisi dari task `Merged` (`POST` dengan `parent_task_id`) → buka detail **induk** → muncul entri `revision_created` dengan `related_task_id` = id anak; klik link → halaman detail anak.
6. Hapus task anak → entri di induk tetap ada, link hilang (`related_task_id: null`), judul di `notes` masih tampil.
