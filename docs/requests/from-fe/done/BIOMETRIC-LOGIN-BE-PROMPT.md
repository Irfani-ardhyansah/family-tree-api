# Prompt BE — Login biometrik (WebAuthn)

FE sudah memanggil kontrak di bawah. Jangan ganti path, nama field, atau kode error. Kalau endpoint belum ada, FE menganggap fitur mati (`404` `NOT_FOUND` dari `notFoundHandler`).

Package FE: `@simplewebauthn/browser` **14**. Options JSON dari server diteruskan apa adanya ke `startAuthentication` / `startRegistration`. Assertion / attestation dikirim balik apa adanya, plus field tambahan yang disebut di bawah.

Yang disimpan bukan citra sidik jari. Yang wajib disimpan untuk verifikasi WebAuthn: credential id, public key (COSE), dan counter. Label adalah teks yang diketik user.

Bahasa error `message` boleh Indonesia. Field JSON English. Envelope sukses `{ "data": ... }`. Error `{ "error": { "code", "message", "requestId" } }` lewat `AppError`, sama seperti endpoint lain.

Login biometrik menerbitkan sesi yang sama dengan `POST /auth/login`: panggil `issueTokenPair` + `toAuthPersonSummary` + `secondaryPasswordService.getStatus`. Jangan buat jenis token baru. `remember: true` → refresh 30 hari, `false` → 1 hari (aturan `getRefreshExpiry` yang sudah ada).

---

## Perubahan skema

MySQL. `core_module_statuses.module_id` sekarang ENUM `roots, core, money, household` (migrasi `20260726100000_create_admin_panel_core.ts`).

### 1. Enum modul

Tambah nilai `biometric`. Jangan masukkan `biometric` ke `ADMIN_MODULE_IDS` yang dipakai backup/export — itu daftar modul data, bukan saklar login.

Pisahkan daftar status, misalnya:

```ts
export const MODULE_STATUS_IDS = [...ADMIN_MODULE_IDS, 'biometric'] as const;
```

`module-status.service` / `isAdminModuleId` untuk toggle status harus menerima `biometric`. `PATCH /admin/modules/biometric/status` hari ini jatuh ke `ADMIN_MODULE_NOT_FOUND`.

`ensureDefaults` sekarang mengisi modul yang hilang dengan `enabled: true`. Untuk `biometric` saja, default **`enabled: false`**. Modul lain tetap `true`. Jangan menyalakan biometrik untuk keluarga yang sudah ada.

Label audit: `Login biometrik`.

Mematikan modul tidak menghapus baris jari dan tidak memaksa logout.

### 2. Tabel baru `core_webauthn_credentials`

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | bigint unsigned PK | Ini `:id` di URL. Bukan credential id WebAuthn. |
| `family_id` | int unsigned FK `core_families` | Cascade delete. |
| `person_id` | int unsigned FK `core_persons` | Pemilik. Cascade delete. |
| `label` | varchar(40) not null | Teks user, sudah di-trim. |
| `enabled` | boolean not null default true | Admin yang mengubah. User tidak. |
| `credential_id` | varchar(512) not null unique | `id` base64url dari response WebAuthn. |
| `public_key` | blob / varbinary not null | Public key COSE dari `verifyRegistrationResponse`. |
| `counter` | bigint unsigned not null default 0 | Naik setiap assertion sukses. |
| `transports` | json null | Opsional, dari response. |
| `last_used_at` | timestamp null | Diisi saat login biometrik sukses. |
| `created_at` / `updated_at` | timestamp | |

Index: `person_id`, `family_id`. Unik global pada `credential_id`.

Maksimal **2 baris per `person_id`**, termasuk yang `enabled = false`. Slot baru hanya ada setelah baris dihapus.

### 3. Tabel baru `core_webauthn_challenges`

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | bigint unsigned PK | |
| `person_id` | int unsigned null | Terisi saat register. Null saat login (belum tahu siapa). |
| `kind` | enum `login`, `register` | |
| `challenge` | varchar(512) not null unique | |
| `expires_at` | timestamp not null | Pendek, sekitar 5 menit. |
| `created_at` | timestamp | |

