# Token MCP — integrasi FE

Status BE: **implemented di repo** (migration + endpoint sudah ada; deploy STB menyusul).

Update 2026-11-08: arsitektur final adalah **1 orang = 1 agent Nouride = 1 token**.
Nouride adalah pengganti Hermes Agent dan sudah terpasang di STB. Tidak ada perubahan
endpoint, schema, atau response BE. Dokumen ini diperbarui untuk copy UI dan panduan
menghubungkan token ke Nouride.

Update 2026-11-08 (copy modal): Token MCP otomatis bisa mengakses **Family Roots**,
**Task Board**, dan **Money Track** sesuai hak akun. Ketiganya **tidak punya checkbox**.
Checkbox hanya untuk **Family Core** dan **Household** (modul opsional; butuh password
kedua).

Fitur: user non-admin bisa membuat, melihat, dan menghapus token MCP miliknya sendiri.
Admin bisa melihat semua token di keluarganya dan mencabut paksa token siapa pun.
Token dipakai oleh MCP client seperti Nouride sebagai `Authorization: Bearer frmcp_...`.

Token asli **hanya muncul sekali** saat dibuat. Server hanya menyimpan hash-nya.

---

## 1. Alur produk

### User non-admin

Tempat: **Profil / Pengaturan → Token MCP** (atau bagian "Integrasi").

1. User melihat daftar token miliknya.
2. Tombol **Buat token** membuka modal:
   - Label, contoh "Nouride - Discord", "Nouride - Telegram", "Laptop".
     Default `Nouride`.
   - Helper text: "Satu token untuk satu agent Nouride. Kalau kamu punya beberapa
     agent atau device, buat token terpisah untuk masing-masing."
   - **Info akses default (bukan pilihan):** "Token MCP otomatis bisa mengakses
     **Family Roots**, **Task Board**, dan **Money Track** sesuai hak akun.
     Tidak ada checkbox untuk ketiganya."
   - **Pilihan modul opsional:** tampilkan checkbox **Family Core** dan
     **Household**. Helper text: "Centang hanya kalau agent perlu akses modul ini.
     Token tanpa centang tidak bisa mengakses modul tersebut."
3. Kalau user memilih modul opsional, FE harus meminta password kedua dulu lewat
   flow yang sudah ada (`POST /auth/secondary-password/verify`), lalu kirim
   `X-Module-Unlock` saat membuat token. Kalau belum punya password kedua, arahkan
   untuk setup dulu atau buat token dengan akses default saja.
4. Setelah sukses, tampilkan token di modal dengan tombol **Salin** dan peringatan:
   "Token ini hanya ditampilkan sekali. Simpan di tempat aman. Kalau hilang, hapus
   lalu buat baru."
5. User menempelkan token itu ke agent Nouride miliknya. Arahkan ke panduan di
   bagian 6, bukan ke `/link <token>`.
6. Di daftar, user bisa menghapus token. Konfirmasi: "Token ini akan langsung
   berhenti bekerja. Agent Nouride yang memakainya harus diisi token baru."

FE **tidak perlu** menyimpan Discord ID, ID agent Nouride, atau token setelah modal
ditutup. Token hanya ditampilkan sekali dan tidak bisa dibaca ulang dari API.

### Admin

Tempat: **Admin → Token MCP** (sidebar admin, hanya `isAdmin` + `X-Module-Unlock`).

1. Tabel semua token di keluarga: nama person, label, hint token, akses modul,
   tanggal dibuat, terakhir dipakai, status.
2. Filter person dan status (`active`, `revoked`, `all`).
3. Satu person boleh punya beberapa token, satu per agent/device Nouride.
4. Tombol **Cabut paksa** per baris. Konfirmasi: "Token ini langsung berhenti
   bekerja untuk user tersebut. Agent Nouride yang memakainya akan kehilangan akses."
5. Admin tidak bisa melihat token asli. Yang tampil hanya hint, mis.
   `frmcp_ab12...wxyz`.

---

## 2. Endpoint user (Bearer sesi aplikasi)

Base: `/api/v1`. Envelope sukses: `{ "data": ... }`.
Error: `{ "error": { "code", "message", "requestId" } }`.

