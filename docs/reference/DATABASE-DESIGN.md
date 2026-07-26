# Database Design — Super App (Family Roots)

Prinsip: **identitas orang ≠ detail opsional ≠ hak akses ≠ konteks UI sesi ≠ silsilah FR**.

Prefix tabel:

| Prefix | Domain |
|---|---|
| `core_` | Shared / Auth |
| `fr_` | Family Roots |
| `fc_` | Family Core (future) |
| `mt_` | Money Track (future) |
| `hh_` | Household (future) |

Sumber konstanta di kode: [`src/shared/database/tables.ts`](../../src/shared/database/tables.ts).

---

## Ringkasan tabel (aktif)

### `core_` — Shared / Auth

| Tabel | Isi | Cardinality |
|---|---|---|
| `core_families` | Satu pohon / tenant keluarga | 1 per tenant v1 |
| `core_persons` | Identitas shared (auth + referensi orang) | 1 per orang |
| `core_person_details` | Profil & kontak (sparse) | 0..1 per orang |
| `core_family_members` | Role admin/member | 1 per orang per family |
| `core_refresh_tokens` | Session refresh token | 0..N per orang |
| `core_person_options` | Preferensi UI per user login (EAV) | 0..N per orang |
| `core_app_logs` | Audit, navigasi FE, auth, error | append-only |
| `core_media` | Upload lifecycle shared | 0..N |

### `fr_` — Family Roots

| Tabel | Isi | Cardinality |
|---|---|---|
| `fr_person_lineage` | Edge ayah/ibu (silsilah) | 0..1 per orang |
| `fr_person_spouses` | Pasangan (canonical) | 0..N |
| `fr_person_addresses` | Alamat untuk peta | 0..1 per orang |
| `fr_events` | Acara & gathering | 0..N |
| `fr_event_persons` | Featured persons | junction |
| `fr_event_attendees` | Attendees | junction |
| `fr_event_contributions` | Kontribusi foto member | 0..N |
| `fr_event_photos` | Galeri resmi event | 0..N |
| `fr_memoriam_tributes` | Tribute | 0..N |
| `fr_memoriam_tribute_photos` | Foto tribute | 0..N |
| `fr_memoriam_prayers` | Doa | 0..N |
| `fr_person_import_jobs` | Job import silsilah | 0..N |

---

## Entity diagram (core + silsilah)

```mermaid
erDiagram
  core_families ||--o{ core_persons : contains
  core_families ||--o| core_persons : root_person_id
  core_persons ||--o| core_person_details : optional
  core_persons ||--o| fr_person_addresses : optional
  core_persons ||--o| fr_person_lineage : optional
  core_persons ||--|| core_family_members : membership
  core_persons ||--o{ fr_person_spouses : spouse_pair
  fr_person_lineage }o--o| core_persons : father_id
  fr_person_lineage }o--o| core_persons : mother_id

  core_persons {
    int id PK
    int family_id FK
    varchar full_name
    varchar nickname
    enum gender
    date birth_date
    date death_date
    enum status
  }

  fr_person_lineage {
    int person_id PK_FK
    int father_id FK
    int mother_id FK
  }

  core_person_details {
    int person_id PK_FK
    enum religion
    varchar photo_url
    varchar occupation
    varchar phone
    varchar phone_alt
  }
```

---

## `core_persons` — identity only

Hanya field yang **selalu ada** dan dipakai auth + referensi lintas app.

| Column | Notes |
|---|---|
| `id` | int unsigned PK auto-increment |
| `family_id` | int unsigned FK |
| `full_name`, `birth_date` | Login code derived dari inisial `full_name` + `birth_date` |
| `gender` | |
| `death_date` | |
| `status` | `alive` / `deceased` — gate login |
| `deleted_at` | Soft delete |

**Tidak ada di `core_persons`:** `father_id`, `mother_id` (pindah ke `fr_person_lineage`), `is_self`, `role`, `generation_label`.

---

## `fr_person_lineage` — silsilah edges

| Column | Notes |
|---|---|
| `person_id` | PK/FK → `core_persons.id` |
| `father_id` | FK nullable → `core_persons.id` ON DELETE SET NULL |
| `mother_id` | FK nullable → `core_persons.id` ON DELETE SET NULL |

API response tetap mengekspos `fatherId` / `motherId` (join di repository) — kontrak FE tidak berubah.

---

## ID & seed mapping

Mock FE pakai string slug — saat seed, dipetakan ke integer berurutan (urutan array JSON).

API mengembalikan `id: number`.

---

## `core_person_details` — profil & kontak (opsional)

Insert **hanya** kalau person punya minimal satu field terisi.

| Column |
|---|
| `religion`, `photo_url`, `occupation`, `phone`, `phone_alt` |

---

## Field yang di-derive di API (bukan DB)

### `isSelf`

```ts
isSelf = person.id === loggedInPersonId
```

### `generationLabel` — dinamis per viewer

Dari graph: `core_persons` + `fr_person_lineage` + `fr_person_spouses`.

### `role`

Dari `core_family_members.role`.

### `loginCode`

Derived dari `full_name` + `birth_date`.

---

## Tabel FR pendukung

### `fr_person_addresses`

1:1 opsional — street, city, lat/lng, dll. (Peta Alamat)

### `fr_person_spouses`

Satu baris per pasangan, `person_id_a < person_id_b` (numeric).

---

## `core_person_options` — preferensi UI (EAV)

| Column | Type | Notes |
|---|---|---|
| `person_id` | int FK PK | User login (JWT sub) |
| `setting` | varchar(64) PK | e.g. `readFocusPersonId` |
| `value` | varchar(512) | |
| `updated_at` | timestamp | |

API: `GET/PATCH /api/v1/auth/me/options`

---

## `core_app_logs`

Satu tabel untuk semua jejak aktivitas aplikasi (append-only).

---

## Query pattern

```sql
SELECT p.*, l.father_id, l.mother_id,
       d.religion, d.photo_url, d.occupation, d.phone, d.phone_alt,
       a.street, a.city, a.latitude, a.longitude
FROM core_persons p
LEFT JOIN fr_person_lineage l ON l.person_id = p.id
LEFT JOIN core_person_details d ON d.person_id = p.id
LEFT JOIN fr_person_addresses a ON a.person_id = p.id
WHERE p.family_id = ? AND p.deleted_at IS NULL;
```

---

## Folder modules

```
src/modules/
  core/            # auth, media, logs, health, person-options
  family-roots/    # persons, events, memoriam, dashboard
  family-core/     # placeholder (fc_)
  money-track/     # placeholder (mt_)
  household/       # placeholder (hh_)
```

API paths v1 **tetap** `/api/v1/{auth,persons,events,memoriam,media,dashboard,logs,health}` (belum di-prefix `/fr/`).

---

## Reset

```bash
# Drop semua tabel lalu:
npm run db:setup
```