Pakai sekali. Setelah verify (sukses atau gagal karena signature), hapus. Kalau sudah lewat `expires_at` atau tidak ketemu: `400` `BIOMETRIC_CHALLENGE_EXPIRED`.

---

## WebAuthn

Pakai `@simplewebauthn/server` yang cocok dengan browser 14 (`generateAuthenticationOptions`, `generateRegistrationOptions`, `verifyAuthenticationResponse`, `verifyRegistrationResponse`).

Env:

- `WEBAUTHN_RP_ID` — hostname saja, tanpa skema. Localhost untuk dev.
- `WEBAUTHN_RP_NAME` — `FamilyRoots`.
- `WEBAUTHN_ORIGIN` — origin penuh yang dipakai FE, misalnya `http://localhost:5173`.

Login **tanpa username**. `POST /auth/webauthn/login/options` body `{}`. `allowCredentials` kosong supaya kredensial discoverable. `userVerification: "required"`.

Register (user sudah login):

- `authenticatorAttachment: "platform"`
- `residentKey: "required"`
- `userVerification: "required"`
- `user.id` dari `person.id`, `user.name` / `displayName` dari nama orang
- `excludeCredentials` = credential id yang sudah dimiliki orang itu, supaya jari yang sama ditolak

`expectedOrigin` dan `expectedRPID` harus sama dengan env. Jangan percaya origin dari klien.

---

## Endpoint user

| Method | Path | Auth |
|---|---|---|
| `POST` | `/api/v1/auth/webauthn/login/options` | Tidak |
| `POST` | `/api/v1/auth/webauthn/login/verify` | Tidak |
| `POST` | `/api/v1/auth/webauthn/register/options` | Bearer |
| `POST` | `/api/v1/auth/webauthn/register/verify` | Bearer |
| `GET` | `/api/v1/auth/webauthn/credentials` | Bearer |
| `PATCH` | `/api/v1/auth/webauthn/credentials/:id` | Bearer, milik sendiri |
| `DELETE` | `/api/v1/auth/webauthn/credentials/:id` | Bearer, milik sendiri |

### Login options

Body `{}`. `data` = options JSON untuk `startAuthentication`.

Kalau tidak ada keluarga dengan modul `biometric` enabled, `403` `BIOMETRIC_DISABLED`. Deploy ini satu keluarga: cek keluarga itu.

### Login verify

Body = objek assertion dari `startAuthentication`, plus `remember` boolean.

Urutan cek setelah assertion cocok dengan satu baris:

1. Modul keluarga pemilik mati → `403` `BIOMETRIC_DISABLED`
2. `enabled = false` → `403` `BIOMETRIC_CREDENTIAL_DISABLED`
3. Signature / counter gagal → `401` `BIOMETRIC_VERIFICATION_FAILED`
4. Credential id tidak ada → `404` `BIOMETRIC_CREDENTIAL_NOT_FOUND` (kode ini, bukan `NOT_FOUND` polos)

Sukses: update `counter` dan `last_used_at`, lalu response **sama** dengan `POST /auth/login`:

```json
{
  "data": {
    "accessToken": "...",
    "refreshToken": "...",
    "expiresIn": 3600,
    "sessionId": 12,
    "person": { "id": 83, "isAdmin": true },
    "secondaryPassword": { "isSet": true, "mustSetup": false, "unlocks": ["admin", "core", "money", "household"] }
  }
}
```

`person` lengkap seperti login kode keluarga (`toAuthPersonSummary`). Jangan logout sesi lain.

### Register

`register/options` body `{}`. Tolak `403` `BIOMETRIC_DISABLED` bila modul keluarga user mati. Tolak `409` `BIOMETRIC_LIMIT_REACHED` bila orang itu sudah punya 2 baris.

