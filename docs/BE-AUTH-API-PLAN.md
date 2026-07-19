# FamilyRoots — Rencana API Backend (Auth + Person)

Dokumen ini diserahkan ke AI/engineer **Backend**. Kerjakan **per part** (prompt terpisah). Jangan gabungkan semua part dalam 1 prompt.

**Stack FE saat ini:** React + TypeScript, auth lokal (mock), belum ada API client.  
**Auth FE:** login pakai **kode keluarga** (bukan email/password). Session menyimpan `person.id` sebagai `userId`.

---

## Ringkasan alur FE (baca dulu sebelum coding)

### Login code

Format: `{SINGKATAN_NAMA}{DDMMYY}`

| Kasus | Contoh nama | Nickname | Tanggal lahir | Kode |
|---|---|---|---|---|
| 1 kata | Mia | — | 1999-03-21 | `MIA210399` |
| 2+ kata | Mulyono Raka | — | 1945-08-17 | `MR170845` |
| Ada nickname | apa saja | Raka | 1945-08-17 | `RAKA170845` |

Aturan singkatan (wajib sama di BE):

1. Buang gelar: `H.`, `Hj.`, `Dr.`, `Prof.`, `Ny.`, `Tn.` (case-insensitive) di awal kata.
2. Hanya huruf A–Z (buang angka/simbol dari nama).
3. Jika ada `nickname` → singkatan = seluruh nickname (huruf saja, UPPERCASE).
4. Jika nama 1 kata → seluruh kata UPPERCASE.
5. Jika nama 2+ kata → huruf pertama tiap kata, digabung UPPERCASE.
6. Suffix tanggal: dari `birthDate` ISO `YYYY-MM-DD` → `DD` + `MM` + `YY` (2 digit tahun terakhir).
7. Normalize input login: `trim` → UPPERCASE → hapus spasi.
8. Valid format: regex `^([A-Z]+)(\d{6})$`, abbrev minimal 1 huruf.
9. Max length input FE: **40** karakter.
10. Hanya person dengan `status === "alive"` yang boleh login.
11. Cocokkan kode hasil generate dari data person (jangan simpan plaintext code sebagai password utama — lihat Part 2).

Referensi FE: `src/utils/loginCode.ts`

### Session FE (saat ini)

- Key: `familyroots_auth` = `"1"`, `familyroots_auth_user` = `person.id`
- `remember=true` → `localStorage`; `false` → `sessionStorage`
- Setelah BE siap, FE akan ganti ke **token** (JWT/session cookie). Plan di bawah mengasumsikan **JWT access + refresh** (atau cookie httpOnly — pilih di Part 2).

### Model Person (FE type)

```ts
type Person = {
  id: string;
  fullName: string;
  nickname?: string;
  gender: 'male' | 'female';
  birthDate: string;      // YYYY-MM-DD
  deathDate?: string;
  status: 'alive' | 'deceased';
  religion?: 'islam' | 'other';
  photoUrl?: string;
  occupation?: string;
  phone?: string;
  phoneAlt?: string;
  address?: {
    street?, district?, city?, province?, postalCode?, country?,
    latitude?, longitude?
  };
  fatherId?: string;
  motherId?: string;
  spouseIds: string[];
  generationLabel?: string;
  isSelf?: boolean;
};
```

### Register

Halaman `/register` di FE masih stub email/password dan teks UI bilang **"Hubungi admin keluarga"**.  
Untuk v1: **tidak ada self-register publik**. Anggota dibuat admin (atau seed). Login hanya via kode.

---

## Cara pakai dokumen ini

Salin **satu Part** per prompt ke AI BE. Setelah Part selesai + di-review, lanjut Part berikutnya.  
Di setiap prompt, tempel juga bagian **Konteks tetap** di bawah.

### Konteks tetap (tempel di setiap prompt)

```
Proyek: FamilyRoots (family tree).
Auth: login dengan kode keluarga = singkatan nama + DDMMYY (lihat aturan di plan).
User = Person (id person). Hanya status alive yang boleh login.
Register publik: tidak ada di v1.
API style: REST JSON, prefix /api/v1.
Error response seragam: { "error": { "code": string, "message": string } }
Bahasa message error: Indonesia (selaras FE).
```

