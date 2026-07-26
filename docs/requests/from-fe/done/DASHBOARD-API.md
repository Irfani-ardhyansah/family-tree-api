# Dashboard API — Ringkasan Keluarga (fokus baca)

Spesifikasi endpoint agregat untuk halaman **Dashboard**.  
Dokumen ini untuk tim **Backend** (atau AI BE) mengimplementasikan endpoint yang akan dikonsumsi FE.

**Base URL (dev):** `http://localhost:3000`  
**Prefix API:** `/api/v1`  
**Auth:** Bearer JWT (wajib)  
**Perspektif:** resolve via `resolveReadFocusMiddleware` (sama Persons/Events/Memoriam/Media) — **tidak wajib** kirim `?focusPersonId=`. Cukup PATCH `readFocusPersonId` saat toggle navbar; override opsional via query.

Related docs:

- `docs/reference/MAP-EVENTS-MEMORIAM-API.md` — events & memoriam (sumber data agregat)
- `docs/requests/from-fe/done/MEDIA-UPLOAD-API.md` — resolusi fokus baca & media
- `docs/reference/FE-API-INTEGRATION.md` — kontrak response & auth FE

---

## 1. Masalah yang diselesaikan

Saat ini Dashboard FE menghitung ringkasan dari beberapa call terpisah (`/events`, `/memoriam/deceased`, tree lokal). Itu:

1. Banyak round-trip untuk satu halaman.
2. Logika statistik (anggota, generasi, foto) tersebar di FE.
3. Harus dijamin **semua angka & list ikut berubah** saat user ganti fokus ke pasangan.

Yang dibutuhkan: **satu GET agregat** yang mengembalikan stats + cuplikan aktivitas + kenangan + acara mendatang, scoped ke subgraph fokus aktif.

---

## 2. Keputusan produk (v1)

| Topik | Keputusan |
|-------|-----------|
| Endpoint | Satu `GET /dashboard` (agregat read-only) |
| Perspektif | Via `resolveReadFocusMiddleware` — data berubah saat `readFocusPersonId` di-PATCH ke pasangan |
| Filter subgraph | Default sama modul lain: `lineage=both`, `generationsUp=4`, `showSpouses/siblings/children=true` |
| Events di dashboard | Hanya event yang `isEventVisibleInPerspective` untuk subgraph fokus |
| Memoriam di dashboard | Hanya almarhum yang `canAccessMemorial` / visible di perspektif fokus |
| Restricted event | Boleh tampil di list cuplikan dengan `isRestricted` / `canAccess` (sama list events) |
| Pagination | Tidak — pakai limit tetap di response |
| Write | Tidak ada di modul ini |

### Limit default (boleh diubah; sync ke FE)

| Field | Limit |
|-------|-------|
| `recentEvents` | 5 |
| `upcomingEvents` | 3 |
| `recentMemoriam` | 4 |

---

## 3. Resolusi fokus baca

Urutan (sama semua modul):

1. `?focusPersonId=` — override eksplisit (opsional)
2. `person_options.readFocusPersonId` — dari `PATCH /auth/me/options` saat toggle navbar
3. Default — JWT `sub` (diri sendiri)

Validasi: `focusPersonId` harus ∈ `allowedFocusPersonIds` (self + pasangan yang diizinkan).  
Kalau tidak valid → `400 FOCUS_PERSON_INVALID` (atau kode yang sudah dipakai modul lain).

**Alur FE saat ganti fokus pasangan:**

```
1. User toggle fokus di navbar
2. FE PATCH /auth/me/options { setting: "readFocusPersonId", value: "<spouseId>" }
3. FE refetch GET /dashboard  (tanpa query; BE pakai person_options baru)
4. Stats + list berubah ke perspektif pasangan
```

---

## 4. Endpoint

### `GET /api/v1/dashboard`

Query opsional:

| Param | Wajib | Keterangan |
|-------|-------|------------|
| `focusPersonId` | tidak | Override fokus baca |
| `recentLimit` | tidak | Override limit `recentEvents` (default 5, max 20) |
| `upcomingLimit` | tidak | Override limit `upcomingEvents` (default 3, max 20) |
| `memoriamLimit` | tidak | Override limit `recentMemoriam` (default 4, max 20) |