`register/verify` body = objek dari `startRegistration` plus `label` (string, trim, 1–40). Label kosong atau lebih dari 40 → `422` `VALIDATION_ERROR` dengan `error.message` yang bisa ditampilkan apa adanya.

Credential id sudah ada → `409` `BIOMETRIC_CREDENTIAL_EXISTS`.

Sukses `200`:

```json
{
  "data": {
    "id": 4,
    "label": "Telunjuk kanan",
    "enabled": true,
    "createdAt": "2026-09-22T15:00:00.000Z",
    "lastUsedAt": null
  }
}
```

### Daftar milik sendiri

```json
{
  "data": {
    "items": [
      {
        "id": 4,
        "label": "Telunjuk kanan",
        "enabled": true,
        "createdAt": "2026-09-22T15:00:00.000Z",
        "lastUsedAt": null
      }
    ]
  }
}
```

Termasuk baris `enabled: false`. Urut `createdAt` naik.

`PATCH` body `{ "label": "Jempol kiri" }` saja. Abaikan atau tolak `422` kalau klien mengirim `enabled` — user tidak boleh mengaktifkan jari yang dimatikan admin.

`DELETE` → `{ "data": { "deleted": true } }`. Tidak logout.

---

## Endpoint admin

Gate sama dengan halaman admin lain: Bearer, `isAdmin`, `X-Module-Unlock`. Scope `family_id` admin. Tidak ada endpoint create.

| Method | Path | Body |
|---|---|---|
| `GET` | `/api/v1/admin/biometric/credentials` | — |
| `PATCH` | `/api/v1/admin/biometric/credentials/:id` | `{ "label": "..." }` atau `{ "enabled": false }` |
| `DELETE` | `/api/v1/admin/biometric/credentials/:id` | — |

`GET` hanya baris yang ada. Orang yang belum daftar tidak dikirim.

```json
{
  "data": {
    "items": [
      {
        "id": 4,
        "personId": 83,
        "personName": "Mochamad Irfani Ardhyansah",
        "label": "Telunjuk kanan",
        "enabled": true,
        "createdAt": "2026-09-22T15:00:00.000Z",
        "lastUsedAt": "2026-09-22T16:10:00.000Z"
      }
    ]
  }
}
```

`personName` = `core_persons.full_name`. `:id` yang bukan milik keluarga ini → `404` `BIOMETRIC_CREDENTIAL_NOT_FOUND`.

Nonaktifkan / hapus tidak mencabut refresh token yang sedang hidup. Login biometrik berikutnya yang ditolak.

---

## Kode error

| HTTP | code | Kapan |
|---|---|---|
| 403 | `BIOMETRIC_DISABLED` | Modul keluarga mati |
| 403 | `BIOMETRIC_CREDENTIAL_DISABLED` | Baris `enabled = false` dipakai login |
| 401 | `BIOMETRIC_VERIFICATION_FAILED` | Tanda tangan, origin, rpId, atau counter gagal |
| 400 | `BIOMETRIC_CHALLENGE_EXPIRED` | Challenge hilang atau kedaluwarsa |
| 404 | `BIOMETRIC_CREDENTIAL_NOT_FOUND` | Credential id / baris tidak ada |
| 409 | `BIOMETRIC_CREDENTIAL_EXISTS` | Credential id sudah tersimpan |
| 409 | `BIOMETRIC_LIMIT_REACHED` | Orang itu sudah punya 2 baris |
| 422 | `VALIDATION_ERROR` | `label` atau `enabled` tidak valid |

`404` tanpa kode `BIOMETRIC_*` hanya untuk route yang benar-benar belum terdaftar (`NOT_FOUND`). Jangan pakai kode itu untuk jari yang tidak ketemu.

---

## Jangan dilakukan

- Jangan simpan gambar atau template sidik jari.
- Jangan buat endpoint admin untuk mendaftarkan jari orang lain.
- Jangan pakai biometrik sebagai pengganti password kedua / `X-Module-Unlock`.
- Jangan ubah bentuk `POST /auth/login`.
- Jangan default-kan modul `biometric` ke nyala.