---

## PART 1 — Domain model & database schema

**Tujuan:** Skema DB + entity saja. Belum endpoint auth.

**Deliverable:**

1. Tabel `persons` (mirror field FE di atas).
2. Relasi keluarga: `father_id`, `mother_id`, tabel atau array `spouse` (many-to-many / junction `person_spouses`).
3. Tabel `families` / `family_trees` (opsional tapi disarankan): satu pohon keluarga, `root_person_id`.
4. Index yang berguna: `status`, `birth_date`, `(full_name)`, foreign keys.
5. Migration file + seed minimal 3–5 person (alive + deceased) untuk uji login code.
6. Dokumentasikan cara generate login code di komentar/README singkat (copy aturan dari ringkasan).

**Tidak dikerjakan di Part ini:** JWT, endpoint login, hashing, middleware.

**Acceptance:**

- Migration jalan.
- Seed insert sukses.
- Bisa hitung login code dari seed data secara manual (contoh di seed README).

**Prompt singkat untuk AI BE:**

> Kerjakan hanya PART 1 dari `BE-AUTH-API-PLAN.md`: domain model + migration + seed. Jangan buat endpoint auth dulu.

---

## PART 2 — Login code service + Auth token design

**Tujuan:** Pure logic generate/validate code + keputusan desain token. Belum HTTP handler penuh.

**Deliverable:**

1. Package/service `LoginCode`:
   - `BuildNameAbbrev(fullName, nickname) string`
   - `BuildBirthDateSuffix(birthDate) string` → DDMMYY
   - `BuildLoginCode(person) string`
   - `Normalize(raw) string`
   - `IsValidFormat(code) bool`
   - Unit test lengkap sesuai tabel contoh di ringkasan + edge case gelar (`H. Mulyono` → `M…`).
2. Keputusan auth (tulis di ADR singkat / komentar):
   - **Recommended:** JWT access token (short TTL, mis. 15–60 menit) + refresh token (panjang, rotate).
   - Payload minimal: `sub` = person UUID, `family_id` (jika ada), `iat`, `exp`.
   - Refresh disimpan di DB (`refresh_tokens`: id, person_id, token_hash, expires_at, revoked_at).
3. **Jangan** simpan login code sebagai password hash wajib — code bersifat **derived** dari nama+tanggal.  
   Opsional nanti: kolom `login_code_override` jika admin ingin override (out of scope v1).
4. Rate-limit design note (implement di Part 3): max N attempt / IP / menit.

**Acceptance:**

- Unit test login code hijau.
- ADR/token design tertulis 1 halaman.

**Prompt singkat:**

> Kerjakan hanya PART 2: service LoginCode + unit test + ADR token. Jangan buat HTTP route dulu.

---

## PART 3 — Endpoint Auth (login / logout / me / refresh)

**Tujuan:** API yang FE akan panggil menggantikan mock `AuthContext.login`.

### Endpoints

| Method | Path | Auth | Deskripsi |
|---|---|---|---|
| `POST` | `/api/v1/auth/login` | Public | Login dengan kode |
| `POST` | `/api/v1/auth/logout` | Required | Revoke refresh (jika ada) |
| `POST` | `/api/v1/auth/refresh` | Public (refresh token) | Issue access baru |
| `GET` | `/api/v1/auth/me` | Required | Profil user login |

### Request / Response

#### `POST /api/v1/auth/login`

```json
// request
{
  "code": "MR170845",
  "remember": true
}
```

```json
// success 200
{
  "data": {
    "accessToken": "...",
    "refreshToken": "...",
    "expiresIn": 3600,
    "person": {
      "id": "uuid",
      "fullName": "Mulyono Raka",
      "nickname": null,
      "gender": "male",
      "birthDate": "1945-08-17",
      "status": "alive",
      "photoUrl": null
    }
  }
}
```

Catatan `remember`:

