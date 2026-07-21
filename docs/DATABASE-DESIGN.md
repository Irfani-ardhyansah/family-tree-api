# Database Design — FamilyRoots

Prinsip: **identitas orang ≠ detail opsional ≠ hak akses ≠ konteks UI sesi**.

---

## Ringkasan tabel

| Tabel | Isi | Cardinality |
|---|---|---|
| `families` | Satu pohon keluarga | 1 per tenant v1 |
| `persons` | **Core** — identitas + hidup/mati + ortu | 1 per orang |
| `person_details` | Profil & kontak (sparse) | 0..1 per orang |
| `person_addresses` | Alamat untuk map | 0..1 per orang |
| `family_members` | Role admin/member | 1 per orang per family |
| `person_spouses` | Pasangan (canonical) | 0..N per orang |
| `app_logs` | Audit, navigasi FE, auth, error | append-only |

---

## Entity diagram

```mermaid
erDiagram
  families ||--o{ persons : contains
  families ||--o| persons : root_person_id
  persons ||--o| person_details : "optional"
  persons ||--o| person_addresses : "optional"
  persons ||--|| family_members : membership
  persons ||--o{ person_spouses : spouse_pair
  persons ||--o| persons : father_id
  persons ||--o| persons : mother_id

  persons {
    int id PK
    int family_id FK
    varchar full_name
    varchar nickname
    enum gender
    date birth_date
    date death_date
    enum status
    int father_id FK
    int mother_id FK
  }

  person_details {
    int person_id PK_FK
    enum religion
    varchar photo_url
    varchar occupation
    varchar phone
    varchar phone_alt
  }
```

---

## `persons` — core only (tidak bloated)

Hanya field yang **selalu ada** dan dipakai auth + struktur pohon.

| Column | Notes |
|---|---|
| `id` | int unsigned PK auto-increment | |
| `family_id` | int unsigned FK | Scope data |
| `full_name`, `birth_date` | Login code derived dari inisial `full_name` + `birth_date` (`nickname` tidak dipakai) |
| `gender` | |
| `birth_date`, `death_date` | |
| `status` | `alive` / `deceased` — gate login |
| `father_id`, `mother_id` | int unsigned FK nullable | Struktur pohon |
| `deleted_at` | Soft delete |

**Tidak ada:** `is_self`, `role`, `generation_label`, slug/string id di kolom DB.

Semua PK/FK = **integer unsigned**. Slug dari mock JSON (`me`, `father`, …) hanya dipakai saat seed untuk mapping ke integer.

---

## ID & seed mapping

Mock FE pakai string slug — saat seed, dipetakan ke integer berurutan (urutan array JSON):

| Slug mock | Integer DB (contoh) |
|---|---|
| `pat-ggp-m` | 1 |
| `pat-ggp-f` | 2 |
| … | … |
| `me` | sesuai posisi di JSON |
| `demo-mr` | sesuai posisi di JSON |

API mengembalikan `id: number`. FE akan pakai integer dari API (Part 7 integrasi).

---

## `person_details` — profil & kontak (opsional)

Insert **hanya** kalau person punya minimal satu field terisi.

| Column |
|---|
| `religion`, `photo_url`, `occupation`, `phone`, `phone_alt` |

Mayoritas orang di pohon besar tidak punya phone/occupation → tidak perlu baris kosong.

---

## Field yang di-derive di API (bukan DB)

### `isSelf`

```ts
isSelf = person.id === loggedInPersonId  // both numbers
```

### `generationLabel` — dinamis per viewer

Label relatif **tergantung siapa yang login**, sama seperti `isSelf`.

| Viewer login | Target node | Label contoh |
|---|---|---|
| `me` | `me` | `Kamu` |
| `me` | `father` | `Ayah` |
| `me` | `pat-ggp-m` | `Orang Tua Buyut (Ayah)` |
| `father` | `me` | `Anak` (atau nama) |
| `father` | `father` | `Kamu` |
| `father` | `pat-gp-m` | `Ayah` |

