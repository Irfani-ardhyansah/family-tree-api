# FamilyRoots — Panduan Integrasi API (Frontend)

Dokumen ini untuk tim **Frontend** mulai mengganti mock lokal dengan API backend yang sudah tersedia sampai fitur **family tree graph**.

**Base URL (dev):** `http://localhost:3000`  
**Prefix API:** `/api/v1`  
**Postman:** import `postman/FamilyRoots-API.postman_collection.json`

---

## Daftar isi

1. [Yang sudah tersedia di BE](#1-yang-sudah-tersedia-di-be)
2. [Setup FE lokal](#2-setup-fe-lokal)
3. [Kontrak response](#3-kontrak-response)
4. [Auth — login, token, session](#4-auth--login-token-session)
5. [Persons — list, pagination, tree](#5-persons--list-pagination-tree)
6. [Tree graph — cara render di FE](#6-tree-graph--cara-render-di-fe)
7. [Persons CRUD](#7-persons-crud)
8. [Logs (opsional)](#8-logs-opsional)
9. [TypeScript types (copy ke FE)](#9-typescript-types-copy-ke-fe)
10. [API client — contoh implementasi](#10-api-client--contoh-implementasi)
11. [Migrasi dari mock FE](#11-migrasi-dari-mock-fe)
12. [Checklist implementasi](#12-checklist-implementasi)
13. [Akun demo & smoke test](#13-akun-demo--smoke-test)

---

## 1. Yang sudah tersedia di BE

| Modul | Endpoint | Auth |
|---|---|---|
| Health | `GET /api/v1/health` | Public |
| Auth | `POST /auth/login`, `/refresh`, `/logout`, `GET /auth/me` | Mixed |
| Persons | `GET/POST /persons`, `GET/PUT/DELETE /persons/:id` | Bearer required |
| Logs | `POST /logs/events` | Optional Bearer |

**Belum ada:** self-register, upload foto, endpoint tree nested khusus, admin login-code hint.

---

## 2. Setup FE lokal

### Environment variable FE

```env
VITE_API_BASE_URL=http://localhost:3000/api/v1
```

### CORS (backend `.env`)

Pastikan origin FE diizinkan:

```env
# Vite default
CORS_ORIGINS=http://localhost:5173

# atau dev bebas (jangan di production)
CORS_ORIGINS=*
```

Backend BE harus jalan:

```bash
cd family-tree-api
npm run db:setup   # pertama kali
npm run dev        # http://localhost:3000
```

### Response headers (tracing)

| Header | Nilai | Kegunaan FE |
|---|---|---|
| `X-Request-Id` | UUID per request | Kirim ke support / log FE saat error |
| `X-API-Version` | `v1` | Versioning |

---

## 3. Kontrak response

### Sukses

Semua endpoint sukses membungkus payload di `data`:

```json
{ "data": { ... } }
```

### Error

```json
{
  "error": {
    "code": "CODE_NOT_FOUND",
    "message": "Kode tidak ditemukan. Periksa singkatan nama dan tanggal lahir Anda."
  }
}
```

Pesan selalu **Bahasa Indonesia**. Handle berdasarkan `error.code`, bukan parse `message`.

### Kode error yang relevan FE

| HTTP | `code` | Kapan |
|---|---|---|
| 400 | `CODE_REQUIRED` | Login tanpa kode |
| 400 | `CODE_INVALID_FORMAT` | Format kode salah |
| 400 | `REFRESH_TOKEN_REQUIRED` | Refresh tanpa body |
| 400 | `PERSON_VALIDATION_FAILED` | CRUD person invalid |
| 400 | `INVALID_LOG_EVENT` | Payload log salah |
| 401 | `CODE_NOT_FOUND` | Kode tidak cocok / person deceased |
| 401 | `UNAUTHORIZED` | Token invalid / expired |
| 401 | `REFRESH_TOKEN_INVALID` | Refresh expired / revoked |
| 403 | `PERSON_DELETE_FORBIDDEN` | Hapus diri sendiri sebagai root |
| 403 | `CORS_FORBIDDEN` | Origin tidak diizinkan |
| 404 | `PERSON_NOT_FOUND` | Person tidak ada di family |
| 404 | `NOT_FOUND` | Route tidak ada |
| 429 | `TOO_MANY_ATTEMPTS` | Rate limit login (10/IP/15 menit) |
| 500 | `INTERNAL_ERROR` | Server error |

---

## 4. Auth — login, token, session

### Login code (sama dengan mock FE)

Format: `{SINGKATAN}{DDMMYY}` — contoh `KAMU210399`, `MR170845`.

Aturan singkatan **identik** dengan `src/utils/loginCode.ts` di FE. BE derive kode dari DB, tidak simpan plaintext.

Input: `trim` → UPPERCASE → hapus spasi. Max **40** karakter.

Hanya person `status === "alive"` boleh login.

### `POST /api/v1/auth/login`

**Public** — tidak perlu Bearer.

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "code": "KAMU210399",
  "remember": false
}
```

**200 OK**

```json
{
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "opaque-random-string",
    "expiresIn": 3600,
    "person": {
      "id": 83,
      "fullName": "Mochamad Irfani Ardhyansah",
      "nickname": "Kamu",
      "gender": "male",
      "birthDate": "1999-03-21",
      "status": "alive",
      "photoUrl": null
    }
  }
}
```

| Field | Catatan FE |
|---|---|
| `expiresIn` | Detik — access token TTL (default 3600) |
| `remember` | `true` → refresh TTL 30 hari; `false` → 1 hari |
| `person.id` | Simpan sebagai `userId` / `personId` |

### Penyimpanan token (rekomendasi)

| Token | `remember=false` | `remember=true` |
|---|---|---|
| `accessToken` | memory / sessionStorage | memory / sessionStorage |
| `refreshToken` | sessionStorage | localStorage |

Ganti session mock (`familyroots_auth`, `familyroots_auth_user`) dengan pasangan token di atas.

### `GET /api/v1/auth/me`

**Protected** — `Authorization: Bearer <accessToken>`

```json
{
  "data": {
    "id": 83,
    "fullName": "Mochamad Irfani Ardhyansah",
    "nickname": "Kamu",
    "gender": "male",
    "birthDate": "1999-03-21",
    "status": "alive",
    "photoUrl": null,
    "familyId": 1
  }
}
```

Pakai saat app boot / refresh halaman untuk restore session.

### `POST /api/v1/auth/refresh`

**Public** — kirim refresh token di body (rotation: token lama invalid setelah sukses).

```json
{ "refreshToken": "..." }
```

**200 OK**

```json
{
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "new-opaque-token",
    "expiresIn": 3600
  }
}
```

Implementasi FE: interceptor 401 → coba refresh sekali → retry request → jika gagal, logout.

### `POST /api/v1/auth/logout`

**Protected** + body refresh token (opsional tapi disarankan):

```json
{ "refreshToken": "..." }
```

**200 OK:** `{ "data": { "loggedOut": true } }`

Hapus token di client setelah sukses.

### Alur auth FE (diagram)

```mermaid
sequenceDiagram
  participant FE
  participant API

  FE->>API: POST /auth/login { code, remember }
  API-->>FE: accessToken + refreshToken + person
  FE->>FE: Simpan tokens + personId

  Note over FE,API: Request protected
  FE->>API: GET /persons (Bearer accessToken)
  API-->>FE: 200 data

  Note over FE,API: Access expired
  FE->>API: POST /auth/refresh { refreshToken }
  API-->>FE: new token pair
  FE->>API: Retry original request

  Note over FE,API: Logout
  FE->>API: POST /auth/logout (Bearer + refreshToken)
  FE->>FE: Clear storage → redirect /login
```

---

## 5. Persons — list, pagination, tree

Semua endpoint persons **wajib auth**. Data otomatis scoped ke `familyId` dari JWT.

### Perbedaan penting

| Field | Arti |
|---|---|
| `isSelf` | Person = user yang login (highlight UI) |
| `rootPersonId` | Anchor pohon keluarga (titik tampilan default) |
| `generationLabel` | Label relatif ke user login (e.g. "Kakek", "Kamu") — **dihitung BE** |
| `role` | `"admin"` \| `"member"` — dari `family_members` |

### ⚠️ ID bertipe `number`

Mock FE mungkin pakai `id: string`. API mengembalikan **integer**. Update type & state FE.

---

### Mode A — List paginated (tabel / admin)

```http
GET /api/v1/persons?page=1&limit=20
Authorization: Bearer <accessToken>
```

| Query | Default | Max |
|---|---|---|
| `page` | `1` | — |
| `limit` | `20` | `100` |

**200 OK**

```json
{
  "data": {
    "view": "list",
    "rootPersonId": 83,
    "persons": [ /* max `limit` items */ ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 95,
      "totalPages": 5,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

**UI suggestion:** infinite scroll atau numbered pagination pakai `hasNext` / `hasPrev`.

---

### Mode B — Tree graph (semua node)

```http
GET /api/v1/persons?view=tree
Authorization: Bearer <accessToken>
```

**Tanpa pagination** — mengembalikan **semua** person family (~95 di seed).

**200 OK**

```json
{
  "data": {
    "view": "tree",
    "rootPersonId": 83,
    "persons": [ /* all persons */ ],
    "treeGraph": {
      "anchorPersonId": 83,
      "edgeFields": {
        "parent": ["fatherId", "motherId"],
        "spouse": "spouseIds"
      },
      "note": "Bangun adjacency graph di FE dari fatherId, motherId, spouseIds."
    }
  }
}
```

**Kapan pakai:**

| Halaman FE | Endpoint |
|---|---|
| `/tree`, visualisasi pohon | `?view=tree` |
| Daftar anggota / search table | `?page=&limit=` |
| Detail satu orang | `GET /persons/:id` |

Jangan pakai list paginated untuk render pohon — relasi parent/spouse bisa terpotong.

---

### Shape satu `Person`

```json
{
  "id": 83,
  "fullName": "Mochamad Irfani Ardhyansah",
  "nickname": "Kamu",
  "gender": "male",
  "birthDate": "1999-03-21",
  "deathDate": null,
  "status": "alive",
  "religion": "islam",
  "photoUrl": null,
  "occupation": "Software Engineer",
  "phone": "+6281234567890",
  "phoneAlt": null,
  "address": {
    "street": "Jl. Example No. 1",
    "district": "Lowokwaru",
    "city": "Malang",
    "province": "Jawa Timur",
    "postalCode": "65141",
    "country": "Indonesia",
    "latitude": null,
    "longitude": null
  },
  "fatherId": 12,
  "motherId": 13,
  "spouseIds": [84],
  "generationLabel": "Kamu",
  "isSelf": true,
  "role": "admin"
}
```

| Field nullable | Catatan |
|---|---|
| `nickname`, `deathDate`, `religion`, `photoUrl`, … | Bisa `null` |
| `address` | `null` jika tidak ada alamat |
| `fatherId`, `motherId` | `null` jika tidak diisi |

---

### `GET /api/v1/persons/:id`

Detail satu person — shape sama seperti item di list.

---

## 6. Tree graph — cara render di FE

BE **tidak** mengirim nested tree. FE bangun graph dari flat list.

### Langkah implementasi

```typescript
// 1. Fetch sekali
const { persons, rootPersonId, treeGraph } = (
  await api.get<PersonListResponse>('/persons?view=tree')
).data;

// 2. Index by id
const byId = new Map(persons.map((p) => [p.id, p]));

// 3. Parent edges (directed: child → parent)
function getParents(person: Person): Person[] {
  return [person.fatherId, person.motherId]
    .filter((id): id is number => id != null)
    .map((id) => byId.get(id)!)
    .filter(Boolean);
}

// 4. Spouse edges (undirected)
function getSpouses(person: Person): Person[] {
  return person.spouseIds
    .map((id) => byId.get(id)!)
    .filter(Boolean);
}

// 5. Anchor layout
const anchorId = rootPersonId ?? persons.find((p) => p.isSelf)?.id;
const anchor = anchorId != null ? byId.get(anchorId) : undefined;
```

### Visual mapping

| Data API | UI tree |
|---|---|
| `fatherId` / `motherId` | Garis vertikal ke atas (generasi) |
| `spouseIds` | Node horizontal berdampingan |
| `gender` | Slot kiri/kanan layout (opsional) |
| `status === "deceased"` | Style muted / memorial |
| `isSelf === true` | Ring / badge highlight |
| `generationLabel` | Tooltip atau label node |
| `photoUrl`, `fullName` | Avatar + nama node |

### Center tree on user vs root

| Strategi | Start node |
|---|---|
| Default app | `rootPersonId` dari API |
| "Lihat dari posisiku" | person dengan `isSelf: true` |
| Klik node | `person.id` yang diklik |

Keduanya valid — `rootPersonId` ≠ selalu user login.

---

## 7. Persons CRUD

Semua butuh Bearer. Validasi error → `400 PERSON_VALIDATION_FAILED`.

### Create — `POST /api/v1/persons`

**201 Created** — return full person object.

```json
{
  "fullName": "Nama Lengkap",
  "nickname": "Panggilan",
  "gender": "male",
  "birthDate": "1990-01-15",
  "deathDate": null,
  "status": "alive",
  "religion": "islam",
  "photoUrl": null,
  "occupation": null,
  "phone": null,
  "phoneAlt": null,
  "address": {
    "street": "Jl. ...",
    "city": "Malang",
    "province": "Jawa Timur",
    "country": "Indonesia"
  },
  "fatherId": 12,
  "motherId": 13,
  "spouseIds": [84],
  "role": "member"
}
```

| Field | Required |
|---|---|
| `fullName`, `gender`, `birthDate` | ✅ |
| Lainnya | Opsional |

### Update — `PUT /api/v1/persons/:id`

Kirim shape yang sama (full replace fields yang divalidasi BE).

### Delete — `DELETE /api/v1/persons/:id`

Soft delete. **200:** `{ "data": { "deleted": true } }`

**403** jika user hapus diri sendiri yang juga `rootPersonId`.

---

## 8. Logs (opsional)

Tracking navigasi FE — auth **opsional** (jika Bearer ada, `actor_person_id` terisi).

```http
POST /api/v1/logs/events
Content-Type: application/json
Authorization: Bearer <accessToken>   # optional

{
  "action": "page.view",
  "path": "/tree",
  "label": "Family Tree",
  "metadata": { "referrer": "/dashboard" }
}
```

| `action` | Keterangan |
|---|---|
| `page.view` | Halaman dibuka |
| `click` | Interaksi UI |

**201:** `{ "data": { "recorded": true } }`

Saran: fire-and-forget dari router FE, jangan block UI.

---

## 9. TypeScript types (copy ke FE)

```typescript
// src/types/api.ts

export type ApiSuccess<T> = { data: T };
export type ApiError = { error: { code: string; message: string } };

export type Gender = 'male' | 'female';
export type PersonStatus = 'alive' | 'deceased';
export type PersonRole = 'admin' | 'member';

export type PersonAddress = {
  street?: string | null;
  district?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export type Person = {
  id: number;
  fullName: string;
  nickname: string | null;
  gender: Gender;
  birthDate: string;
  deathDate: string | null;
  status: PersonStatus;
  religion: 'islam' | 'other' | null;
  photoUrl: string | null;
  occupation: string | null;
  phone: string | null;
  phoneAlt: string | null;
  address: PersonAddress | null;
  fatherId: number | null;
  motherId: number | null;
  spouseIds: number[];
  generationLabel: string;
  isSelf: boolean;
  role: PersonRole;
};

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
};

export type PersonListResponse =
  | {
      view: 'list';
      rootPersonId: number | null;
      persons: Person[];
      pagination: PaginationMeta;
    }
  | {
      view: 'tree';
      rootPersonId: number | null;
      persons: Person[];
      treeGraph: {
        anchorPersonId: number | null;
        edgeFields: {
          parent: ['fatherId', 'motherId'];
          spouse: 'spouseIds';
        };
        note: string;
      };
    };

export type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  person: Pick<
    Person,
    'id' | 'fullName' | 'nickname' | 'gender' | 'birthDate' | 'status' | 'photoUrl'
  >;
};

export type AuthMeResponse = LoginResponse['person'] & { familyId: number };

export type RefreshResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};
```

---

## 10. API client — contoh implementasi

```typescript
// src/lib/apiClient.ts

const BASE = import.meta.env.VITE_API_BASE_URL;

let accessToken: string | null = null;
let refreshToken: string | null = null;

export function setTokens(access: string | null, refresh: string | null) {
  accessToken = access;
  refreshToken = refresh;
}

async function refreshAccessToken(): Promise<boolean> {
  if (!refreshToken) return false;

  const res = await fetch(`${BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) return false;

  const json = (await res.json()) as ApiSuccess<RefreshResponse>;
  accessToken = json.data.accessToken;
  refreshToken = json.data.refreshToken;
  // persist to storage...
  return true;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  const res = await fetch(`${BASE}${path}`, { ...init, headers });

  if (res.status === 401 && retry) {
    const refreshed = await refreshAccessToken();
    if (refreshed) return apiFetch<T>(path, init, false);
  }

  const body = await res.json();
  if (!res.ok) throw body as ApiError;
  return (body as ApiSuccess<T>).data;
}
```

### Hook contoh — tree page

```typescript
// src/hooks/useFamilyTree.ts
export function useFamilyTree() {
  return useQuery({
    queryKey: ['persons', 'tree'],
    queryFn: () => apiFetch<Extract<PersonListResponse, { view: 'tree' }>>('/persons?view=tree'),
    staleTime: 5 * 60 * 1000,
  });
}
```

### Hook contoh — person list

```typescript
export function usePersonList(page: number, limit = 20) {
  return useQuery({
    queryKey: ['persons', 'list', page, limit],
    queryFn: () =>
      apiFetch<Extract<PersonListResponse, { view: 'list' }>>(
        `/persons?page=${page}&limit=${limit}`,
      ),
  });
}
```

---

## 11. Migrasi dari mock FE

| Mock lama | Ganti dengan |
|---|---|
| `familyroots_auth` flag | `accessToken` + `refreshToken` |
| `familyroots_auth_user` (string id) | `person.id` number dari login/me |
| Local person array | `GET /persons?view=tree` atau paginated |
| Client-side `generationLabel` | Pakai field dari API (sudah dihitung BE) |
| Client-side `isSelf` compare | Pakai `person.isSelf` dari API |
| `Person.id: string` | `Person.id: number` |
| Mock login validate | `POST /auth/login` |
| Register page | Tetap stub — **tidak ada API register v1** |

### State management suggestion

```
AuthContext
  ├── accessToken, refreshToken
  ├── person: AuthMeResponse | null
  ├── login(code, remember)
  ├── logout()
  └── bootstrap() → GET /auth/me or refresh

TreeContext (atau React Query)
  └── persons tree cache dari ?view=tree

PersonListContext
  └── paginated queries per page
```

Setelah CRUD person sukses, **invalidate** query `['persons']`.

---

## 12. Checklist implementasi

### Fase 1 — Foundation
- [ ] Set `VITE_API_BASE_URL`
- [ ] Buat `apiClient` + error handler (`error.code`)
- [ ] Copy types dari section 9
- [ ] Smoke: `GET /health`

### Fase 2 — Auth
- [ ] Halaman login → `POST /auth/login`
- [ ] Simpan token (`remember` → localStorage vs sessionStorage)
- [ ] Protected route guard (redirect jika 401)
- [ ] App boot → `GET /auth/me` atau refresh
- [ ] Auto refresh on 401
- [ ] Logout → `POST /auth/logout` + clear storage
- [ ] Handle `TOO_MANY_ATTEMPTS` di UI login

### Fase 3 — Persons list
- [ ] Ganti mock list → `GET /persons?page=&limit=`
- [ ] Pagination UI (`hasNext`, `totalPages`)
- [ ] Detail person → `GET /persons/:id`
- [ ] Tampilkan `generationLabel`, `role`, `isSelf`

### Fase 4 — Tree graph
- [ ] Fetch `GET /persons?view=tree` di halaman tree
- [ ] Build `Map<id, Person>`
- [ ] Render edges: parent + spouse
- [ ] Anchor dari `rootPersonId` atau `isSelf`
- [ ] Style deceased / highlight self
- [ ] Loading & error states

### Fase 5 — Admin CRUD (jika `role === 'admin'`)
- [ ] Create / update / delete person
- [ ] Invalidate cache tree + list setelah mutate
- [ ] Handle `PERSON_DELETE_FORBIDDEN`

### Fase 6 — Observability (opsional)
- [ ] Router hook → `POST /logs/events` page.view
- [ ] Log `X-Request-Id` saat tampilkan error ke user

---

## 13. Akun demo & smoke test

### Akun utama (disarankan untuk dev FE)

| Field | Nilai |
|---|---|
| Login code | **`KAMU210399`** |
| Nama | Mochamad Irfani Ardhyansah |
| Nickname | Kamu |
| birthDate | 1999-03-21 |
| Role | admin |
| `isSelf` | true (setelah login) |
| `rootPersonId` | id person "me" (anchor pohon) |

### Akun lain (seed)

| Code | Person |
|---|---|
| `MR170845` | Mulyono Raka (admin) |
| `AYAH200175` | H. Budi Ardhyansah |
| `IBU121076` | Hj. Citra Maharani |

### Smoke test manual (curl)

```bash
# 1. Health
curl http://localhost:3000/api/v1/health

# 2. Login
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"code":"KAMU210399","remember":false}' \
  | jq -r '.data.accessToken')

# 3. Me
curl -s http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN" | jq

# 4. List paginated
curl -s "http://localhost:3000/api/v1/persons?page=1&limit=5" \
  -H "Authorization: Bearer $TOKEN" | jq '.data.pagination'

# 5. Tree (semua node)
curl -s "http://localhost:3000/api/v1/persons?view=tree" \
  -H "Authorization: Bearer $TOKEN" | jq '.data | {view, rootPersonId, count: (.persons|length)}'
```

---

## Referensi tambahan

| Dokumen | Isi |
|---|---|
| [`PERSON-API-TREE.md`](./PERSON-API-TREE.md) | Detail pagination & tree graph |
| [`BE-AUTH-API-PLAN.md`](./BE-AUTH-API-PLAN.md) | Rencana BE lengkap + aturan login code |
| [`adr/001-auth-tokens.md`](./adr/001-auth-tokens.md) | JWT payload & refresh rotation |
| [`DATABASE-DESIGN.md`](./DATABASE-DESIGN.md) | Schema DB |
| [`../postman/README.md`](../postman/README.md) | Postman collection |

---

**Pertanyaan ke BE:** jika ada mismatch type atau field missing, sertakan `X-Request-Id` dari response header.