- `true` → refresh TTL lebih panjang (mis. 30 hari).
- `false` → refresh TTL pendek (mis. 1 hari) **atau** tidak issue refresh (hanya access). Pilih satu, dokumentasikan.

#### Error mapping (selaras pesan FE)

| Kondisi | HTTP | `error.code` | `error.message` (contoh) |
|---|---|---|---|
| Code kosong | 400 | `CODE_REQUIRED` | Kode masuk wajib diisi. |
| Format salah | 400 | `CODE_INVALID_FORMAT` | Format kode salah. Contoh: MR170845 atau MIA210399 … |
| Tidak ketemu / deceased | 401 | `CODE_NOT_FOUND` | Kode tidak ditemukan. Periksa singkatan nama dan tanggal lahir Anda. |
| Rate limited | 429 | `TOO_MANY_ATTEMPTS` | Terlalu banyak percobaan. Coba lagi nanti. |

**Security:** Jangan bedakan response “format ok tapi deceased” vs “tidak ada” — kedua-duanya `CODE_NOT_FOUND` (hindari user enumeration detail status).

#### `GET /api/v1/auth/me`

Header: `Authorization: Bearer <accessToken>`

```json
{
  "data": {
    "id": "uuid",
    "fullName": "...",
    "nickname": null,
    "gender": "male",
    "birthDate": "YYYY-MM-DD",
    "status": "alive",
    "photoUrl": null,
    "familyId": "uuid"
  }
}
```

#### `POST /api/v1/auth/logout`

Body opsional: `{ "refreshToken": "..." }` — revoke. Access token biarkan expire alami (atau denylist jika sudah ada).

#### `POST /api/v1/auth/refresh`

```json
{ "refreshToken": "..." }
```

→ access (+ optional rotate refresh).

**Acceptance:**

- Login dengan seed person → 200 + token.
- Login code salah / deceased → 401 seragam.
- Format jelek → 400.
- `/me` tanpa token → 401; dengan token → 200.
- Rate limit teruji (manual/script).

**Prompt singkat:**

> Kerjakan hanya PART 3: endpoint auth login/logout/me/refresh sesuai kontrak di plan. Pakai LoginCode dari Part 2.

---

## PART 4 — Middleware auth + CORS + kontrak error global

**Tujuan:** Proteksi route + siap dikonsumsi FE.

**Deliverable:**

1. Middleware `RequireAuth` → parse JWT, set `person_id` di context request.
2. CORS allow origin FE (env: `CORS_ORIGINS`).
3. Error handler global format `{ error: { code, message } }`.
4. Health check: `GET /api/v1/health` → `{ "status": "ok" }`.
5. Env example: `JWT_SECRET`, `DB_DSN`, `CORS_ORIGINS`, `ACCESS_TTL`, `REFRESH_TTL_REMEMBER`, `REFRESH_TTL_SESSION`.

**Acceptance:**

- Request ke route protected tanpa token → 401.
- Preflight CORS dari origin FE lolos.

**Prompt singkat:**

> Kerjakan hanya PART 4: middleware auth, CORS, error format global, health, env example.

---

## PART 5 — Person CRUD (minimal, untuk ganti mock FE)

**Tujuan:** FE `FamilyDataContext` nanti bisa fetch/mutate via API.

### Endpoints (semua RequireAuth kecuali disebut)

| Method | Path | Deskripsi |
|---|---|---|
| `GET` | `/api/v1/persons` | List persons di family user |
| `GET` | `/api/v1/persons/:id` | Detail |
| `POST` | `/api/v1/persons` | Create (admin/family member — v1: semua user login boleh, atau role admin) |
| `PUT` | `/api/v1/persons/:id` | Update |
| `DELETE` | `/api/v1/persons/:id` | Soft/hard delete |

### Response list

```json
{
  "data": {
    "rootPersonId": "uuid",
    "persons": [ /* Person shape selaras FE */ ]
  }
}
```

Field JSON **camelCase** agar FE tidak perlu transform berat.

**Aturan bisnis v1:**

