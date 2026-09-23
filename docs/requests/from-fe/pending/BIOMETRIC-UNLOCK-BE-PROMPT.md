# Prompt BE — Buka modul dengan biometrik

Tambahan di atas login biometrik yang sudah ada. FE sudah memanggil dua path ini. Jangan ganti path atau bentuk response.

Password kedua tetap wajib di-setup sekali. Biometrik tidak menggantikan setup dan tidak menggantikan ganti password. Biometrik hanya jalan alternatif untuk **verify / unlock** (`X-Module-Unlock`), di perangkat yang jarinya sudah terdaftar pada orang yang sedang login.

Tidak perlu kolom kredensial baru. Perlu nilai enum baru pada challenge.

---

## Skema

`core_webauthn_challenges.kind` sekarang `ENUM('login','register')`.

Tambah `unlock`:

```sql
ALTER TABLE core_webauthn_challenges
  MODIFY COLUMN kind ENUM('login', 'register', 'unlock') NOT NULL;
```

`ChallengeKind` di kode ikut `'unlock'`.

---

## Endpoint

Keduanya Bearer (orang yang sudah masuk). Bukan login publik.

| Method | Path | Hasil |
|---|---|---|
| `POST` | `/api/v1/auth/webauthn/unlock/options` | Options untuk `startAuthentication` |
| `POST` | `/api/v1/auth/webauthn/unlock/verify` | Token unlock yang sama dengan `POST /auth/secondary-password/verify` |

Body options: `{}`.

`allowCredentials` diisi credential id milik **orang yang login** dan `enabled = true` saja. Jangan kosongkan seperti login discoverable: di perangkat bersama, jari orang lain tidak boleh membuka modul akun ini.

`userVerification: "required"`. Simpan challenge `kind: 'unlock'` dengan `person_id` orang yang login.

Body verify = assertion dari `startAuthentication`, tanpa `remember`.

Urutan cek:

1. Modul `biometric` keluarga ini mati → `403` `BIOMETRIC_DISABLED`.
2. Password kedua belum di-set → `409` `SECONDARY_PASSWORD_NOT_SET`. Jangan mengeluarkan unlock.
3. Challenge hilang, beda kind, beda `person_id`, atau kedaluwarsa → `400` `BIOMETRIC_CHALLENGE_EXPIRED`.
4. Credential id tidak ada, atau bukan milik orang yang login → `404` `BIOMETRIC_CREDENTIAL_NOT_FOUND`.
5. Baris `enabled = false` → `403` `BIOMETRIC_CREDENTIAL_DISABLED`.
6. Tanda tangan, origin, rpId, atau counter gagal → `401` `BIOMETRIC_VERIFICATION_FAILED`.

Sukses: naikkan `counter`, isi `last_used_at`, lalu `tokenService.signModuleUnlock` seperti `secondaryPasswordService.verify`. Response:

```json
{
  "data": {
    "unlockToken": "...",
    "expiresIn": 900,
    "modules": ["admin", "core", "money", "household"]
  }
}
```

Jangan buat access/refresh token baru. Jangan logout. Jangan mengubah password kedua.

Kalau orang itu tidak punya jari aktif, options boleh langsung `404` `BIOMETRIC_CREDENTIAL_NOT_FOUND` tanpa menyimpan challenge.
