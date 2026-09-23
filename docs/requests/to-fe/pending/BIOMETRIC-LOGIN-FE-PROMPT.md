# Prompt FE — Login biometrik (WebAuthn)

Salin blok di bawah ke chat AI / ticket FE.

Status BE: **live**. Kontrak di [`BIOMETRIC-LOGIN-BE-PROMPT.md`](../../from-fe/done/BIOMETRIC-LOGIN-BE-PROMPT.md). Kalau endpoint masih `404`, anggap fitur mati: sembunyikan tombol masuk biometrik, jangan pura-pura sukses.

Masuk pertama selalu kode keluarga. Biometrik hanya jalan masuk kedua, di perangkat yang sudah didaftarkan, menuju sesi yang sama (`accessToken`, `refreshToken`, `sessionId`).

---

## Prompt

```
Kamu menambah login biometrik di family-tree-fe (FamilyRoots).

Sensor sidik jari / wajah TIDAK dibaca oleh aplikasi. Browser memanggil dialog sistem operasi lewat WebAuthn. Package: `@simplewebauthn/browser`. Jangan gambar UI scanner sendiri, jangan kirim gambar sidik jari, jangan pakai library lain.

Yang disimpan di server hanya catatan: user siapa, label yang diketik user (misalnya "Telunjuk kanan"), status aktif. Bukan cetakan sidik jari. Maksimal 2 jari per user.

Bahasa UI: Indonesia. Field API: English.

## Alur produk

1. User masuk dengan kode keluarga. Halaman login belum punya opsi biometrik selama perangkat ini belum pernah didaftarkan.
2. Setelah masuk, di halaman awal tempat memilih modul (Family Roots, Family Core, Money, dan seterusnya) ada info status biometrik.
3. Dari info itu terbuka popup. User mengatur jarinya sendiri di popup itu: tambah, ubah label, hapus. Maksimal 2.
4. Memilih modul tidak diblokir popup. Popup bisa ditutup.
5. Kunjungan berikutnya, di perangkat yang sama, halaman login menampilkan "Masuk dengan biometrik".
6. Superadmin, di panel admin, melihat siapa yang sudah memakai biometrik dan bisa mengubah serta menghapus catatan siapa pun. Mendaftarkan jari tetap harus di perangkat user itu sendiri. Superadmin tidak memindai jari orang lain.

## Kapan fitur hidup

Sumber flag modul: `GET /api/v1/auth/me` → `data.moduleStatuses`.

```ts
const biometricOn = moduleStatuses.some(
  (item) => item.moduleId === 'biometric' && item.enabled,
);
```

Kalau item `biometric` tidak ada, anggap **mati**. Sembunyikan info di halaman pilih modul, popup, dan tombol login biometrik.

Modul mati tidak menghapus jari yang sudah tersimpan. Saat dinyalakan lagi, jari yang masih aktif bisa dipakai.

## Tombol di halaman login

Jangan tampilkan "Masuk dengan biometrik" hanya karena laptop/HP punya sensor.

Tampilkan tombol hanya jika semua syarat ini benar:

1. Modul `biometric` enabled. Sebelum login, flag ini tidak ada di `/auth/me`. Pakai penanda lokal di bawah, dan kalau options/verify mengembalikan `BIOMETRIC_DISABLED`, sembunyikan tombol.
2. `browserSupportsWebAuthn()` true.
3. `await platformAuthenticatorIsAvailable()` true.
4. Perangkat ini sudah pernah berhasil didaftarkan. Penanda lokal non-rahasia, misalnya `localStorage` key `fr_biometric_login` = `"1"`, diset hanya setelah `register/verify` sukses di browser ini.

Penanda itu bukan credential dan bukan token. Isinya hanya supaya UI tahu tombol boleh muncul. Perangkat lain yang belum daftar tidak menampilkan tombol, walaupun akun yang sama sudah punya jari di HP.

Kalau situs bukan HTTPS dan bukan localhost, jangan tampilkan tombol.

Hapus penanda lokal dan sembunyikan tombol jika login biometrik gagal dengan `BIOMETRIC_CREDENTIAL_NOT_FOUND`, `BIOMETRIC_CREDENTIAL_DISABLED`, atau `BIOMETRIC_DISABLED`.

Form kode keluarga selalu tampil.

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

`startAuthentication` / `startRegistration` wajib dari klik pengguna (onClick). Jangan dari `useEffect`.

## Endpoint

Base: `/api/v1`. Envelope sukses: `{ "data": ... }`. Error: `{ "error": { "code", "message", "requestId" } }`.

User (Bearer, kecuali login):

| Method | Path | Fungsi |
|--------|------|--------|
| `POST` | `/auth/webauthn/login/options` | Challenge masuk. Tanpa Bearer. |
| `POST` | `/auth/webauthn/login/verify` | Cek tanda tangan, terbitkan sesi. Tanpa Bearer. |
| `POST` | `/auth/webauthn/register/options` | Challenge daftar jari |
| `POST` | `/auth/webauthn/register/verify` | Simpan public key + label |
| `GET` | `/auth/webauthn/credentials` | Maksimal 2 jari milik orang yang login |
| `PATCH` | `/auth/webauthn/credentials/:id` | Ubah label milik sendiri |
| `DELETE` | `/auth/webauthn/credentials/:id` | Hapus jari milik sendiri |

Superadmin (Bearer + `isAdmin` + `X-Module-Unlock`, sama seperti halaman admin lain):

| Method | Path | Body |
|--------|------|------|
| `GET` | `/admin/modules/status` | — |
| `PATCH` | `/admin/modules/biometric/status` | `{ "enabled": true }` |
| `GET` | `/admin/biometric/credentials` | Semua jari di keluarga |
| `PATCH` | `/admin/biometric/credentials/:id` | `{ "enabled": false }` atau `{ "label": "..." }` |
| `DELETE` | `/admin/biometric/credentials/:id` | Hapus jari siapa pun |

`:id` adalah id baris database, bukan credential id WebAuthn.

Tidak ada endpoint create untuk superadmin. Jari baru hanya lewat popup user.

### Login

```ts
const optionsJSON = (await api.post('/auth/webauthn/login/options')).data;
const assertion = await startAuthentication({ optionsJSON });
const session = (
  await api.post('/auth/webauthn/login/verify', { ...assertion, remember })
).data;
```

`data` options diteruskan apa adanya. `session` bentuknya sama dengan `POST /auth/login` (`accessToken`, `refreshToken`, `expiresIn`, `sessionId`, `person`, `secondaryPassword`). Pakai penyimpanan token, `X-Session-Id`, dan flow `secondaryPassword.mustSetup` yang sudah ada.

`remember: true` → refresh di localStorage (30 hari). `remember: false` → sessionStorage (1 hari). Samakan dengan checkbox "ingat saya" di form kode keluarga. Kalau checkbox itu belum ada, kirim `remember: false`.

### Daftar jari (popup, sudah login)

Minta label wajib, 1–40 karakter, sebelum sensor. Placeholder: "Telunjuk kanan".

```ts
const label = labelInput.trim();
const optionsJSON = (await api.post('/auth/webauthn/register/options')).data;
const credential = await startRegistration({ optionsJSON });
await api.post('/auth/webauthn/register/verify', { ...credential, label });
localStorage.setItem('fr_biometric_login', '1');
```

Sukses `200`:

```json
{
  "data": {
    "id": 4,
    "label": "Telunjuk kanan",
    "enabled": true,
    "createdAt": "2026-09-22T15:00:00.000Z"
  }
}
```

Lalu refetch `GET /auth/webauthn/credentials`.

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

`items.length` maksimal 2. Kalau sudah 2, sembunyikan form tambah. Server juga menolak jari ketiga dengan `409` `BIOMETRIC_LIMIT_REACHED`.

Ubah label milik sendiri:

```http
PATCH /api/v1/auth/webauthn/credentials/4
{ "label": "Jempol kiri" }
```

Hapus milik sendiri: `DELETE /auth/webauthn/credentials/4` → `{ "data": { "deleted": true } }`. Konfirmasi dulu: "Jari ini tidak bisa dipakai masuk lagi. Kamu bisa mendaftarkan yang baru nanti."

User tidak bisa mengubah `enabled`. Kalau superadmin mematikan satu jari, baris tetap tampil di popup dengan badge "Dinonaktifkan admin", tanpa tombol aktifkan. User masih boleh menghapus jari miliknya.

## UI

### Halaman login

- Form kode keluarga tetap di atas.
- Tombol "Masuk dengan biometrik" hanya dengan syarat di bagian "Tombol di halaman login".
- Saat `startAuthentication` berjalan, tombol disabled. Teks: "Menunggu konfirmasi perangkat…"
- Dialog sidik jari / Face ID / Windows Hello milik OS. Jangan ditiru di halaman.

### Halaman pilih modul (setelah login)

Ini halaman awal, bukan halaman di dalam satu modul. Di situ user memilih modul.

Kalau modul `biometric` mati, jangan tampilkan apa pun tentang biometrik.

Kalau hidup, tampilkan info singkat di halaman itu:

- Belum punya jari: "Biometrik belum didaftarkan. Kamu bisa menambahkan sampai 2 jari untuk masuk tanpa kode keluarga."
- Sudah punya: "Biometrik aktif (1/2)." atau "(2/2)." Sertakan label jarinya. Kalau ada yang `enabled: false`, badge "Dinonaktifkan admin" pada jari itu.

Info itu bisa diklik dan membuka popup. Jangan membuka popup otomatis setiap kali masuk. Jangan menghalangi klik kartu modul.

### Popup user

Judul: "Biometrik saya".

Kalimat: "Sidik jari tetap di perangkat, tidak dikirim ke server. Maksimal 2 jari. Admin bisa menonaktifkan atau menghapus dari panel admin."

Isi:

- Daftar jari milik sendiri: label (bisa diedit), status, tanggal daftar, terakhir dipakai, tombol Hapus.
- Kalau kurang dari 2 dan `platformAuthenticatorIsAvailable()`: field label + tombol "Tambah jari".
- Kalau sudah 2: "Maksimal 2 jari. Hapus satu jari dulu kalau ingin mengganti."
- Kalau perangkat tidak punya sensor: tampilkan daftar yang ada, tanpa tombol tambah, plus kalimat "Perangkat ini tidak punya sensor biometrik."

### Admin — switch modul

Di layar status modul yang sudah ada, `moduleId === "biometric"` berlabel **Login biometrik**.

- Kalau daftar modul di-render dari `GET /admin/modules/status`, cukup map label. Switch tetap `PATCH /admin/modules/:moduleId/status` dengan `{ "enabled": boolean }`.
- Kalau daftar di-hardcode (`roots`, `core`, `money`, `household`), tambahkan baris `biometric`.
- Member tidak melihat switch. Gate sama dengan modul admin lain: `isAdmin` + `X-Module-Unlock`.

### Admin — daftar jari keluarga

Halaman `/admin/biometric` di sidebar Admin. Hanya `isAdmin`, butuh `X-Module-Unlock`.

`GET /admin/biometric/credentials`:

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

Tabel: nama orang, label, status, tanggal daftar, terakhir dipakai. Kelompokkan per orang supaya kelihatan siapa yang sudah memakai biometrik dan siapa yang belum tidak perlu diada-adakan: yang belum daftar tidak muncul di tabel. Di atas tabel, teks kosong: "Belum ada jari biometrik terdaftar."

Aksi per baris, ini CRUD admin selain create:

- Ubah label — `PATCH` `{ "label": "..." }`.
- Nonaktifkan / Aktifkan — `PATCH` `{ "enabled": false }` atau `{ "enabled": true }`. Baris tetap ada. Jari nonaktif tidak bisa login sampai diaktifkan.
- Hapus — `DELETE`, konfirmasi: "Jari ini dihapus. User harus mendaftar ulang di perangkatnya."

Tidak ada tombol "tambah jari" di halaman admin. Create hanya di popup user.

Menonaktifkan atau menghapus tidak memaksa logout sesi yang sedang aktif. Login biometrik berikutnya yang ditolak.

## Error

| HTTP | code | UI |
|------|------|----|
| 403 | `BIOMETRIC_DISABLED` | Sembunyikan tombol login dan popup. Hapus penanda lokal. |
| 403 | `BIOMETRIC_CREDENTIAL_DISABLED` | "Jari ini dinonaktifkan admin. Masuk dengan kode keluarga." Hapus penanda lokal hanya jika tidak ada jari aktif lain di perangkat ini; kalau ragu, hapus penanda saja. |
| 401 | `BIOMETRIC_VERIFICATION_FAILED` | "Verifikasi gagal. Coba lagi, atau masuk dengan kode keluarga." |
| 400 | `BIOMETRIC_CHALLENGE_EXPIRED` | Ulangi dari awal (panggil options lagi). Jangan pakai options lama. |
| 404 | `BIOMETRIC_CREDENTIAL_NOT_FOUND` | "Belum ada biometrik di perangkat ini. Masuk dengan kode keluarga." Hapus penanda lokal. |
| 409 | `BIOMETRIC_CREDENTIAL_EXISTS` | "Jari ini sudah terdaftar di perangkat ini." |
| 409 | `BIOMETRIC_LIMIT_REACHED` | "Maksimal 2 jari. Hapus satu jari dulu." |
| 422 | `VALIDATION_ERROR` | Tampilkan `error.message`. |

Error browser, bukan error API:

| name | UI |
|------|----|
| `NotAllowedError` | "Dibatalkan." |
| `InvalidStateError` | "Perangkat ini sudah terdaftar." |
| `NotSupportedError` / `SecurityError` | Sembunyikan tombol tambah dan tombol login. |

`AbortError` diperlakukan sama seperti batal.

## Jangan dilakukan

- Jangan tampilkan opsi login biometrik sebelum perangkat ini berhasil didaftarkan.
- Jangan izinkan jari ke-3.
- Jangan kunci halaman pilih modul sampai user mendaftar.
- Jangan taruh kelola jari di dalam masing-masing modul. Tempatnya popup di halaman pilih modul, plus tabel admin.
- Jangan ganti atau sembunyikan form kode keluarga.
- Jangan simpan public key, credential id, atau hasil scan di localStorage. Penanda `fr_biometric_login` hanya `"1"`.
- Jangan panggil WebAuthn tanpa klik.
- Jangan pakai biometrik sebagai pengganti password kedua (`X-Module-Unlock` tetap dari password kedua).
- Jangan buat halaman scanner custom.
```
