# Docs — FamilyRoots API

Struktur folder memisahkan **dokumentasi resmi** dari **request spek** (FE ↔ BE), plus status **done / pending**.

```
docs/
├── reference/                 # Dokumentasi resmi (sumber kebenaran)
│   ├── adr/
│   ├── seed/
│   └── templates/
└── requests/
    ├── from-fe/               # Spek / prompt dari FE → BE
    │   ├── done/
    │   └── pending/
    └── to-fe/                 # Prompt dari BE → FE
        ├── done/
        └── pending/
```

---

## `reference/` — docs beneran

| File | Isi |
|---|---|
| [`reference/INSTALLATION.md`](./reference/INSTALLATION.md) | Setup lokal, migrasi, seed, smoke test |
| [`reference/DATABASE-DESIGN.md`](./reference/DATABASE-DESIGN.md) | Schema DB + prinsip tabel |
| [`reference/FE-API-INTEGRATION.md`](./reference/FE-API-INTEGRATION.md) | Panduan integrasi API untuk FE |
| [`reference/PERSON-API-TREE.md`](./reference/PERSON-API-TREE.md) | Persons list, pagination, tree graph |
| [`reference/MAP-EVENTS-MEMORIAM-API.md`](./reference/MAP-EVENTS-MEMORIAM-API.md) | Map, Events, In Memoriam |
| [`reference/PERSONS-IMPORT-API.md`](./reference/PERSONS-IMPORT-API.md) | Bulk import persons (job + progress) |
| [`reference/adr/001-auth-tokens.md`](./reference/adr/001-auth-tokens.md) | ADR JWT + refresh tokens |
| [`reference/seed/`](./reference/seed/) | Artifact seed (`mock-family-seed.json`) |
| [`reference/templates/`](./reference/templates/) | Template CSV/JSON import |

---

## `requests/from-fe/` — request dari FE ke BE

### Done

| File | Topik | Status BE |
|---|---|---|
| [`done/BE-AUTH-API-PLAN.md`](./requests/from-fe/done/BE-AUTH-API-PLAN.md) | Auth + person API plan | ✅ Implemented |
| [`done/BE-MOCK-SEEDER.md`](./requests/from-fe/done/BE-MOCK-SEEDER.md) | Mock FE → seeder | ✅ Implemented |
| [`done/MEDIA-UPLOAD-API.md`](./requests/from-fe/done/MEDIA-UPLOAD-API.md) | Eager media upload | ✅ Implemented |
| [`done/DASHBOARD-API.md`](./requests/from-fe/done/DASHBOARD-API.md) | Aggregat dashboard | ✅ Implemented |
| [`done/EVENTS-MEMORIAM-OWNER-CRUD-API.md`](./requests/from-fe/done/EVENTS-MEMORIAM-OWNER-CRUD-API.md) | Owner-only event/tribute CRUD | ✅ Implemented |

### Pending

_Belum ada._ Taruh spek FE baru yang belum dikerjakan BE di [`requests/from-fe/pending/`](./requests/from-fe/pending/).

---

## `requests/to-fe/` — request / prompt ke FE

### Done

| File | Topik | Status |
|---|---|---|
| [`done/PERSONS-IMPORT-FE-PROMPT.md`](./requests/to-fe/done/PERSONS-IMPORT-FE-PROMPT.md) | Prompt integrasi UI import persons | ✅ Spek siap (konsumsi FE) |

### Pending

_Belum ada._ Taruh prompt/request ke FE yang belum dikirim atau belum selesai di [`requests/to-fe/pending/`](./requests/to-fe/pending/).

---

## Aturan singkat

1. **Docs resmi** (cara setup, kontrak API yang sudah live, ADR, seed/template) → `reference/`.
2. **Spek / prompt dari FE** untuk dikerjakan BE → `requests/from-fe/pending/` dulu; pindah ke `done/` setelah BE selesai.
3. **Prompt ke FE** → `requests/to-fe/{pending|done}/`.
4. Setelah spek FE selesai dan jadi kontrak API yang dipakai sehari-hari, boleh **juga** diringkas/disalin ke `reference/` bila perlu — file asli request tetap di `requests/.../done/` sebagai jejak.
