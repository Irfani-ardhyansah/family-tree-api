# Prompt FE — Upload scan dokumen penting (Family Core)

Salin blok di bawah ke chat AI / ticket FE.

Status BE: **live**. Dummy `Upload scan dokumen — media upload menyusul` boleh dihapus. Storage pakai `MEDIA_STORAGE_DIR` yang sama dengan event / person / money (bukan path khusus FE).

---

## Prompt

```
Kamu mengganti placeholder dummy upload scan di Family Core (halaman Dokumen penting) dengan upload media sungguhan. Repo: family-tree-fe.

Bahasa UI: Indonesia. Field API: English.

Jangan simpan file sebagai base64 di localStorage / payload dokumen.
Jangan hit endpoint fiktif.
Kalau POST /media/upload 404, tampilkan error — jangan pura-pura sukses.

## Yang sudah live di BE

Reuse pipeline media yang dipakai Events / Person:

1. User pilih foto → POST /api/v1/media/upload (eager, 1 file per request)
2. Preview pakai url dari response
3. Submit form dokumen → kirim mediaIds[] ke POST/PATCH /api/v1/fc/documents
4. Tutup modal tanpa simpan → POST /api/v1/media/cleanup { mediaIds }

Purpose baru: `fc_document`
Folder server: `{MEDIA_STORAGE_DIR}/family-core/documents/`
URL publik contoh: `{MEDIA_PUBLIC_BASE_URL}/family-core/documents/med_….jpg`

## Auth

Semua request:
- Authorization: Bearer <accessToken>
- Query: focusPersonId=<id> (sama seperti media event)

Route /fc/* juga butuh header X-Module-Unlock yang cover modul `core` (password kedua), sama seperti CRUD dokumen sekarang.
POST /media/upload cukup auth — tidak butuh unlock.

## Upload file

POST /api/v1/media/upload?focusPersonId={id}
Content-Type: multipart/form-data

| Field | Wajib | Isi |
|---|---|---|
| file | ya | 1 gambar |
| purpose | ya | `fc_document` |
| contextId | tidak | id dokumen saat edit; kosong saat create |

Response 201:

{
  "data": {
    "id": "med_…",
    "url": "http://…/media/family-core/documents/med_….jpg",
    "purpose": "fc_document",
    "status": "pending",
    "mimeType": "image/jpeg",
    "sizeBytes": 245001,
    "width": 1600,
    "height": 1200,
    "createdAt": "2026-09-24T00:00:00.000Z"
  }
}

Batas (default, bisa diubah di .env BE tanpa deploy FE):
- Format: image/jpeg, image/png, image/webp, image/gif saja (PDF belum)
- Ukuran: MEDIA_MAX_FILE_BYTES (default 5 MB)
- Jumlah per dokumen: MEDIA_MAX_COUNT_FC_DOCUMENT (default 5)

Tampilkan pesan error dari BE jika MIME / size / jumlah lewat.

## Hapus 1 file

Belum submit (status pending):

DELETE /api/v1/media/{mediaId}?focusPersonId={id}

`mediaId` harus `med_…`, bukan `files[].id` angka. Tanpa query `focusPersonId` request media bisa gagal.

Sudah tersimpan di dokumen (status attached) — pilih salah satu:

DELETE /api/v1/fc/documents/{documentId}/files/{fileId}
DELETE /api/v1/fc/documents/{documentId}/files/{mediaId}
DELETE /api/v1/media/{mediaId}?focusPersonId={id}

`fileId` = `files[].id` (angka). `mediaId` = `files[].mediaId` (`med_…`).
Jangan DELETE `/media/3` pakai id angka — itu 400/404 dan file tidak terhapus.

Hapus dokumen:

DELETE /api/v1/fc/documents/{documentId}

Scan ikut dilepas dari disk.

## Batal / tutup form

POST /api/v1/media/cleanup?focusPersonId={id}
{ "mediaIds": ["med_…", "med_…"] }

Hanya cleanup id yang di-upload di sesi form ini dan belum di-submit.

## Attach ke dokumen

POST /api/v1/fc/documents
PATCH /api/v1/fc/documents/:id

Field baru / yang sudah ada:

| Field | Tipe | Ket |
|---|---|---|
| personId | number | anggota inti |
| documentTypeSlug | string | slug jenis |
| documentNumber | string | nomor |
| issuedAt | YYYY-MM-DD \| null | opsional |
| expiresAt | YYYY-MM-DD \| null | wajib jika bukan seumur hidup |
| isLifetime | boolean | |
| notes | string \| null | |
| extras | object | field tambahan jenis |
| reminderEnabled | boolean | |
| reminderDays | 7 \| 14 \| 30 \| 60 \| 90 | |
| customTitle | string \| null | wajib jika jenis allowCustomTitle |
| mediaIds | string[] | daftar akhir; PATCH = replace-all |

Kalau PATCH tidak kirim mediaIds, file lama tidak diubah.
Kalau PATCH kirim mediaIds: [] → semua file dilepas.
Create tanpa mediaIds boleh (scan opsional).

## Response detail dokumen

GET /api/v1/fc/documents/:id → data.files[]

{
  "id": 1,
  "mediaId": "med_…",
  "url": "http://…/media/family-core/documents/med_….jpg",
  "sortOrder": 0
}

List dokumen punya fileCount, tanpa url scan (hemat). Preview scan di screen detail + tap fullscreen.

## UI yang harus diubah

Hapus copy dummy:
"Upload scan dokumen"
"Dummy — media upload menyusul."

Ganti dengan dropzone / picker yang sama pola Events (ImageDropzone):
- loading per thumbnail
- tombol hapus per file pending
- hint: "Foto atau scan, maks 5 file, masing-masing 5 MB. JPEG / PNG / WebP / GIF."
- Detail: tampilkan files[].url, tap fullscreen
- Form edit: prefill dari files[], submit mediaIds urutan tampil

## Acceptance

- [ ] Dummy hilang
- [ ] Pilih foto → preview dari url server, bukan blob lokal semata
- [ ] Simpan dokumen baru dengan 1–5 scan → GET detail menampilkan files
- [ ] Edit: hapus / ganti scan, PATCH mediaIds replace-all
- [ ] Batal form → cleanup pending, tidak nyangkut di storage
- [ ] PDF ditolak dengan pesan jelas
```
