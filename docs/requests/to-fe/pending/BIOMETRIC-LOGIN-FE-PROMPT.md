# Prompt FE — Login biometrik (WebAuthn)

Salin blok di bawah ke chat AI / ticket FE.

Status BE: **belum live**. Kontrak di prompt ini yang diikuti. Jangan mengarang path lain. Kalau endpoint masih `404`, anggap fitur mati: sembunyikan tombol masuk biometrik, jangan pura-pura sukses.

Login kode keluarga tetap jalan. Biometrik hanya jalan masuk kedua menuju sesi yang sama (`accessToken`, `refreshToken`, `sessionId`).

---

## Prompt

```
Kamu menambah login biometrik di family-tree-fe (FamilyRoots).

Sensor sidik jari / wajah TIDAK dibaca oleh aplikasi. Browser memanggil dialog sistem operasi lewat WebAuthn. Package: `@simplewebauthn/browser`. Jangan gambar UI scanner sendiri, jangan kirim gambar sidik jari, jangan pakai library lain.

Bahasa UI: Indonesia. Field API: English.

## Kapan fitur terlihat

Sumber flag: `GET /api/v1/auth/me` → `data.moduleStatuses`.

```ts
const biometricOn = moduleStatuses.some(
  (item) => item.moduleId === 'biometric' && item.enabled,
);
```

Kalau item `biometric` tidak ada, anggap **mati**.

Tombol "Masuk dengan biometrik" di halaman login hanya muncul jika ketiga syarat ini benar:

1. `biometric` enabled
2. `browserSupportsWebAuthn()` true
3. `await platformAuthenticatorIsAvailable()` true

Kalau situs bukan HTTPS dan bukan localhost, sembunyikan tombol. Tampilkan kalimat singkat: "Login biometrik butuh HTTPS."

Login kode keluarga selalu tampil, baik flag nyala maupun mati.

## Package

```bash
npm install @simplewebauthn/browser
```

```ts
import {
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
  startAuthentication,
  startRegistration,
} from '@simplewebauthn/browser';
```

`startAuthentication` / `startRegistration` wajib dipanggil dari klik pengguna (onClick). Jangan dipanggil di `useEffect`.

## Endpoint

Base: `/api/v1`. Envelope sukses: `{ "data": ... }`. Error: `{ "error": { "code", "message", "requestId" } }`.

| Method | Path | Auth | Fungsi |
|--------|------|------|--------|
| `POST` | `/auth/webauthn/login/options` | Tidak | Challenge untuk masuk |
| `POST` | `/auth/webauthn/login/verify` | Tidak | Cek tanda tangan, terbitkan sesi |
| `POST` | `/auth/webauthn/register/options` | Bearer | Challenge untuk daftar perangkat |
| `POST` | `/auth/webauthn/register/verify` | Bearer | Simpan public key perangkat ini |
| `GET` | `/auth/webauthn/credentials` | Bearer | Daftar perangkat orang yang login |
| `DELETE` | `/auth/webauthn/credentials/:id` | Bearer | Cabut satu perangkat |

Toggle admin memakai endpoint yang sudah ada (butuh Bearer admin + `X-Module-Unlock`, sama seperti modul lain):

| Method | Path | Body |
|--------|------|------|
| `GET` | `/admin/modules/status` | — |
| `PATCH` | `/admin/modules/biometric/status` | `{ "enabled": true }` |

### Login options

```http
POST /api/v1/auth/webauthn/login/options
Content-Type: application/json

