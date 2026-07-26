# Postman — FamilyRoots Super App API

## Import

1. Postman → **Import**
2. Files:
   - `FamilyRoots-API.postman_collection.json`
   - `FamilyRoots-Local.postman_environment.json`
3. Aktifkan environment **FamilyRoots — Local**
4. `npm run dev`

## Folder mapping (domain)

| Folder | Prefix | Isi |
|---|---|---|
| **0. Meta** | — | Root info, contoh error |
| **1. Core (`core_`)** | `core_` | Health, Auth, Logs, Media, CORS |
| **2. Family Roots (`fr_`)** | `fr_` | Persons (silsilah + peta), Events, Memoriam, Dashboard |
| **3. Family Core (`fc_`)** | `fc_` | Placeholder — Dokumen, Health Tracker, Family Calendar |
| **4. Money Track (`mt_`)** | `mt_` | Placeholder — Budget, Wishlist, Utang/Piutang |
| **5. Household (`hh_`)** | `hh_` | Placeholder — Inventory, Resep, Daftar Belanja |

## Recommended flow

1. **1. Core → Auth → Login — demo MR170845** (auto-saves tokens)
2. **1. Core → Auth → Get me**
3. **2. Family Roots → Persons — Silsilah & Peta → List persons**
4. **2. Family Roots → Events / Memoriam / Dashboard**
5. **1. Core → Logs → Track page view**
6. **1. Core → Auth → Refresh token** / **Logout**

## Environment variables

| Key | Set by |
|---|---|
| `baseUrl` | default `http://localhost:3000` |
| `accessToken` | Login / Refresh test scripts |
| `refreshToken` | Login / Refresh test scripts |
| `personId` | Login test script |

Server-side (`.env`): `CORS_ORIGINS`, `JWT_SECRET`, `ACCESS_TTL`, `REFRESH_TTL_*`, `LOGIN_RATE_LIMIT_MAX`.

## Test login codes (from seed)

| Code | Person |
|---|---|
| `MR170845` | Mulyono Raka (demo-mr) |
| `MIA210399` | Mochamad Irfani Ardhyansah (me, admin) |
| `BA200175` | H. Budi Ardhyansah (father) |
| `CM121076` | Hj. Citra Maharani (mother) |