**Response `200`:**

```json
{
  "data": {
    "focusPersonId": 84,
    "selfPersonId": 83,
    "allowedFocusPersonIds": [83, 84],
    "focusPerson": {
      "id": 84,
      "fullName": "Siti Aminah",
      "nickname": "Aminah",
      "photoUrl": "https://cdn.example.com/p/84.jpg",
      "gender": "female"
    },
    "stats": {
      "memberCount": 42,
      "generationCount": 4,
      "photoCount": 128,
      "upcomingEventCount": 3
    },
    "recentEvents": [
      {
        "id": 12,
        "title": "Halal Bihalal Keluarga",
        "type": "reunion",
        "date": "2026-04-10",
        "endDate": null,
        "location": "Jakarta",
        "description": null,
        "personIds": [83, 84],
        "photoUrls": ["https://cdn.example.com/e/12-1.jpg"],
        "attendeeIds": [],
        "isRestricted": false,
        "canAccess": true,
        "createdById": 83,
        "canManage": true,
        "contributionCount": 2
      }
    ],
    "upcomingEvents": [
      {
        "id": 15,
        "title": "Ulang Tahun Irfan",
        "type": "birthday",
        "date": "2026-08-01",
        "endDate": null,
        "location": null,
        "description": null,
        "personIds": [83],
        "photoUrls": [],
        "attendeeIds": [],
        "isRestricted": false,
        "canAccess": true,
        "createdById": 83,
        "canManage": true
      }
    ],
    "recentMemoriam": [
      {
        "id": 7,
        "fullName": "H. Ahmad",
        "nickname": "Ahmad",
        "gender": "male",
        "birthDate": "1940-01-01",
        "deathDate": "2020-05-12",
        "status": "deceased",
        "photoUrl": null,
        "generationLabel": "Kakek",
        "religion": "islam",
        "tributeCount": 5,
        "prayerCount": 12,
        "canAccess": true,
        "latestTributeAt": "2026-07-01T10:00:00.000Z"
      }
    ]
  }
}
```

### Shape TypeScript (usulan)

```typescript
type DashboardFocusPerson = {
  id: number;
  fullName: string;
  nickname: string | null;
  photoUrl: string | null;
  gender: 'male' | 'female';
};

type DashboardStats = {
  memberCount: number;
  generationCount: number;
  photoCount: number;
  upcomingEventCount: number;
};

type DashboardResponse = {
  focusPersonId: number;
  selfPersonId: number;
  allowedFocusPersonIds: number[];
  focusPerson: DashboardFocusPerson;
  stats: DashboardStats;
  recentEvents: ApiEvent[];       // sorted date DESC, limit recentLimit
  upcomingEvents: ApiEvent[];     // date >= today (UTC/local BE), ASC, limit upcomingLimit
  recentMemoriam: MemoriamDeceasedItem & {
    latestTributeAt?: string | null; // ISO — untuk sort kenangan terbaru
  }[];
};
```

Reuse tipe `ApiEvent` dan `MemoriamDeceasedItem` dari modul Events / Memoriam agar FE tidak mapping ulang.

---

## 5. Cara hitung stats

Scoped ke **visible subgraph** fokus aktif (`getVisiblePersonIds` / `filterTreeSubgraph` — sama map/events).

| Field | Definisi |
|-------|----------|
| `memberCount` | Jumlah person di subgraph visible |
| `generationCount` | Jumlah lapisan generasi distinct di subgraph (boleh pakai `generationLabel` atau depth ayah/ibu; konsisten dengan FE tree) |
| `photoCount` | `count(person.photoUrl)` + `sum(event.photoUrls.length)` untuk event yang visible di perspektif (+ opsional contribution photos kalau mudah) |
| `upcomingEventCount` | Jumlah event visible dengan `date >= today` (bukan hanya yang di-slice `upcomingEvents`) |

---