{}
```

`data` adalah options JSON untuk `startAuthentication`. Teruskan apa adanya. Jangan diubah.

### Login verify

Body = objek yang dikembalikan `startAuthentication`, plus `remember` (boolean, aturan sama dengan `POST /auth/login`).

```ts
const optionsJSON = (await api.post('/auth/webauthn/login/options')).data;
const assertion = await startAuthentication({ optionsJSON });
const session = (
  await api.post('/auth/webauthn/login/verify', { ...assertion, remember })
).data;
```

`session` bentuknya sama dengan `POST /auth/login`:

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

Setelah sukses, pakai penyimpanan token, `X-Session-Id`, dan flow `secondaryPassword.mustSetup` yang sudah ada. Jangan buat sesi kedua.

`remember: true` → refresh di localStorage (30 hari). `remember: false` → sessionStorage (1 hari). Samakan dengan checkbox "ingat saya" di form kode keluarga. Kalau halaman login belum punya checkbox itu, kirim `remember: false`.

### Register (sudah login)

Halaman pengaturan akun, section "Perangkat biometrik". Hanya tampil jika `biometric` enabled dan `platformAuthenticatorIsAvailable()`.

```ts
const optionsJSON = (await api.post('/auth/webauthn/register/options')).data;
const credential = await startRegistration({ optionsJSON });
await api.post('/auth/webauthn/register/verify', credential);
```

Verify sukses `200`:

```json
{
  "data": {
    "id": 4,
    "label": "Chrome · macOS",
    "createdAt": "2026-09-22T15:00:00.000Z"
  }
}
```

Lalu refetch daftar.

### Daftar dan cabut

`GET /auth/webauthn/credentials`:

```json
{
  "data": {
    "items": [
      {
        "id": 4,
        "label": "Chrome · macOS",
        "createdAt": "2026-09-22T15:00:00.000Z",
        "lastUsedAt": "2026-09-22T16:10:00.000Z"
      }
    ]
  }
}
```

`id` di sini id baris database, bukan credential id WebAuthn. `DELETE /auth/webauthn/credentials/4` → `200` dengan `{ "data": { "deleted": true } }`.

Satu orang boleh punya beberapa perangkat (HP dan laptop terpisah). Tiap perangkat didaftarkan sekali, saat sedang login di perangkat itu. Mencabut perangkat tidak logout sesi yang sedang aktif.

## UI

### Halaman login

- Form kode keluarga tetap di atas.
- Di bawahnya, kalau syarat di atas terpenuhi: tombol "Masuk dengan biometrik".
- Saat `startAuthentication` berjalan, tombol disabled. Teks: "Menunggu konfirmasi perangkat…"
- Dialog sidik jari / Face ID / Windows Hello adalah dialog OS. Jangan ditiru di dalam halaman.

### Pengaturan akun

- Judul: "Perangkat biometrik"
- Kalimat: "Perangkat ini bisa dipakai untuk masuk tanpa kode keluarga. Sidik jari tetap di perangkat, tidak dikirim ke server."
- Tombol: "Daftarkan perangkat ini"
- Daftar: label, tanggal daftar, terakhir dipakai, tombol "Cabut"
- Konfirmasi sebelum cabut: "Perangkat ini tidak bisa dipakai masuk lagi."

### Admin

Di layar status modul yang sudah ada, pastikan `moduleId === "biometric"` berlabel **Login biometrik**.

- Kalau daftar modul di-render dari `GET /admin/modules/status`, cukup map label itu. Switch tetap `PATCH /admin/modules/:moduleId/status` dengan `{ "enabled": boolean }`.
- Kalau daftar modul di-hardcode (`roots`, `core`, `money`, `household`), tambahkan satu baris `biometric`.
- Member tidak melihat switch ini. Gate-nya sama dengan modul admin lain: `isAdmin` + `X-Module-Unlock`.

Mematikan modul menyembunyikan tombol login dan section perangkat. Perangkat yang sudah tersimpan tidak dihapus; saat dinyalakan lagi, perangkat lama tetap bisa dipakai.

## Error

| HTTP | code | UI |
|------|------|----|
| 403 | `BIOMETRIC_DISABLED` | Sembunyikan tombol. Kalau sedang di pengaturan: "Login biometrik dimatikan admin." |
| 401 | `BIOMETRIC_VERIFICATION_FAILED` | "Verifikasi gagal. Coba lagi, atau masuk dengan kode keluarga." |
| 400 | `BIOMETRIC_CHALLENGE_EXPIRED` | Ulangi dari awal (panggilan options sekali lagi). Jangan pakai options lama. |
| 404 | `BIOMETRIC_CREDENTIAL_NOT_FOUND` | "Perangkat ini belum didaftarkan. Masuk dengan kode keluarga, lalu daftarkan di pengaturan." |
| 409 | `BIOMETRIC_CREDENTIAL_EXISTS` | "Perangkat ini sudah terdaftar." |
| 422 | `VALIDATION_ERROR` | Tampilkan `error.message` |

Error browser, bukan error API:

| name | UI |
|------|----|
| `NotAllowedError` | "Dibatalkan." Jangan tampilkan sebagai error merah yang menakutkan. |
| `InvalidStateError` | "Perangkat ini sudah terdaftar." |
| `NotSupportedError` / `SecurityError` | Sembunyikan tombol. |

`AbortError` diperlakukan sama seperti batal.

## Jangan dilakukan

- Jangan ganti atau sembunyikan form kode keluarga.
- Jangan simpan public key, credential id, atau hasil scan di localStorage.
- Jangan panggil WebAuthn tanpa klik.
- Jangan pakai biometrik untuk mengganti password kedua (`X-Module-Unlock` tetap dari password kedua).
- Jangan buat halaman scanner custom.
```