**Implementasi Part 5:** `GenerationLabelService.build(viewerId, targetId, graph)`:

1. Load semua persons + parent + spouse edges untuk family
2. Hitung relasi genealogis: `self`, `parent`, `child`, `sibling`, `spouse`, `grandparent`, `grandchild`, `uncle`, `aunt`, `cousin`, …
3. Tentukan cabang ayah/ibu kalau perlu (pat/mat line)
4. Map ke label Bahasa Indonesia

Mock FE `generationLabel` di JSON **hanya referensi UI** — tidak di-seed ke DB.

### `role`

Dari `family_members.role` (bukan kolom persons).

### `loginCode`

Derived dari `full_name` + `nickname` + `birth_date`.

---

## Tabel lain (unchanged)

### `family_members`

`family_id` + `person_id` + `role` (`admin` | `member`).

### `person_addresses`

1:1 opsional — street, city, lat/lng, dll.

### `person_spouses`

Satu baris per pasangan, `person_id_a < person_id_b` (numeric).

---

## `app_logs`

Satu tabel untuk semua jejak aktivitas aplikasi (append-only, jangan update/delete rutin).

| Column | Type | Notes |
|---|---|---|
| `id` | bigint PK | Volume besar → bigint |
| `occurred_at` | timestamp | Waktu kejadian |
| `category` | enum | `audit` \| `navigation` \| `auth` \| `system` \| `error` |
| `action` | varchar(64) | e.g. `person.create`, `page.view`, `auth.login` |
| `status` | enum | `success` \| `failure` |
| `actor_person_id` | int FK nullable | Siapa (null jika belum login) |
| `family_id` | int FK nullable | Scope keluarga |
| `resource_type` | varchar(32) nullable | `person`, `page`, `auth`, … |
| `resource_id` | int nullable | ID entity terkait |
| `http_method`, `path`, `http_status` | nullable | Untuk request API |
| `message` | varchar(512) | Ringkasan human-readable |
| `metadata` | json | Detail extra (query, label klik, diff CRUD) |
| `ip_address`, `user_agent`, `request_id` | nullable | Traceability |

### Sumber log

| Sumber | Category | Contoh action |
|---|---|---|
| Middleware API (POST/PUT/PATCH/DELETE + GET audit) | `audit` / `auth` | `person.update`, `auth.login` |
| `POST /api/v1/logs/events` dari FE | `navigation` | `page.view`, `click` |
| Service manual (Part 3+) | `auth`, `error` | `auth.login`, `system.unhandled` |

### FE — track halaman / klik

```bash
curl -X POST http://localhost:3000/api/v1/logs/events \
  -H "Content-Type: application/json" \
  -d '{"action":"page.view","path":"/tree"}'
```

```bash
curl -X POST http://localhost:3000/api/v1/logs/events \
  -H "Content-Type: application/json" \
  -d '{"action":"click","path":"/tree","label":"Buka profil ayah","metadata":{"targetPersonId":42}}'
```

Nanti setelah auth: kirim `Authorization: Bearer …` agar `actor_person_id` terisi otomatis.

---

## Query pattern Part 5

```sql
-- Core list
SELECT p.*, d.religion, d.photo_url, d.occupation, d.phone, d.phone_alt,
       a.street, a.city, a.latitude, a.longitude
FROM persons p
LEFT JOIN person_details d ON d.person_id = p.id
LEFT JOIN person_addresses a ON a.person_id = p.id
WHERE p.family_id = ? AND p.deleted_at IS NULL;
```

Lalu di service layer: attach `spouseIds`, `generationLabel`, `isSelf`, `address` object.

---

## Reset

```sql
SET FOREIGN_KEY_CHECKS=0;
DROP TABLE IF EXISTS refresh_tokens, app_logs, person_spouses, person_addresses, person_details, family_members, persons, families, knex_migrations, knex_migrations_lock;
SET FOREIGN_KEY_CHECKS=1;
```

```bash
npm run db:setup
```