- User hanya melihat persons dalam `family_id` miliknya.
- Tidak boleh hapus diri sendiri jika masih satu-satunya akun / root — tentukan rule sederhana.
- Saat create/update `fullName`/`nickname`/`birthDate`/`status`, login code ikut berubah (derived) — tidak perlu kolom terpisah.
- Deceased: tidak bisa login (sudah di Part 3).

**Acceptance:**

- Setelah login, `GET /persons` mengembalikan seed data family yang sama.
- Create person → muncul di list; login code baru bisa dipakai jika alive.

**Prompt singkat:**

> Kerjakan hanya PART 5: CRUD persons scoped per family, response camelCase selaras type Person FE.

---

## PART 6 — (Opsional) Admin: lihat / bagikan hint login code

**Tujuan:** Admin keluarga bisa memberitahu anggota kodenya tanpa tebak-tebakan.

**Deliverable (pilih salah satu):**

- `GET /api/v1/persons/:id/login-code-hint` →  
  `{ "data": { "hint": "MR + 17/08/45 → MR170845", "code": "MR170845" } }`  
  **Hanya role admin**, dan jangan log code di plain access log.
- Atau field `loginCodeHint` hanya di response admin list.

**Catatan keamanan:** Endpoint ini sensitif. Rate-limit + audit log.

**Prompt singkat:**

> Kerjakan hanya PART 6 opsional: endpoint hint login code untuk admin.

---

## PART 7 — Kontrak OpenAPI + checklist integrasi FE

**Tujuan:** Spesifikasi final agar FE tinggal wiring.

**Deliverable:**

1. File OpenAPI/Swagger (`openapi.yaml`) mencakup Part 3–5 (+6 jika ada).
2. Contoh curl di README.
3. Checklist integrasi FE (untuk AI FE nanti):

```
[ ] Ganti AuthContext.login → POST /auth/login
[ ] Simpan accessToken (+ refreshToken) sesuai remember
[ ] Authorization Bearer di semua request protected
[ ] GET /auth/me saat app boot jika token ada
[ ] logout → POST /auth/logout + clear storage
[ ] FamilyDataContext → GET/POST/PUT/DELETE /persons
[ ] Mapping error.code → message UI (bisa pakai message dari BE)
[ ] Handle 401 → redirect /login
```

**Prompt singkat:**

> Kerjakan hanya PART 7: OpenAPI + README curl + checklist integrasi FE. Tidak menambah fitur baru.

---

## Urutan pengerjaan (wajib)

```
Part 1 (schema/seed)
  → Part 2 (login code + token design)
    → Part 3 (auth endpoints)
      → Part 4 (middleware/CORS)
        → Part 5 (persons CRUD)
          → Part 6 opsional (hint code)
            → Part 7 (OpenAPI + checklist)
```

Jangan loncat ke Part 5 sebelum Part 3–4 stabil.

---

## Out of scope v1 (jangan dikerjakan kecuali diminta)

- Self-register email/password (halaman FE `/register` masih stub).
- OAuth / Google login.
- Multi-tenant billing.
- Upload foto (cukup URL string dulu).
- Events / In-Memoriam API (fitur FE terpisah; plan belakangan).
- Realtime / WebSocket.

---

## Mapping cepat FE → BE

| FE (sekarang) | BE (target) |
|---|---|
| `findPersonByLoginCode(persons, code)` client-side | `POST /auth/login` server-side |
| `persistAuth(person.id)` local/session storage | simpan `accessToken` (+ refresh) |
| `userId` = person id | JWT `sub` = person id |
| `logout()` clear storage | `POST /auth/logout` + clear |
| `useFamily().persons` mock | `GET /persons` |
| Register page stub | tidak ada API register publik |

---

## Catatan untuk AI BE

1. Ikuti **satu Part per prompt**.
2. Jaga kontrak JSON **camelCase**.
3. Message error **Bahasa Indonesia**.
4. Login code logic harus **bit-identical** dengan `src/utils/loginCode.ts` di FE (port test cases dari sana).
5. Setelah tiap Part: tulis ringkas “apa yang berubah + cara test” di response.
