# FamilyRoots API — Instalasi & Seeder (First Install)

Panduan setup lokal dari nol: prasyarat, konfigurasi, migrasi database, seed data demo, lalu verifikasi API siap dipakai.

**Stack:** Node.js · Express · TypeScript · Knex · MySQL

---

## Daftar isi

1. [Prasyarat](#1-prasyarat)
2. [Clone & install dependency](#2-clone--install-dependency)
3. [Konfigurasi environment](#3-konfigurasi-environment)
4. [Buat database MySQL](#4-buat-database-mysql)
5. [Migrasi & seed (pertama kali)](#5-migrasi--seed-pertama-kali)
6. [Jalankan server](#6-jalankan-server)
7. [Verifikasi (smoke test)](#7-verifikasi-smoke-test)
8. [Apa yang di-seed](#8-apa-yang-di-seed)
9. [Akun login demo](#9-akun-login-demo)
10. [Script database yang berguna](#10-script-database-yang-berguna)
11. [Troubleshooting](#11-troubleshooting)
12. [Referensi](#12-referensi)

---

## 1. Prasyarat

| Komponen | Catatan |
|---|---|
| **Node.js** | Disarankan **v18+** (LTS) |
| **npm** | Bundled dengan Node |
| **MySQL** | Server lokal atau remote; kosongkan DB sesuai `DB_NAME` |
| **Git** | Untuk clone repo |

Opsional tapi berguna: `jq` (untuk parse JSON di smoke test), Postman (koleksi di `postman/`).

---

## 2. Clone & install dependency

```bash
git clone <repo-url> family-tree-api
cd family-tree-api
npm install
```

---

## 3. Konfigurasi environment

```bash
cp .env.example .env
```

Edit `.env` minimal untuk lokal:

```env
PORT=3000
NODE_ENV=development

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=family_tree

# Dev: boleh * — production harus origin FE eksplisit
CORS_ORIGINS=*

# Ganti di production (min ~32 karakter)
JWT_SECRET=change-me-in-production-min-32-chars-dev
ACCESS_TTL=3600
REFRESH_TTL_REMEMBER=2592000
REFRESH_TTL_SESSION=86400

LOGIN_RATE_LIMIT_MAX=10
LOGIN_RATE_LIMIT_WINDOW_MS=900000

MEDIA_STORAGE_DIR=./uploads/media
MEDIA_PUBLIC_BASE_URL=http://localhost:3000/media
MEDIA_MAX_FILE_BYTES=5242880
```

| Variabel | Wajib | Keterangan |
|---|---|---|
| `DB_*` | Ya | Kredensial MySQL + nama database |
| `JWT_SECRET` | Ya (auth) | Secret penandatanganan JWT |
| `CORS_ORIGINS` | Direkomendasikan | Origin FE, contoh `http://localhost:5173` |
| `MEDIA_*` | Jika pakai upload | Storage lokal untuk media |

Lihat semua default di [`.env.example`](../.env.example).

---

## 4. Buat database MySQL

Buat database kosong yang namanya sama dengan `DB_NAME`:

```sql
CREATE DATABASE family_tree CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Pastikan user MySQL punya hak `CREATE`, `ALTER`, `INSERT`, `UPDATE`, `DELETE`, `SELECT` pada database tersebut.

---

## 5. Migrasi & seed (pertama kali)

Satu perintah untuk migrate + seed:

```bash
npm run db:setup
```

Ini setara dengan:

```bash
npm run migrate   # knex migrate:latest
npm run seed      # knex seed:run
```

### Urutan seed

Knex menjalankan file di `src/database/seeds/` berurutan:

| File | Isi |
|---|---|
| `01_mock_family_data.ts` | Family, 95 persons, spouses, details, addresses, family members |
| `02_events_memoriam_data.ts` | Sample family events + in-memoriam (tributes / prayers) |

Sumber data keluarga: [`docs/seed/mock-family-seed.json`](./seed/mock-family-seed.json).

### Output sukses (contoh)

Di console seed biasanya muncul ringkasan seperti:

```text
Seed OK: persons=95, alive=63, deceased=32, spouses=43, ...
familyId=1, rootPersonId=83 (slug: me)
Login code smoke (derived): demo-mr=MR170845, me=MIA210399, father=BA200175
```

> **Catatan:** seed **menghapus lalu mengisi ulang** tabel domain family / events / memoriam terkait. Jangan jalankan `npm run seed` di database yang berisi data produksi penting.

---

## 6. Jalankan server

### Development (hot reload)

```bash
npm run dev
```

API default: `http://localhost:3000`  
Prefix: `/api/v1`

### Production build

```bash
npm run build
npm start
```

---

## 7. Verifikasi (smoke test)

### Health

```bash
curl http://localhost:3000/api/v1/health
# {"status":"ok"}  (atau bentuk { "data": ... } sesuai kontrak endpoint)
```

### Login + me

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"code":"MIA210399","remember":false}' \
  | jq -r '.data.accessToken')

curl -s http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN" | jq
```

### List persons (harus ~95 dari seed)

```bash
curl -s "http://localhost:3000/api/v1/persons?page=1&limit=5" \
  -H "Authorization: Bearer $TOKEN" | jq '.data.pagination'
```

### Postman

1. Import `postman/FamilyRoots-API.postman_collection.json`
2. Import `postman/FamilyRoots-Local.postman_environment.json`
3. Aktifkan environment **FamilyRoots — Local**
4. Jalankan **Auth → Login** lalu endpoint lain

Detail: [`postman/README.md`](../postman/README.md).

### Unit test

```bash
npm test
```

---

## 8. Apa yang di-seed

| Item | Nilai |
|---|---|
| Family slug / name | `family-ardhyansah-demo` / Keluarga Ardhyansah (Demo) |
| Root person (slug) | `me` → biasanya integer id **83** |
| Total persons | **95** |
| Alive (bisa login) | **63** |
| Deceased (tidak bisa login) | **32** |
| Spouse rows (canonical) | **43** |
| Admin | **2** (`me`, `demo-mr`) |

### Mapping slug → ID

Mock FE memakai slug string (`me`, `father`, …). Saat seed, slug dipetakan ke integer berurutan sesuai urutan array di JSON (`index + 1`).

`isSelf` dan `generationLabel` **tidak disimpan** di DB — dihitung di API dari `personId` yang login.

### Login code

Kode login **derived** (tidak disimpan sebagai password) dari `fullName` + `birthDate`:

- Singkatan nama dari `fullName` (nickname diabaikan; gelar seperti `H.` / `Hj.` dibuang)
- Suffix tanggal: `DDMMYY` dari `birthDate`

Contoh: `Mochamad Irfani Ardhyansah` + `1999-03-21` → `MIA210399`.

Detail aturan: [`BE-MOCK-SEEDER.md`](./BE-MOCK-SEEDER.md), [`BE-AUTH-API-PLAN.md`](./BE-AUTH-API-PLAN.md).

---

## 9. Akun login demo

| Login code | Slug | Nama | Role |
|---|---|---|---|
| **`MIA210399`** | `me` | Mochamad Irfani Ardhyansah | admin (root) |
| `MR170845` | `demo-mr` | Mulyono Raka | admin |
| `AK170501` | `me-sp` | Hj. Ayu Kirana | member (pasangan root) |
| `BA200175` | `father` | H. Budi Ardhyansah | member |
| `CM121076` | `mother` | Hj. Citra Maharani | member |

Akun **deceased** tidak bisa login meski kode bisa dihitung.

---

## 10. Script database yang berguna

| Script | Keterangan |
|---|---|
| `npm run db:setup` | **Pertama kali / reset demo:** migrate + seed |
| `npm run migrate` | Jalankan migration terbaru saja |
| `npm run migrate:status` | Status migration |
| `npm run migrate:rollback` | Rollback satu batch |
| `npm run migrate:reset` | Rollback semua migration |
| `npm run seed` | Jalankan ulang semua seeder (wipe + isi ulang data demo) |
| `npm run seed:make` | Scaffold file seed baru |
| `npm run migrate:make` | Scaffold file migration baru |

### Reset total (dev saja)

Jika ingin DB bersih total:

```sql
DROP DATABASE family_tree;
CREATE DATABASE family_tree CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Lalu:

```bash
npm run db:setup
```

---

## 11. Troubleshooting

### Knex mengeluh migration lama hilang

Jika error menyebut migration lama (mis. `20251209150240_...`), bersihkan bookkeeping Knex sekali (dev):

```sql
DROP TABLE IF EXISTS knex_migrations;
DROP TABLE IF EXISTS knex_migrations_lock;
-- opsional wipe penuh:
-- DROP DATABASE family_tree; CREATE DATABASE family_tree CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Kemudian:

```bash
npm run db:setup
```

### Gagal koneksi MySQL

- Pastikan MySQL jalan dan `DB_HOST` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` benar
- Database sudah dibuat (lihat [§4](#4-buat-database-mysql))
- User punya privilege yang cukup

### Seed gagal validasi count

Seeder memvalidasi jumlah persons / alive / deceased / spouses / admin. Jika gagal:

1. Pastikan `docs/seed/mock-family-seed.json` utuh
2. Pastikan migration sudah `latest` sebelum seed
3. Coba reset DB lalu `npm run db:setup`

### CORS di FE lokal

Set origin Vite (contoh):

```env
CORS_ORIGINS=http://localhost:5173
```

Lalu restart `npm run dev`.

### Login `CODE_NOT_FOUND`

- Person harus **alive**
- Kode case-sensitive format `[A-Z]+` + 6 digit
- Pastikan seed sudah jalan (bukan DB kosong)

### Folder media

Upload membutuhkan direktori storage. Default `./uploads/media` dibuat/dipakai saat fitur media dipakai — pastikan proses Node punya hak tulis di folder project.

---

## 12. Referensi

| Dokumen | Isi |
|---|---|
| [`../readme.md`](../readme.md) | Ringkasan setup & arsitektur |
| [`DATABASE-DESIGN.md`](./DATABASE-DESIGN.md) | Desain schema |
| [`BE-MOCK-SEEDER.md`](./BE-MOCK-SEEDER.md) | Spec mock → seeder + akun uji |
| [`seed/mock-family-seed.json`](./seed/mock-family-seed.json) | Artifact data seed |
| [`FE-API-INTEGRATION.md`](./FE-API-INTEGRATION.md) | Integrasi FE + smoke curl |
| [`../postman/README.md`](../postman/README.md) | Postman collection |
| [`MEDIA-UPLOAD-API.md`](./MEDIA-UPLOAD-API.md) | Upload media |
| [`PERSONS-IMPORT-API.md`](./PERSONS-IMPORT-API.md) | Import persons (CSV/JSON) |

### Checklist first install

- [ ] Node 18+ & MySQL terpasang
- [ ] `npm install`
- [ ] `.env` dari `.env.example` (DB + JWT)
- [ ] Database kosong dibuat
- [ ] `npm run db:setup` sukses
- [ ] `npm run dev` → health OK
- [ ] Login `MIA210399` → `GET /auth/me` OK
- [ ] (Opsional) Postman / `npm test`
