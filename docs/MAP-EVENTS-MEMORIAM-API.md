# Map, Events & In Memoriam API

Dokumentasi modul **Peta Keluarga**, **Acara**, dan **In Memoriam** — FamilyRoots API v1.

Semua endpoint GET echo `focusPersonId` + `selfPersonId`.

**Fokus baca** disimpan di `person_options` (`setting` + `value` string). Toggle navbar → `PATCH /auth/me/options` — tidak perlu `?focusPersonId=` di tiap request (query tetap didukung sebagai override).

Default subgraph filter (selaras FE `buildPerspectiveViewConfig`):

```json
{
  "lineage": "both",
  "generationsUp": 4,
  "showSpouses": true,
  "showSiblings": true,
  "showChildren": true
}
```

Reuse: `getVisiblePersonIds()` di `perspective-subgraph.service.ts` → `filterTreeSubgraph()`.

---

## Modul 1 — Peta Keluarga

### `GET /api/v1/persons/map?focusPersonId={id}`

Query opsional:

| Param | Nilai |
|-------|-------|
| `lineage` | `both` \| `paternal` \| `maternal` |
| `status` | `alive` \| `deceased` \| `all` (default: `all`) |
| `city`, `province`, `q` | Filter teks |

**Response:**

```json
{
  "data": {
    "focusPersonId": 84,
    "selfPersonId": 83,
    "allowedFocusPersonIds": [83, 84],
    "persons": [ /* PersonMapItem */ ],
    "meta": {
      "totalVisible": 42,
      "withAddress": 30,
      "withExactCoords": 18,
      "withCityOnly": 12
    }
  }
}
```

Meta:

- `withExactCoords` — `latitude` + `longitude` terisi
- `withCityOnly` — ada kota/provinsi tanpa koordinat exact
- `withAddress` — minimal satu field alamat terisi

### `PATCH /api/v1/persons/:id?focusPersonId={id}`

Body: `{ "address": { ... } }`

**Gate:** `isLegal === true` (usia ≥ 18) → error `403 PERSON_UPDATE_FORBIDDEN`.

---

## Modul 2 — Acara

### Keputusan produk (v1)

| Topik | Keputusan |
|-------|-----------|
| List restricted event | **Tampil** di list dengan `isRestricted: true`, `canAccess: false`; detail → `403 EVENT_ACCESS_FORBIDDEN` |
| Create event | **Semua member login** (tanpa gate `isLegal`); `createdById` = JWT `selfPersonId` |
| Update / Delete event | **Hanya creator** (`createdById === selfPersonId`) → selain itu `403 EVENT_MANAGE_FORBIDDEN` |
| Flag UI | Response event punya `createdById` + `canManage` |
| Kontribusi | Hanya jika `canAccessEvent` |

### Akses

```typescript
canAccessEvent(attendeeIds, viewerId):
  attendeeIds.length === 0 → true (acara terbuka)
  else → viewerId ∈ attendeeIds

isEventVisibleInPerspective(personIds, visibleSubgraph):
  personIds.length === 0 → true (acara umum)
  else → ∃ id ∈ personIds ∩ visibleSubgraph
```

### Endpoints

| Method | Path |
|--------|------|
| GET | `/api/v1/events?focusPersonId={id}` |
| GET | `/api/v1/events/:id?focusPersonId={id}` |
| POST | `/api/v1/events?focusPersonId={id}` |
| PATCH | `/api/v1/events/:id?focusPersonId={id}` |
| DELETE | `/api/v1/events/:id?focusPersonId={id}` |
| POST | `/api/v1/events/:id/contributions?focusPersonId={id}` |

Filter list: `type`, `year`, `month`, `dateFrom`, `dateTo`, `q`, `page`, `limit`.

### Error codes

| Code | HTTP |
|------|------|
| `EVENT_NOT_FOUND` | 404 |
| `EVENT_ACCESS_FORBIDDEN` | 403 |
| `EVENT_MANAGE_FORBIDDEN` | 403 |
| `EVENT_VALIDATION_FAILED` | 400 |
| `CONTRIBUTION_VALIDATION_FAILED` | 400 |

---

## Modul 3 — In Memoriam

### Akses memorial

BFS dari `deceasedId` via `fatherId`, `motherId`, `spouseIds`, anak (reverse parent) — selaras FE `memoriamAccess.ts`.

```typescript
canAccessMemorial(viewerId, deceasedId, graph):
  viewerId ∈ connectedSet(deceasedId)

isDeceasedVisibleInPerspective(deceasedId, focusPersonId, visibleSubgraph, graph):
  deceasedId ∈ visibleSubgraph
  OR focusPersonId ∈ connectedSet(deceasedId)
```

