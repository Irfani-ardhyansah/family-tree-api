# Family Core — Dokumen Penting

## Overview

Fitur untuk menyimpan dan mengelola dokumen penting anggota keluarga inti (Bapak, Ibu, Anak, Pasangan). Fokus pada kemudahan akses nomor dokumen, reminder kadaluarsa, dan arsip digital scan dokumen.

---

## Scope

- **Modul:** Family Core (`fc_`)
- **Pengguna:** Keluarga inti (Bapak, Ibu, Anak, Pasangan)
- **Mertua:** Jika sudah ada pasangan (`spouse`), tampilkan juga mertua (ayah/ibu pasangan) di selector anggota
- **Akses:** Private — hanya anggota `core_family_members` yang terdaftar

---

## Jenis Dokumen

Jenis dokumen adalah **master data CRUD** (`fc_document_types`), bukan enum hardcode.

Default seeder (lengkap + field extras): lihat  
[`FAMILY-CORE-DOCUMENT-TYPES-SEEDER-BE-PROMPT.md`](./FAMILY-CORE-DOCUMENT-TYPES-SEEDER-BE-PROMPT.md)

| Jenis (default) | Field Tambahan |
|---|---|
| KTP / NIK | — (seumur hidup default) |
| Kartu Keluarga | — |
| Akta Lahir | — |
| Paspor | tanggal exp |
| BPJS Kesehatan | faskes, kelas |
| BPJS Ketenagakerjaan | — |
| NPWP | — |
| SIM | jenis SIM (A/B/C), tanggal exp |
| STNK | plat nomor, tanggal exp |
| Ijazah / Sertifikat | institusi, tahun |
| Rekening Bank | bank |
| Lainnya | custom label (`allow_custom_title`) |

FE: `/core/documents/types` — kelola jenis (tambah/edit; hapus hanya untuk non-seeder & tidak dipakai).

---

## Flow UI

### Screen 1 — Dashboard dokumen

**Layout:**
- Navbar: judul "Dokumen penting" + tombol "+ Tambah" di kanan
- Member selector: 4 avatar card horizontal (Bapak, Ibu, Irfani, Ayu) — klik untuk filter dokumen
- Card aktif ditandai dengan border accent biru
- Di bawah selector: list dokumen milik anggota yang dipilih

**Per baris dokumen:**
- Icon kategori (color-coded per jenis)
- Nama dokumen + nomor (disamarkan sebagian) + info singkat
- Badge status: `Aktif` (hijau) / `Segera exp` (kuning) / `Kadaluarsa` (merah)
- Icon copy untuk quick copy nomor dokumen

**Sorting default:** Dokumen yang segera/sudah kadaluarsa muncul di atas.

---

### Screen 2 — Form tambah / edit dokumen

**Field:**

| Field | Tipe | Keterangan |
|---|---|---|
| Untuk anggota | Select | Pilih dari daftar anggota inti |
| Jenis dokumen | Select | Dari daftar jenis yang tersedia |
| Nomor dokumen | Text | Nomor utama dokumen |
| Tanggal terbit | Date | Opsional |
| Tanggal kadaluarsa | Date / Toggle | "Seumur hidup" jika tidak ada expiry |
| Catatan | Textarea | Opsional, info tambahan |
| Reminder | Toggle | Aktif/nonaktif reminder |
| Jarak reminder | Select | 7 / 14 / 30 / 60 / 90 hari sebelumnya |
| Upload dokumen | File upload | Foto atau scan, opsional |

---

### Screen 3 — Detail dokumen

**Layout:**
- Navbar: tombol back + nama dokumen + tombol edit (ikon pensil)
- Preview foto/scan dokumen (jika ada) — tap untuk fullscreen
- Semua field lengkap ditampilkan dalam format label + value
- Nomor dokumen: tampil dengan tombol copy di sampingnya
- Status badge + info sisa waktu jika ada expiry (`"Kadaluarsa dalam 32 hari"`)
- Tombol hapus di bagian bawah (destructive, warna merah)

---

## Logika Status Dokumen

```
Tidak ada expiry date  → badge "Aktif" (hijau)
Expiry > 90 hari       → badge "Aktif" (hijau)
Expiry 1–90 hari       → badge "Segera exp" (kuning) + muncul di atas list
Expiry sudah lewat     → badge "Kadaluarsa" (merah) + muncul paling atas
```

---

## Reminder

- Reminder dikirim via notifikasi in-app (dan opsional email)
- Jarak reminder bisa diset per dokumen
- Default: 30 hari sebelum kadaluarsa
- Dokumen tanpa expiry date tidak perlu reminder

---

## Catatan Teknis

- Prefix tabel: `fc_`
- Tabel utama: `fc_documents`, `fc_document_files`
- File upload disimpan di storage (Nextcloud / S3), bukan di DB langsung
- Nomor dokumen di-encrypt at rest (data sensitif)
- Filter per anggota menggunakan `fc_member_id` → relasi ke `core_family_members`

---

## Status Develop

- [ ] Screen 1 — Dashboard dokumen
- [ ] Screen 2 — Form tambah / edit
- [ ] Screen 3 — Detail dokumen
- [ ] Logika badge status + sorting
- [ ] Sistem reminder
- [ ] Upload & preview scan dokumen