| Method | Path | Fungsi |
|--------|------|--------|
| `GET` | `/auth/mcp-tokens` | Daftar token milik sendiri (aktif + dicabut) |
| `POST` | `/auth/mcp-tokens` | Buat token baru |
| `DELETE` | `/auth/mcp-tokens/:id` | Hapus/cabut token milik sendiri |

Endpoint ini **hanya menerima JWT sesi aplikasi**, bukan token MCP. Kalau dikirim
token MCP, response `403 FORBIDDEN`.

### Buat token

```http
POST /api/v1/auth/mcp-tokens
Authorization: Bearer <accessToken>
X-Module-Unlock: <unlockToken>        # opsional, wajib kalau minta core/household
Content-Type: application/json

{
  "label": "Nouride - Discord",
  "modules": []
}
```

Aturan `modules`:

- Family Roots, Task Board, dan Money Track **selalu bisa** diakses token MCP;
  ketiganya tidak memakai `modules` dan tidak punya checkbox.
- `modules` hanya untuk modul opsional: `core` dan `household`.
- `modules` tidak dikirim / `modules: []` → token hanya mendapat akses default
  (Family Roots, Task Board, Money Track).
- `modules: ["core"]` atau `modules: ["household"]` → modul itu harus ada di
  `unlockToken`.
- `modules: ["money"]` → diterima untuk kompatibilitas, tetapi Money Track tetap
  otomatis dan tidak butuh `unlockToken`.
- `admin` tidak boleh. Response `422 VALIDATION_ERROR`.
- Kalau minta `core`/`household` tanpa unlock header atau unlock kedaluwarsa →
  `403 SECONDARY_UNLOCK_REQUIRED` atau `403 SECONDARY_UNLOCK_INVALID`.

Contoh: token dengan akses Family Core.

```ts
const unlock = await api.post('/auth/secondary-password/verify', { password });
const created = await api.post(
  '/auth/mcp-tokens',
  { label: 'Nouride - Discord', modules: ['core'] },
  { headers: { 'X-Module-Unlock': unlock.data.unlockToken } },
);
```

Response `201`:

```json
{
  "data": {
    "token": "frmcp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "item": {
      "id": 12,
      "label": "Nouride - Discord",
      "tokenHint": "frmcp_xxxxxxx...xxxx",
      "unlocks": ["money", "core"],
      "createdAt": "2026-11-07T10:00:00.000Z",
      "lastUsedAt": null,
      "expiresAt": null,
      "revokedAt": null,
      "isActive": true
    }
  }
}
```

`token` hanya ada di response ini. Jangan simpan di localStorage, jangan tampilkan
lagi setelah modal ditutup. Response memakai `Cache-Control: no-store`.

### Daftar token sendiri

```http
GET /api/v1/auth/mcp-tokens
Authorization: Bearer <accessToken>
```

```json
{
  "data": {
    "items": [
      {
        "id": 12,
        "label": "Nouride - Discord",
        "tokenHint": "frmcp_xxxxxxx...xxxx",
        "unlocks": ["money"],
        "createdAt": "2026-11-07T10:00:00.000Z",
        "lastUsedAt": "2026-11-07T10:05:00.000Z",
        "expiresAt": null,
        "revokedAt": null,
        "isActive": true
      },
      {
        "id": 11,
        "label": "Laptop lama",
        "tokenHint": "frmcp_yyyyyyy...yyyy",
        "unlocks": ["money"],
        "createdAt": "2026-11-01T09:00:00.000Z",
        "lastUsedAt": null,
        "expiresAt": null,
        "revokedAt": "2026-11-02T09:00:00.000Z",
        "isActive": false
      }
    ]
  }
}
```

Maksimal **5 token aktif** per person. Kalau penuh, response `409
MCP_TOKEN_LIMIT_REACHED`. User harus menghapus token lama dulu.

### Hapus token sendiri

```http
DELETE /api/v1/auth/mcp-tokens/12
Authorization: Bearer <accessToken>
```

```json
{
  "data": {
    "revoked": true,
    "item": {
      "id": 12,
      "label": "Nouride - Discord",
      "tokenHint": "frmcp_xxxxxxx...xxxx",
      "unlocks": ["money"],
      "createdAt": "2026-11-07T10:00:00.000Z",
      "lastUsedAt": "2026-11-07T10:05:00.000Z",
      "expiresAt": null,
      "revokedAt": "2026-11-07T10:10:00.000Z",
      "isActive": false
    }
  }
}
```

