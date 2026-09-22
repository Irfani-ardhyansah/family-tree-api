# Prompt FE — Portfolio Analytics Admin UI

Salin blok di bawah ke chat AI / ticket FE.

Status BE: **live** — collect publik di `/api/v1/analytics/collect`; dashboard di `/api/v1/admin/analytics` (JWT admin FamilyRoots, sama seperti panel admin lain).
Kontrak: [`docs/reference/PORTFOLIO-ANALYTICS-API.md`](../../../reference/PORTFOLIO-ANALYTICS-API.md)
Tracker publik (Astro, bukan file ini): [`PORTFOLIO-ANALYTICS-COLLECT-FE-PROMPT.md`](./PORTFOLIO-ANALYTICS-COLLECT-FE-PROMPT.md)

---

## Prompt

```
Kamu mengerjakan UI admin analytics di **family-tree-fe** (FamilyRoots), bukan di site portfolio Astro.

## Konteks produk

Site portfolio (Astro) mengirim event anonim ke BE. Pengunjung portfolio TIDAK login.

Kamu menambah halaman di **Admin Panel FamilyRoots** supaya admin keluarga bisa lihat:

1. Berapa unique visitor vs pageview
2. Dari negara mana
3. Section / kartu work mana yang kelihatan vs diklik
4. CTA lead: Email vs WhatsApp vs Instagram
5. Replay kasar 1 session (urutan page_view → section_view → click → outbound)

Auth **sama persis** dengan halaman admin lain (dashboard, audit, backup):
- Sudah login FamilyRoots (Bearer access token)
- Hanya `role === 'admin'` / `isAdmin` (sembunyikan nav untuk member)
- Header `X-Module-Unlock` sama seperti `GET /admin/dashboard` (password kedua)
- JANGAN buat form token analytics terpisah
- JANGAN pakai ANALYTICS_ADMIN_TOKEN
- Pakai `apiFetch` / admin API client yang sudah ada

Route FE: `/admin/analytics` (masuk sidebar Admin, di samping Dashboard/Audit).
Member → 403 / hide menu. 401 → flow refresh/login existing. `SECONDARY_UNLOCK_REQUIRED` → modal password kedua yang sudah ada.

Bahasa UI: Indonesia. Field API: English (snake_case di JSON).

Timezone semua filter tanggal: Asia/Jakarta. Kirim `from` & `to` sebagai `YYYY-MM-DD` (inclusive). BE yang interpretasi timezone — FE jangan convert ke UTC manual.

## Base API

Base: {API_BASE}/api/v1/admin/analytics
Headers (sudah di client admin):
  Authorization: Bearer <accessToken>
  X-Module-Unlock: <unlockToken>
  Content-Type: application/json
  X-Request-Id: uuid (opsional)

Contoh: GET /admin/analytics/overview?from=2026-09-01&to=2026-09-14

Envelope sukses:
{ "data": { ... } }

Envelope error:
{
  "error": {
    "code": "UNAUTHORIZED" | "FORBIDDEN" | "SECONDARY_UNLOCK_REQUIRED" | "VALIDATION_ERROR" | "ANALYTICS_SESSION_NOT_FOUND" | "...",
    "message": "…",
    "requestId": "…"
  }
}

HTTP:
- 401 UNAUTHORIZED → refresh/login existing (jangan bikin gate token baru)
- 403 FORBIDDEN → bukan admin; hide halaman
- 403 SECONDARY_UNLOCK_REQUIRED / SECONDARY_UNLOCK_INVALID → flow password kedua existing
- 422 VALIDATION_ERROR → tanggal invalid
- 404 ANALYTICS_SESSION_NOT_FOUND → session id tidak ada
- 429 jangan spam; debounce fetch saat ganti filter

Query umum (semua GET kecuali session detail):
  from        YYYY-MM-DD  required (default UI: 14 hari terakhir termasuk hari ini)
  to          YYYY-MM-DD  required
  page_id     home | work | (kosong = semua)
  exclude_bots  true | false   default true; toggle di header dashboard

Preset tanggal: Hari ini | 7 hari | 14 hari | 30 hari | Custom range.

Saat from/to/page_id/exclude_bots berubah, refetch SEMUA widget yang terlihat (bukan hanya overview).

## Halaman & layout

Satu halaman dashboard (boleh tab), bukan 10 route.

### A. Header (sticky)

- Judul: “Portfolio analytics”
- Date range + preset
- Filter halaman: Semua | Home | Work
- Toggle: “Sembunyikan bot” (default ON = exclude_bots=true)
- Teks kecil echo: periode, timezone Asia/Jakarta

### B. KPI overview — GET /overview

Tampilkan 6 kartu:

1. Unique visitors        data.unique_visitors
2. Sessions                data.sessions
3. Pageviews               data.pageviews
4. Bounce rate             data.bounce_rate sebagai persen (0.41 → 41%)
5. Avg time on page        format data.avg_active_ms (contoh 74000 → 1m 14s)
6. Outbound total          jumlah email+whatsapp+instagram
   sub: Email / WA / IG terpisah (warna beda)

Bounce v1 (tampilkan tooltip): session 1 pageview, 0 click, active_ms < 10s, max scroll < 25%.

Empty: semua angka 0 + copy “Belum ada kunjungan di rentang ini.”

### C. Timeseries — GET /timeseries

Chart garis/bar harian:
- unique_visitors
- pageviews
Sumbu X = bucket (YYYY-MM-DD, sudah Asia/Jakarta).
Jangan interpolasi hari kosong — pakai value 0 dari API (BE kirim semua hari di range).

### D. Geo — GET /geo

Tabel: negara, jumlah session (atau visitors — pakai count dari API), %.
Bar progres % opsional.
Max 20 baris; sisanya “Lainnya” kalau API kirim other.

Jangan tampilkan IP.

### E. Referrers & UTM — GET /referrers

Dua tabel atau tab:
- Referrer (host atau `(direct)`)
- utm_source

Kolom: sumber, sessions, %.

### F. Pages — GET /pages

Tabel page_id / path: pageviews, unique_visitors, avg_active_ms, bounce_rate.

### G. Sections — GET /sections

Impressi section (`section_view`). Kolom: section_id, views, unique_sessions.
Labelkan section_id (jangan tampil raw saja):

Home: hero, about, work, reviews, beyond, services, process, faq, contact
Work: career, professional, freelance, personal

### H. Clicks — GET /clicks

Top element_id. Kolom: label, element_id (mono kecil), count, % dari semua klik.

Pakai label manusia dari allowlist (lihat bawah). Jangan render href mentah sebagai judul.

### I. Outbounds / lead — GET /outbounds

3 angka besar: Email, WhatsApp, Instagram.
Chart timeseries harian per channel (stacked atau 3 garis).
Ini metrik “lead intent” utama.

### J. Sessions — GET /sessions + GET /sessions/:id

List paginated (page, pageSize default 20).
Kolom: waktu mulai, negara/kota, device, landing_path, exit_path, active_ms, pageviews, outbound? (badge WA/email/IG jika ada).

Klik baris → panel/drawer detail:
- Meta session (country, city, device, browser, os, referrer, utm)
- Timeline event urut waktu (replay kasar)
- JANGAN tampilkan ip / ip_hash / user_agent raw di UI v1 (privacy). Device + country cukup.

Timeline icon by name:
  page_view, session_start, intro_*, section_view, scroll_depth,
  click, work_card_view, outbound_click, engagement_heartbeat

Heartbeat boleh di-collapse (“Aktif 15s × N”) supaya timeline tidak ramai.
Scroll_depth tampilkan percent.
outbound_click tampilkan channel.

404 session → toast “Session tidak ditemukan.”

## Kontrak response (kunci ke shape ini)

Semua timestamp ISO UTC di JSON. FE format ke Asia/Jakarta untuk display (`14:32` atau `14 Sep 2026, 14:32`).

### GET /overview

{API_BASE}/api/v1/admin/analytics/overview?from=2026-09-01&to=2026-09-14&exclude_bots=true&page_id=

{
  "data": {
    "from": "2026-09-01",
    "to": "2026-09-14",
    "timezone": "Asia/Jakarta",
    "exclude_bots": true,
    "page_id": null,
    "unique_visitors": 128,
    "sessions": 151,
    "pageviews": 210,
    "bounce_rate": 0.41,
    "avg_active_ms": 74000,
    "outbounds": { "email": 6, "whatsapp": 11, "instagram": 3 }
  }
}

### GET /timeseries

{
  "data": {
    "from": "2026-09-01",
    "to": "2026-09-14",
    "buckets": [
      { "date": "2026-09-01", "unique_visitors": 12, "pageviews": 18, "sessions": 14 }
    ]
  }
}

### GET /geo

{
  "data": {
    "items": [
      { "country_code": "ID", "country_name": "Indonesia", "count": 90, "percent": 0.70 },
      { "country_code": "SG", "country_name": "Singapore", "count": 12, "percent": 0.09 }
    ]
  }
}

count = unique visitors (bukan pageview). percent 0–1.

### GET /pages

{
  "data": {
    "items": [
      {
        "page_id": "home",
        "path": "/portfolio/",
        "pageviews": 160,
        "unique_visitors": 110,
        "avg_active_ms": 82000,
        "bounce_rate": 0.38
      },
      {
        "page_id": "work",
        "path": "/portfolio/work/",
        "pageviews": 50,
        "unique_visitors": 40,
        "avg_active_ms": 54000,
        "bounce_rate": 0.22
      }
    ]
  }
}

### GET /sections

{
  "data": {
    "items": [
      { "page_id": "home", "section_id": "work", "views": 88, "unique_sessions": 70 }
    ]
  }
}

### GET /clicks

{
  "data": {
    "items": [
      {
        "element_id": "cta_view_projects",
        "element_type": "cta",
        "label": "View projects",
        "count": 42,
        "percent": 0.18
      }
    ]
  }
}

Urut count desc. Top 50 cukup.

### GET /outbounds

{
  "data": {
    "totals": { "email": 6, "whatsapp": 11, "instagram": 3 },
    "buckets": [
      { "date": "2026-09-01", "email": 1, "whatsapp": 2, "instagram": 0 }
    ]
  }
}

### GET /referrers

{
  "data": {
    "referrers": [
      { "referrer": "https://www.linkedin.com/", "count": 20, "percent": 0.15 },
      { "referrer": null, "count": 80, "percent": 0.60 }
    ],
    "utm_sources": [
      { "source": "linkedin", "count": 18, "percent": 0.14 },
      { "source": null, "count": 90, "percent": 0.70 }
    ]
  }
}

referrer null / source null = Direct. Tampilkan “(langsung)”.

### GET /sessions?page=1&pageSize=20

{
  "data": {
    "items": [
      {
        "session_id": "b91e2a10-1111-4aaa-8bbb-cccccccccccc",
        "visitor_id": "8c1d0c5a-2f3a-4b1e-9c0d-1a2b3c4d5e6f",
        "started_at": "2026-09-14T07:32:01.000Z",
        "ended_at": "2026-09-14T07:33:30.000Z",
        "landing_path": "/portfolio/",
        "exit_path": "/portfolio/",
        "referrer": "https://www.linkedin.com/",
        "utm_source": "linkedin",
        "utm_medium": "social",
        "utm_campaign": "portfolio-q3",
        "country_code": "ID",
        "city": "Yogyakarta",
        "device": "mobile",
        "browser": "Chrome",
        "os": "Android",
        "pageview_count": 2,
        "click_count": 4,
        "outbound_count": 1,
        "outbound_channels": ["whatsapp"],
        "max_scroll_percent": 90,
        "active_ms": 89000,
        "is_bot": false,
        "incomplete": false
      }
    ],
    "page": 1,
    "pageSize": 20,
    "total": 151
  }
}

### GET /sessions/:id

{
  "data": {
    "session": { /* object sama seperti item list */ },
    "events": [
      {
        "event_id": "f0a1…",
        "name": "page_view",
        "ts": "2026-09-14T07:32:01.010Z",
        "page_id": "home",
        "path": "/portfolio/",
        "props": { "page_id": "home" }
      },
      {
        "event_id": "…",
        "name": "outbound_click",
        "ts": "2026-09-14T07:33:30.000Z",
        "page_id": "home",
        "path": "/portfolio/",
        "props": { "channel": "whatsapp", "element_id": "contact_wa_cta" }
      }
    ]
  }
}

events urut ts ascending.

## Label klik (allowlist) — pakai di tabel Clicks

Home:
  nav_logo             Logo (~/irfan)
  nav_toggle           Menu mobile
  nav_about            Nav About
  nav_work             Nav Work
  nav_reviews          Nav Reviews
  nav_services         Nav Services
  nav_contact          Nav Contact
  nav_all_work         Nav All work
  cta_view_projects    CTA View projects (hero)
  cta_start_project    CTA Start a project
  cta_all_work         View all work
  faq_item             FAQ
  intro_skip           Skip intro
  contact_email_cta    Contact email CTA
  contact_wa_cta       Contact WhatsApp CTA
  contact_email_link   Link email
  contact_wa_link      Link WhatsApp
  social_instagram     Instagram

Work:
  work_back_home       Back to home
  career_step          Career step
  catalog_item         Catalog item

Kartu work (click / work_card_view): tampilkan work_slug atau work_title dari props.

## Fetch pattern

- Jangan waterfall 10 request blocking first paint. Parallel:
  overview, timeseries, geo, outbounds dulu (above the fold)
  pages, sections, clicks, referrers, sessions lazy / tab
- AbortController saat ganti filter
- Skeleton per widget, error per widget (satu gagal jangan blank seluruh page)
- Format angka: 128, 1.2k kalau >= 1000 opsional
- Format durasi: < 1m → “42s”; >= 1m → “1m 14s”; >= 1h → “1h 02m”

## Yang jangan dikerjakan di halaman ini

- Jangan POST /collect dari admin UI
- Jangan heatmap / screen recording
- Jangan export CSV / realtime websocket (v1)
- Jangan gabung data FamilyRoots / Money Track / Upwork
- Jangan tampilkan IP
- Jangan minta pengunjung portfolio login
- Funnel visual (home → work → contact → WA) boleh v2; v1 cukup KPI + clicks + outbounds + session timeline

## Acceptance FE v1

- Nav hanya untuk admin; member tidak melihat menu
- Auth sama dengan /admin/dashboard (JWT + X-Module-Unlock); tidak ada form token analytics
- Ganti rentang tanggal mengubah KPI + chart
- Toggle bot mengubah angka
- Overview bisa jawab unique, pageview, top negara, top klik, Email vs WA vs IG
- Klik 1 session membuka timeline berurutan
```

---

## Catatan BE (jangan dikirim ke ticket FE kecuali perlu)

- Collect tetap publik: `POST /api/v1/analytics/collect` (bukan JWT).
- Dashboard: `GET /api/v1/admin/analytics/…` — `requireAuth` + `requireAdmin` + `requireModuleUnlock('admin')`.
- Envelope `{ data }` / `{ error: { code, message, requestId } }`.
- File tracker Astro terpisah; jangan dicampur ke prompt admin ini.
