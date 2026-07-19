# Postman — FamilyRoots API

## Import

1. Postman → **Import**
2. Files:
   - `FamilyRoots-API.postman_collection.json`
   - `FamilyRoots-Local.postman_environment.json`
3. Aktifkan environment **FamilyRoots — Local**
4. `npm run dev`

## Environment variables

| Key | Description |
|---|---|
| `CORS_ORIGINS` | Comma-separated FE origins (`*` dev only) |
| `JWT_SECRET` | Min 32 chars in production |
| `ACCESS_TTL` | Access token seconds |
| `REFRESH_TTL_REMEMBER` / `REFRESH_TTL_SESSION` | Refresh token TTL |
| `LOGIN_RATE_LIMIT_MAX` | Max login attempts per IP per window |

## Recommended flow

1. **Auth → Login — demo MR170845** (auto-saves `accessToken` + `refreshToken`)
2. **Auth → Get me**
3. **Logs → Track page view** (with Bearer token)
4. **Auth → Refresh token**
5. **Auth → Logout**

## Endpoints

| Method | Path | Auth |
|---|---|---|
| GET | `/` | — |
| GET | `/api/v1/health` | — |
| POST | `/api/v1/auth/login` | — |
| POST | `/api/v1/auth/refresh` | — |
| GET | `/api/v1/auth/me` | Bearer |
| POST | `/api/v1/auth/logout` | Bearer |
| POST | `/api/v1/logs/events` | optional Bearer |

## Test login codes (from seed)

| Code | Person |
|---|---|
| `MR170845` | Mulyono Raka (demo-mr) |
| `KAMU220800` | Irfa Ardhyansah (me) |
| `AYAH200175` | H. Budi Ardhyansah (father) |
| `IBU121076` | Hj. Citra Maharani (mother) |

## Environment variables

| Key | Set by |
|---|---|
| `baseUrl` | default `http://localhost:3000` |
| `accessToken` | Login / Refresh test scripts |
| `refreshToken` | Login / Refresh test scripts |
| `personId` | Login test script |