Hapus = revoke (baris tetap ada untuk audit). Double-click aman: token yang sudah
dicabut tetap mengembalikan `revoked: true`.

---

## 3. Endpoint admin

Semua endpoint admin butuh Bearer sesi admin + `X-Module-Unlock` admin, sama seperti
halaman admin lain. Token MCP tidak bisa mengakses endpoint ini.

| Method | Path | Fungsi |
|--------|------|--------|
| `GET` | `/admin/mcp-tokens` | Semua token di keluarga |
| `POST` | `/admin/mcp-tokens/:id/revoke` | Cabut paksa token |

### Daftar token keluarga

```http
GET /api/v1/admin/mcp-tokens?status=active&personId=83
Authorization: Bearer <accessToken>
X-Module-Unlock: <unlockToken>
```

Query:

- `status` — `active` (default), `revoked`, atau `all`.
- `personId` — opsional, filter satu person.
- Maksimal 200 baris, urut terbaru.

```json
{
  "data": {
    "items": [
      {
        "id": 12,
        "personId": 83,
        "personName": "Mochamad Irfani Ardhyansah",
        "label": "Nouride - Discord",
        "tokenHint": "frmcp_xxxxxxx...xxxx",
        "unlocks": ["money"],
        "createdAt": "2026-11-07T10:00:00.000Z",
        "lastUsedAt": "2026-11-07T10:05:00.000Z",
        "expiresAt": null,
        "revokedAt": null,
        "isActive": true
      }
    ]
  }
}
```

### Cabut paksa

```http
POST /api/v1/admin/mcp-tokens/12/revoke
Authorization: Bearer <accessToken>
X-Module-Unlock: <unlockToken>
```

```json
{
  "data": {
    "revoked": true,
    "item": {
      "id": 12,
      "personId": 83,
      "personName": "Mochamad Irfani Ardhyansah",
      "label": "Nouride - Discord",
      "tokenHint": "frmcp_xxxxxxx...xxxx",
      "unlocks": ["money"],
      "createdAt": "2026-11-07T10:00:00.000Z",
      "lastUsedAt": "2026-11-07T10:05:00.000Z",
      "expiresAt": null,
      "revokedAt": "2026-11-07T10:10:00.000Z",
      "isActive": false
    }
  }
}
```

Aksi admin tercatat di audit log admin (`module_id=admin`, action `delete`, summary
"Cabut paksa token MCP ...").

---

## 4. UI yang disarankan

### User — daftar token

- Judul: **Token MCP**.
- Kalimat: "Token ini dipakai agent Nouride atau MCP client lain untuk mengakses data
  FamilyRoots atas nama kamu. Perlakukan seperti password."
- Kolom/kartu: label, hint token, badge akses (`Money` otomatis; `Core`/`Household`
  kalau dipilih), dibuat, terakhir dipakai, status.
- Token aktif: tombol **Hapus**.
- Token dicabut: badge "Dicabut", tanpa tombol hapus.
- Kosong: "Belum ada token MCP. Buat token kalau kamu ingin menghubungkan agent Nouride."

### User — modal buat token

- Field label, max 60 karakter, default `Nouride`.
- Info default: **Family Roots, Task Board, Money Track otomatis aktif**.
- Checkbox akses opsional:
  - Family Core
  - Household
- Kalau user centang modul opsional:
  - Pastikan sudah unlock password kedua. Kalau belum, buka flow unlock yang ada.
  - Kirim `X-Module-Unlock` pada request create.
- Tombol **Buat token** disabled saat request berjalan.
- Setelah sukses: tampilkan token penuh + tombol Salin + peringatan sekali tampil.
- Jangan tutup modal otomatis sebelum user menekan "Selesai" atau "Salin".

### User — hapus token

Konfirmasi: "Hapus token **{label}**? Agent Nouride yang memakai token ini akan
langsung kehilangan akses. Buat token baru lalu ganti di Nouride."

### Admin — tabel token

