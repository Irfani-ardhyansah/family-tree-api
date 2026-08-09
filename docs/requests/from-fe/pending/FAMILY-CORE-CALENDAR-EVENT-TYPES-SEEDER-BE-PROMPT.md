# Family Core — Calendar Event Types Seeder (BE Prompt)

## Goal

Buat master data **tipe event kalender** (`fc_calendar_event_types`) yang bisa di-CRUD dari FE, dengan **seeder default** berisi nilai di bawah. FE menyimpan referensi slug di `fc_calendar_events.type` / `event_type_slug`.

Pola sama dengan jenis dokumen: lihat juga  
[`FAMILY-CORE-DOCUMENT-TYPES-SEEDER-BE-PROMPT.md`](./FAMILY-CORE-DOCUMENT-TYPES-SEEDER-BE-PROMPT.md)

---

## Table (usulan)

`fc_calendar_event_types`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid/bigint PK | |
| `slug` | string unique | Stable code, e.g. `sekolah` |
| `label` | string | Display name |
| `icon_key` | string | Enum FE: `bookOpen`, `briefcase`, `gift`, `heart`, `creditCard`, `star`, `calendar`, `home`, `users`, `bell` |
| `tone_key` | string | Enum FE: `indigo`, `slate`, `pink`, `rose`, `amber`, `violet`, `gray`, `sky`, `teal`, `emerald` |
| `links_to_health` | bool | Bisa di-link ke Health Tracker (default `dokter` = true) |
| `is_system` | bool | `true` = seeder; jangan dihapus user |
| `sort_order` | int | Urutan tampil / filter chips |
| `created_at` / `updated_at` | timestamps | |

**Rules:**
- Seed rows: `is_system = true`
- User-created: `is_system = false`, slug unik
- Hapus system: **forbidden**
- Hapus custom: tolak jika masih ada event yang memakai slug tersebut

---

## Seeder default values

| slug | label | icon_key | tone_key | links_to_health | sort_order |
|---|---|---|---|---|---|
| `sekolah` | Sekolah | `bookOpen` | `indigo` | false | 10 |
| `kerja` | Kerja | `briefcase` | `slate` | false | 20 |
| `ulang_tahun` | Ulang tahun | `gift` | `pink` | false | 30 |
| `dokter` | Dokter | `heart` | `rose` | **true** | 40 |
| `tagihan` | Tagihan | `creditCard` | `amber` | false | 50 |
| `anniversary` | Anniversary | `star` | `violet` | false | 60 |
| `lainnya` | Lainnya | `calendar` | `gray` | false | 70 |

All seeded rows: `is_system = true`.

---

## API (minimal for FE CRUD)

- `GET /fc/calendar-event-types` — list by `sort_order`
- `POST /fc/calendar-event-types` — create custom
- `PATCH /fc/calendar-event-types/:id` — update (system slug immutable)
- `DELETE /fc/calendar-event-types/:id` — only non-system + unused

Events reference type by **slug**.

---

## Source of truth di FE (dummy)

`src/modules/family-core/mocks/calendarEventTypesMock.ts` — `INITIAL_CALENDAR_EVENT_TYPES`

FE UI: `/core/calendar/types`
