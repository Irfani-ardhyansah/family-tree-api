# Family Core — Document Types Seeder (BE Prompt)

## Goal

Buat master data **jenis dokumen** (`fc_document_types`) yang bisa di-CRUD dari FE, dengan **seeder default** berisi nilai di bawah. FE sudah memakai slug ini sebagai referensi di dokumen (`fc_documents.type` / `document_type_slug`).

---

## Table (usulan)

`fc_document_types`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid/bigint PK | |
| `slug` | string unique | Stable code, e.g. `ktp` |
| `label` | string | Display name |
| `icon_key` | string | Enum FE: `user`, `home`, `fileText`, `file`, `heart`, `briefcase`, `creditCard`, `key`, `truck`, `award`, `shield` |
| `tone_key` | string | Enum FE: `sky`, `indigo`, `violet`, `blue`, `rose`, `orange`, `amber`, `teal`, `emerald`, `fuchsia`, `cyan`, `gray` |
| `extras` | json | Array `{ key, label, placeholder? }` |
| `default_lifetime` | bool | Default toggle “seumur hidup” di form dokumen |
| `allow_custom_title` | bool | Izinkan label custom saat create dokumen |
| `is_system` | bool | `true` = seeder; jangan dihapus user |
| `sort_order` | int | Urutan tampil |
| `created_at` / `updated_at` | timestamps | |

**Rules:**
- Seed rows: `is_system = true`
- User-created types: `is_system = false`, slug unik (auto dari label + suffix jika bentrok)
- Hapus jenis system: **forbidden** (atau soft-disable later)
- Hapus jenis custom: tolak jika masih ada dokumen yang mereferensikan slug tersebut

---

## Seeder default values

Seed exact rows below (slug must match).

| slug | label | icon_key | tone_key | default_lifetime | allow_custom_title | sort_order | extras |
|---|---|---|---|---|---|---|---|
| `ktp` | KTP / NIK | `user` | `sky` | true | false | 10 | `[]` |
| `kk` | Kartu Keluarga | `home` | `indigo` | true | false | 20 | `[]` |
| `akta_lahir` | Akta Lahir | `fileText` | `violet` | true | false | 30 | `[]` |
| `paspor` | Paspor | `file` | `blue` | false | false | 40 | `[]` |
| `bpjs_kesehatan` | BPJS Kesehatan | `heart` | `rose` | true | false | 50 | `[{"key":"faskes","label":"Faskes","placeholder":"Nama faskes"},{"key":"kelas","label":"Kelas","placeholder":"1 / 2 / 3"}]` |
| `bpjs_ketenagakerjaan` | BPJS Ketenagakerjaan | `briefcase` | `orange` | true | false | 60 | `[]` |
| `npwp` | NPWP | `creditCard` | `amber` | true | false | 70 | `[]` |
| `sim` | SIM | `key` | `teal` | false | false | 80 | `[{"key":"simType","label":"Jenis SIM","placeholder":"A / B / C"}]` |
| `stnk` | STNK | `truck` | `emerald` | false | false | 90 | `[{"key":"plate","label":"Plat nomor","placeholder":"B 1234 XYZ"}]` |
| `ijazah` | Ijazah / Sertifikat | `award` | `fuchsia` | true | false | 100 | `[{"key":"institution","label":"Institusi","placeholder":"Nama institusi"},{"key":"year","label":"Tahun","placeholder":"2020"}]` |
| `rekening` | Rekening Bank | `creditCard` | `cyan` | true | false | 110 | `[{"key":"bank","label":"Bank","placeholder":"BCA / Mandiri / …"}]` |
| `lainnya` | Lainnya | `shield` | `gray` | false | true | 120 | `[]` |

All seeded rows: `is_system = true`.

---

## API (minimal for FE CRUD)

- `GET /fc/document-types` — list ordered by `sort_order`
- `POST /fc/document-types` — create custom type
- `PATCH /fc/document-types/:id` — update label/icon/tone/extras/flags (system: slug immutable)
- `DELETE /fc/document-types/:id` — only non-system + unused

Documents reference type by **slug** (or FK to type id — FE currently stores slug in `document.type`).

---

## Source of truth di FE (dummy)

`src/modules/family-core/mocks/documentTypesMock.ts` — `INITIAL_DOCUMENT_TYPES`

Keep seeder in sync with that file when changing defaults.