- Kolom: person, label, hint, akses, dibuat, terakhir dipakai, status, aksi.
- Filter person (dropdown/select) dan status.
- Badge status: **Aktif** / **Dicabut**.
- Tombol **Cabut paksa** hanya untuk token aktif.
- Konfirmasi: "Cabut token **{label}** milik **{person}**? Agent Nouride yang
  memakainya langsung kehilangan akses."

---

## 5. Error

| HTTP | code | UI |
|------|------|----|
| 401 | `UNAUTHORIZED` | Sesi habis. Login ulang. |
| 401 | `MCP_TOKEN_INVALID` | Token MCP tidak valid/dicabut. Ganti token di Nouride, buat token baru. |
| 403 | `FORBIDDEN` | Token MCP mencoba akses admin/kelola token/keamanan akun. Gunakan sesi aplikasi. |
| 403 | `SECONDARY_UNLOCK_REQUIRED` | Minta password kedua dulu, lalu buat ulang token. |
| 403 | `SECONDARY_UNLOCK_INVALID` | Unlock kedaluwarsa. Verifikasi password kedua ulang. |
| 404 | `MCP_TOKEN_NOT_FOUND` | Token sudah tidak ada. Refresh daftar. |
| 409 | `MCP_TOKEN_LIMIT_REACHED` | "Maksimal 5 token aktif. Hapus token lama dulu." |
| 422 | `VALIDATION_ERROR` | Tampilkan `error.message`. |

---

## 6. Panduan Nouride (pengganti Hermes)

Arsitektur: **1 orang = 1 agent Nouride = 1 token FamilyRoots**. FE hanya mengurus
token; agent Nouride dibuat dan diatur sendiri oleh masing-masing orang.

### Langkah untuk user

1. Buat token di FamilyRoots dengan label `Nouride - <nama agent>`.
2. Copy token dari modal (hanya muncul sekali).
3. Di Nouride, buka agent tersebut → **Connectors** → **FamilyRoots**, lalu isi
   token sebagai credential.
4. Simpan token di secret store/credential agent Nouride. Jangan menaruh token
   mentah di file config yang di-commit. Kalau setup lewat CLI, ikuti dokumentasi
   Nouride untuk perintah secret/agent yang tersedia.

5. Kalau token dicabut atau hilang, agent akan gagal dengan `MCP_TOKEN_INVALID`.
   Buat token baru lalu ganti credential di agent Nouride.

### Yang tidak perlu dilakukan FE

- Tidak perlu mengirim atau menyimpan `discord_id`.
- Tidak perlu menyimpan token di database FE.
- Tidak perlu mengelola bot/agent Nouride.
- Tidak perlu menampilkan token lagi setelah modal ditutup.
- Tidak perlu meminta user mengetik login code atau secondary password ke Nouride.
  Cukup token MCP.

### Catatan untuk copy UI

- Satu person boleh punya beberapa token, satu per agent/device.
- Cabut paksa dari admin = agent yang memakai token itu langsung kehilangan akses.
- Money Track otomatis "trusted" untuk semua token MCP; tidak perlu
  `X-Module-Unlock` di setiap request. Karena itu token harus diperlakukan seperti
  password.
- Token MCP tidak bisa mengubah password kedua, WebAuthn, logout, opsi profil, atau
  push subscription. Endpoint itu tetap butuh sesi aplikasi.

---

## 7. Jangan dilakukan

- Jangan simpan token asli di `localStorage`, `sessionStorage`, cookie, atau state
  global setelah modal ditutup.
- Jangan menganggap token MCP hanya bisa baca. Token mengikuti hak user untuk
  endpoint non-admin (kecuali kelola token dan admin). Karena itu token harus
  diperlakukan seperti password.
- Jangan tampilkan token asli lagi dari `GET /auth/mcp-tokens` — server tidak
  menyimpannya.
- Jangan kirim token lewat query string atau log.
- Jangan pakai token MCP untuk membuat/menghapus token lain; endpoint itu hanya
  menerima sesi aplikasi.
- Jangan tampilkan halaman admin token ke member.
- Jangan menganggap token MCP otomatis punya akses Core/Household. Cek `unlocks`
  di response. Money selalu ada di `unlocks`; Core/Household hanya kalau dipilih.
- Jangan auto-retry create token tanpa idempotency; kalau timeout, refresh daftar
  dulu untuk melihat apakah token sudah terbuat.
