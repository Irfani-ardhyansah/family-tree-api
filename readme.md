# Family Tree API (FamilyRoots)

Express + TypeScript + Knex + MySQL API for the FamilyRoots family tree app.

## Local development (`npm run dev`)

Docker khusus server/homelab. Di laptop tetap Node biasa:

```bash
cp .env.example .env
# set DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME ke MySQL lokal
npm install
npm run migrate   # atau npm run db:setup
npm run dev
curl http://localhost:3000/api/v1/health
```

Pakai file `.env` (bukan `.env.docker`).

## Docker (homelab / STB)

```bash
# sekali di host (untuk reverse proxy / FE di compose terpisah)
docker network create shared_net

cp .env.docker.example .env.docker
# edit JWT_SECRET, CORS_ORIGINS, MEDIA_PUBLIC_BASE_URL (IP STB)
docker compose --env-file .env.docker up -d --build
curl http://localhost:3000/api/v1/health
```

Container API: `family-suite-api` · MySQL: `family-suite-db`.  
API join network `shared_net` — proxy nginx ke `http://family-suite-api:3000`.

## Setup

1. `cp .env.example .env` and set DB credentials (local)
2. Create empty MySQL database matching `DB_NAME`
3. `npm install`
4. If Knex complains about a missing old migration (`20251209150240_...`), clear the migration bookkeeping once:

```sql
DROP TABLE IF EXISTS knex_migrations;
DROP TABLE IF EXISTS knex_migrations_lock;
-- optional full wipe of the study DB:
-- DROP DATABASE your_db; CREATE DATABASE your_db;
```

5. `npm run db:setup` (migrate + seed 95 persons)

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start API with nodemon |
| `npm run build` / `npm start` | Compile and run production build |
| `npm run migrate` | Run latest migrations |
| `npm run seed` | Seed demo family from `docs/reference/seed/mock-family-seed.json` |
| `npm run db:setup` | migrate + seed |

## Smoke checks

```bash
curl http://localhost:3000/api/v1/health
# {"status":"ok"}

curl http://localhost:3000/api/v1/does-not-exist
# {"error":{"code":"NOT_FOUND","message":"Endpoint tidak ditemukan."}}

curl -X POST http://localhost:3000/api/v1/logs/events \
  -H "Content-Type: application/json" \
  -d '{"action":"page.view","path":"/tree"}'
```

## Docs

Indeks & mapping folder: [`docs/README.md`](docs/README.md)

- `docs/reference/` — dokumentasi resmi (setup, schema, API)
- `docs/requests/from-fe/{done,pending}/` — spek dari FE ke BE
- `docs/requests/to-fe/{done,pending}/` — prompt ke FE

## Database design

See [`docs/reference/DATABASE-DESIGN.md`](docs/reference/DATABASE-DESIGN.md) for the full schema rationale.

Key rules:
- `persons` = core only; all IDs are **unsigned integers**
- `person_details` = optional profile/contact (religion, photo, occupation, phone)
- `isSelf` + `generationLabel` are **not** stored — derived from logged-in `personId`
- `role` lives in `family_members`, not `persons`

## Seed notes

- Family: `family-ardhyansah-demo`, root: `me`
- 95 persons (63 alive / 32 deceased), 43 canonical spouse rows, 2 admins
- Login codes are **derived** (not stored). Smoke examples:
  - `demo-mr` → `MR170845`
  - `me` → `MIA210399` (Mochamad Irfani Ardhyansah, 1999-03-21)
  - `father` → `BA200175`

## Postman

Import collection dari [`postman/`](postman/README.md):

- `postman/FamilyRoots-API.postman_collection.json`
- `postman/FamilyRoots-Local.postman_environment.json`

## Tests

```bash
npm test
```

## Auth (Part 3)

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"code":"MR170845","remember":true}'

curl http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer <accessToken>"
```

## API contract (Part 4)

All errors:

```json
{ "error": { "code": "ERROR_CODE", "message": "Pesan Bahasa Indonesia" } }
```

Success responses:

```json
{ "data": { ... } }
```

Protected routes: header `Authorization: Bearer <accessToken>`

Optional auth (logs): Bearer attached when present → `actor_person_id` filled in `app_logs`

CORS: set `CORS_ORIGINS` to your FE URL(s), e.g. `http://localhost:5173` for Vite.

Response headers: `X-Request-Id`, `X-API-Version`

## Architecture

```
src/
  server.ts / app.ts
  config/          # env, knex, cors
  shared/          # errors, middleware, utils, types
  modules/         # health, auth, logs, …
  database/        # migrations + seeds
```

Request flow: `routes → controller → service → repository → knex`