Tribute: HTML disanitasi server-side (tag aman: `p`, `br`, `strong`, `em`, `ul`, `ol`, `li`). Max **8 foto** per tribute.

| Topik | Keputusan |
|-------|-----------|
| Create tribute | Author = JWT `selfPersonId` |
| Update / Delete tribute | **Hanya author** (`authorId === selfPersonId`) → selain itu `403 TRIBUTE_MANAGE_FORBIDDEN` |
| Media PATCH | **Replace-all** dari `mediaIds` / `photoUrls` final yang dikirim FE |
| Flag UI | Tribute punya `canManage` (+ `deceasedId`, `updatedAt`) |
| POST create response | **Single** `{ tribute }` (bukan full list) |

Prayer: idempotent `UNIQUE(deceased_person_id, author_person_id)` — `POST` → `201` baru, `200` jika sudah ada.

### Endpoints

| Method | Path |
|--------|------|
| GET | `/api/v1/memoriam/deceased?focusPersonId={id}` |
| GET | `/api/v1/memoriam/:deceasedId?focusPersonId={id}` |
| GET | `/api/v1/memoriam/:deceasedId/tributes?focusPersonId={id}` |
| POST | `/api/v1/memoriam/:deceasedId/tributes?focusPersonId={id}` |
| PATCH | `/api/v1/memoriam/:deceasedId/tributes/:tributeId?focusPersonId={id}` |
| DELETE | `/api/v1/memoriam/:deceasedId/tributes/:tributeId?focusPersonId={id}` |
| GET | `/api/v1/memoriam/:deceasedId/prayers?focusPersonId={id}` |
| POST | `/api/v1/memoriam/:deceasedId/prayers?focusPersonId={id}` |
| GET | `/api/v1/memoriam/:deceasedId/prayers/me?focusPersonId={id}` |

Filter list deceased: `q`, `deathYear`.

### Error codes

| Code | HTTP |
|------|------|
| `MEMORIAL_ACCESS_FORBIDDEN` | 403 |
| `MEMORIAL_NOT_DECEASED` | 400 |
| `TRIBUTE_NOT_FOUND` | 404 |
| `TRIBUTE_MANAGE_FORBIDDEN` | 403 |
| `TRIBUTE_VALIDATION_FAILED` | 400 |

---

## Seed & smoke test

Login demo: **`MIA210399`** → `me` id **83**, pasangan **`me-sp` id 84**.

```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"code":"MIA210399"}' | jq -r '.data.accessToken')

# Map — focus self vs spouse (subset berbeda)
curl -s "http://localhost:3000/api/v1/persons/map?focusPersonId=83" -H "Authorization: Bearer $TOKEN" | jq '.data.meta'
curl -s "http://localhost:3000/api/v1/persons/map?focusPersonId=84" -H "Authorization: Bearer $TOKEN" | jq '.data.meta'

# Events — restricted detail
curl -s "http://localhost:3000/api/v1/events?focusPersonId=83" -H "Authorization: Bearer $TOKEN" | jq '.data.events[] | {id,title,isRestricted,canAccess}'

# Memoriam
curl -s "http://localhost:3000/api/v1/memoriam/deceased?focusPersonId=83" -H "Authorization: Bearer $TOKEN" | jq '.data.deceased | length'
```

Seed: `01_mock_family_data.ts` (persons + 10 addresses), `02_events_memoriam_data.ts` (6 events, 8 tributes, 6 prayers).

---

## Logs — halaman & audit API

### Navigasi FE (`POST /api/v1/logs/events`)

Wajib kirim `page.view` saat user membuka halaman (path **router FE**, bukan path API):

| Halaman | `path` |
|---------|--------|
| Peta | `/family/map` |
| Acara | `/events`, `/events/:id` |
| In Memoriam | `/in-memoriam`, `/in-memoriam/:deceasedId` |

Path tidak dikenali → **400** `INVALID_LOG_EVENT`.

### Audit otomatis (middleware)

Hit API modul ini otomatis masuk `app_logs`:

| Request | `action` |
|---------|----------|
| `GET /persons/map` | `person.map.read` |
| `GET /events*` | `event.read` |
| Mutasi events | `event.create` / `update` / `delete` / `contribution.create` |
| `GET /memoriam*` | `memorial.read` |
| Mutasi tributes | `memorial.tribute.create` / `update` / `delete` |
| `POST .../prayers` | `memorial.prayer.create` |