## 6. Cara isi list cuplikan

### `recentEvents`

- Filter: `isEventVisibleInPerspective(personIds, visibleSubgraph)`
- Sort: `date` DESC (lalu `id` DESC sebagai tie-break)
- Limit: `recentLimit` (default 5)

### `upcomingEvents`

- Filter: visible + `date >= startOfToday`
- Sort: `date` ASC
- Limit: `upcomingLimit` (default 3)

### `recentMemoriam`

- Filter: almarhum di subgraph + user boleh akses memorial (sama gate list memoriam)
- Hanya yang punya minimal 1 tribute (`tributeCount > 0`), kecuali BE lebih suka tampilkan yang punya aktivitas terbaru
- Sort: `latestTributeAt` DESC (fallback `deathDate` DESC)
- Limit: `memoriamLimit` (default 4)

---

## 7. Auth & error

| Endpoint | Auth |
|----------|------|
| `GET /dashboard` | Bearer wajib |

| Code | HTTP | Kapan |
|------|------|-------|
| `UNAUTHORIZED` | 401 | Token hilang/invalid |
| `FOCUS_PERSON_INVALID` | 400 | `focusPersonId` tidak di `allowedFocusPersonIds` |
| `DASHBOARD_LOAD_FAILED` | 500 | Error internal agregasi |

Format error global:

```json
{
  "error": {
    "code": "FOCUS_PERSON_INVALID",
    "message": "Fokus orang tidak valid untuk akun ini."
  }
}
```

---

## 8. Smoke test (usulan)

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"code":"MIA210399"}' | jq -r '.data.accessToken')

# Dashboard fokus default (self / person_options)
curl -s "http://localhost:3000/api/v1/dashboard" \
  -H "Authorization: Bearer $TOKEN" | jq .

# Simpan fokus pasangan
SPOUSE_ID=$(curl -s "http://localhost:3000/api/v1/auth/me" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.data.allowedFocusPersonIds[1]')

curl -s -X PATCH "http://localhost:3000/api/v1/auth/me/options" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"setting\":\"readFocusPersonId\",\"value\":\"${SPOUSE_ID}\"}" | jq .

# Dashboard harus mengembalikan focusPersonId = pasangan + stats/list berbeda
curl -s "http://localhost:3000/api/v1/dashboard" \
  -H "Authorization: Bearer $TOKEN" | jq '{
    focusPersonId: .data.focusPersonId,
    focusName: .data.focusPerson.fullName,
    stats: .data.stats,
    recent: [.data.recentEvents[].title],
    upcoming: [.data.upcomingEvents[].title]
  }'

# Override eksplisit kembali ke self (opsional)
SELF_ID=$(curl -s "http://localhost:3000/api/v1/auth/me" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.data.id')

curl -s "http://localhost:3000/api/v1/dashboard?focusPersonId=${SELF_ID}" \
  -H "Authorization: Bearer $TOKEN" | jq '.data.focusPersonId'
```

Checklist:

- [ ] Response `focusPersonId` mengikuti `person_options` setelah PATCH
- [ ] `stats.memberCount` / `generationCount` berubah saat fokus pasangan (subgraph beda)
- [ ] `recentEvents` / `upcomingEvents` hanya event visible di perspektif fokus
- [ ] `recentMemoriam` hanya almarhum yang boleh diakses di perspektif itu
- [ ] Tanpa `?focusPersonId=` tetap jalan (resolve dari options)

---

## 9. Catatan implementasi BE

1. Reuse `resolveReadFocusMiddleware` + `getVisiblePersonIds()` — jangan duplikasi filter perspektif.
2. Agregasi boleh parallel query (persons subgraph, events, memoriam counts) lalu assemble di service.
3. Jangan N+1 untuk `tributeCount` / `latestTributeAt` — aggregate di SQL/Prisma groupBy.
4. `photoCount` v1 boleh approximate (person photos + event cover photos); contribution photos boleh ditambah di v1.1.
5. FE akan refetch `GET /dashboard` setiap kali `readFocusPersonId` berubah (dependency hook), meski query string kosong.
