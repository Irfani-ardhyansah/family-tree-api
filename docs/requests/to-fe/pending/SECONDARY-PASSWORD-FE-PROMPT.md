# Secondary Password (Double Password) — Integrasi FE

Password kedua melindungi modul sensitif: **Admin**, **Money Track**, **Household**.

Login tetap pakai kode keluarga. Password kedua = lapisan ekstra per person.

---

## Kapan user input pertama kali?

**Setelah login berhasil**, jika `secondaryPassword.mustSetup === true` (belum pernah set).

FE **wajib** tampilkan modal setup sebelum user masuk Admin / Money / Household.  
Disarankan: blokir navigasi ke 3 modul itu sampai setup selesai (Family Roots / dashboard biasa tetap boleh).

---

## Response yang dipakai FE

### Login — `POST /auth/login`

```json
{
  "data": {
    "accessToken": "...",
    "refreshToken": "...",
    "expiresIn": 3600,
    "sessionId": 12,
    "person": { "id": 83, "isAdmin": true, "...": "..." },
    "secondaryPassword": {
      "isSet": false,
      "mustSetup": true,
      "unlocks": ["admin", "money", "household"]
    }
  }
}
```

### Me — `GET /auth/me`

Field yang sama: `data.secondaryPassword`.

---

## Endpoint password kedua

| Method | Path | Auth | Fungsi |
|--------|------|------|--------|
| `POST` | `/auth/secondary-password/setup` | Bearer | Set pertama kali |
| `POST` | `/auth/secondary-password/verify` | Bearer | Buka unlock token |
| `POST` | `/auth/secondary-password/change` | Bearer | Ganti (butuh password lama) |

### Setup (pertama kali)

```http
POST /api/v1/auth/secondary-password/setup
Authorization: Bearer <accessToken>
Content-Type: application/json

{ "password": "rahasia1", "confirmPassword": "rahasia1" }
```

Response `201`:

```json
{
  "data": {
    "secondaryPassword": { "isSet": true, "mustSetup": false, "unlocks": ["admin","money","household"] },
    "unlockToken": "<jwt>",
    "expiresIn": 900
  }
}
```

Simpan `unlockToken` di memory (disarankan) + expiry. Setup sukses = langsung unlocked.

### Verify (setiap masuk modul sensitif, jika unlock expired/tidak ada)

```http
POST /api/v1/auth/secondary-password/verify
{ "password": "rahasia1" }
```

```json
{
  "data": {
    "unlockToken": "<jwt>",
    "expiresIn": 900,
    "modules": ["admin", "money", "household"]
  }
}
```

### Change

```json
{
  "currentPassword": "lama",
  "newPassword": "baru123",
  "confirmPassword": "baru123"
}
```

Aturan password: **6–72** karakter (trim).

---

## Header untuk API modul sensitif

```http
X-Module-Unlock: <unlockToken>
```

Wajib di semua request `/api/v1/admin/*` (selain auth setup/verify).  
Money / Household API nanti sama — FE kirim header yang sama.

CORS BE sudah allow `X-Module-Unlock`.

Error yang FE harus handle:

| HTTP | code | Arti |
|------|------|------|
| 403 | `SECONDARY_UNLOCK_REQUIRED` | Belum verify / header kosong → tampilkan modal password |
| 403 | `SECONDARY_UNLOCK_INVALID` | Token expired/salah → modal password lagi |
| 401 | `SECONDARY_PASSWORD_INVALID` | Password salah di form |
| 409 | `SECONDARY_PASSWORD_NOT_SET` | Belum setup → arahkan ke setup |
| 409 | `SECONDARY_PASSWORD_ALREADY_SET` | Setup dobel |
| 422 | `SECONDARY_PASSWORD_MISMATCH` | confirm tidak cocok |

---

## Flow FE (rekomendasi)

```text
Login OK
  │
  ├─ secondaryPassword.mustSetup?
  │     YES → Modal SETUP (password + confirm)
  │            → POST .../setup
  │            → simpan unlockToken
  │     NO  → lanjut app
  │
Klik Admin / Money / Household
  │
  ├─ punya unlockToken valid (belum expired)?
  │     YES → masuk halaman + kirim X-Module-Unlock di apiFetch
  │     NO  → Modal VERIFY
  │            → POST .../verify
  │            → simpan unlockToken + expiresAt
  │            → masuk halaman
  │
API 403 SECONDARY_UNLOCK_* → clear unlockToken → Modal VERIFY lagi
```

### Storage unlockToken

- Prefer **memory** (hilang saat refresh tab = lebih aman)
- Atau `sessionStorage` dengan `expiresAt = now + expiresIn * 1000`
- Jangan taruh di `localStorage` jangka panjang

### Helper apiClient

```ts
if (moduleUnlockToken) {
  headers.set('X-Module-Unlock', moduleUnlockToken);
}
```

Hanya perlu untuk call ke `/admin/*` (dan nanti `/money/*`, `/household/*`).  
Dashboard Family Roots / persons **tidak** butuh header ini.

---

## Catatan produk

- Satu password kedua membuka **ketiga** modul selama `expiresIn` (default 15 menit, env `SECONDARY_UNLOCK_TTL`).
- Admin tetap butuh `isAdmin` + unlock; member bisa unlock untuk money/household saja (saat API-nya ada).
- Logout: hapus unlockToken di FE.
