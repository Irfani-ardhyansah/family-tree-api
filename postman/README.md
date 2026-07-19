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

1. **Auth → Login — demo MR170845** (auto-saves tokens)
2. **Auth → Get me**
3. **Persons → List persons** (95 from seed)
4. **Logs → Track page view**
5. **Auth → Refresh token** / **Logout**

## Endpoints

| Method | Path | Auth |
|---|---|---|
| GET | `/` | — |
| GET | `/api/v1/health` | — |
| POST | `/api/v1/auth/login` | — |
| POST | `/api/v1/auth/refresh` | — |
| GET | `/api/v1/auth/me` | Bearer |
| POST | `/api/v1/auth/logout` | Bearer |
| GET | `/api/v1/persons` | Bearer |
| GET | `/api/v1/persons/:id` | Bearer |
| POST | `/api/v1/persons` | Bearer |
| PUT | `/api/v1/persons/:id` | Bearer |
| DELETE | `/api/v1/persons/:id` | Bearer |
| POST | `/api/v1/logs/events` | optional Bearer |

## Test login codes (from seed)

| Code | Person |
|---|---|
| `MR170845` | Mulyono Raka (demo-mr) |
| `KAMU210399` | Mochamad Irfani Ardhyansah (me, admin) |
| `AYAH200175` | H. Budi Ardhyansah (father) |
| `IBU121076` | Hj. Citra Maharani (mother) |

## Environment variables

| Key | Set by |
|---|---|
| `baseUrl` | default `http://localhost:3000` |
| `accessToken` | Login / Refresh test scripts |
| `refreshToken` | Login / Refresh test scripts |
| `personId` | Login test script |
