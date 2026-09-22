# Portfolio Analytics API

Kontrak live untuk ingest event site portfolio (Astro statis) dan dashboard admin.

**Collect base:** `{API_BASE}/api/v1/analytics`  
**Admin base:** `{API_BASE}/api/v1/admin/analytics`  
**Timezone laporan:** `Asia/Jakarta`  
**Envelope sukses:** `{ "data": ... }`  
**Envelope error:** `{ "error": { "code", "message", "requestId" } }`

Dua pintu:

| Pintu | Auth | Siapa |
|---|---|---|
| **Collect** `POST /api/v1/analytics/collect` | Publik. Tanpa login. Origin allowlist. Write key opsional. | Pengunjung portfolio |
| **Admin reads** `GET /api/v1/admin/analytics/…` | JWT FamilyRoots + role admin + `X-Module-Unlock` (sama `/admin/dashboard`) | family-tree-fe |

Identitas visitor = UUID anonim di `localStorage` (`pf_vid`) / `sessionStorage` (`pf_sid`). FE **jangan** kirim IP; BE ambil dari request + GeoIP.

Prompt UI:

- Tracker publik: [`docs/requests/to-fe/pending/PORTFOLIO-ANALYTICS-COLLECT-FE-PROMPT.md`](../requests/to-fe/pending/PORTFOLIO-ANALYTICS-COLLECT-FE-PROMPT.md)
- Dashboard admin: [`docs/requests/to-fe/pending/PORTFOLIO-ANALYTICS-ADMIN-FE-PROMPT.md`](../requests/to-fe/pending/PORTFOLIO-ANALYTICS-ADMIN-FE-PROMPT.md)

---

## 1. Collect (proposal / ingest publik)

`POST /api/v1/analytics/collect`

- Content-Type: `application/json` saja (kirim Blob JSON kalau `sendBeacon`)
- Max body 32 KB, max 50 events / request
- Sukses: **202** `{ "data": { "accepted": 1, "duplicate_event_ids": [] } }`
- Idempoten by `event_id` (UUID atau ULID). Duplikat tidak double-count, tetap 202
- Origin harus domain portfolio (`ANALYTICS_CORS_ORIGINS`). Production: request tanpa `Origin` ditolak
- `Authorization: Bearer <ANALYTICS_WRITE_KEY>` **opsional** (bukan akun user)
- Rate limit: 60 req/menit/IP, 120 events/menit/IP → 429 `TOO_MANY_ATTEMPTS`

### Body

```json
{
  "schema_version": 1,
  "visitor_id": "8c1d0c5a-2f3a-4b1e-9c0d-1a2b3c4d5e6f",
  "session_id": "b91e2a10-1111-4aaa-8bbb-cccccccccccc",
  "sent_at": "2026-09-14T14:32:01.120Z",
  "page": {
    "path": "/portfolio/",
    "title": "Irfan — Portfolio",
    "referrer": "https://www.linkedin.com/",
    "utm": {
      "source": "linkedin",
      "medium": "social",
      "campaign": "portfolio-q3",
      "content": null,
      "term": null
    }
  },
  "context": {
    "locale": "en-US",
    "timezone": "Asia/Jakarta",
    "viewport": { "w": 390, "h": 844 },
    "screen": { "w": 390, "h": 844, "dpr": 3 }
  },
  "events": [
    {
      "event_id": "f0a10c5a-2f3a-4b1e-9c0d-1a2b3c4d5e70",
      "name": "page_view",
      "ts": "2026-09-14T14:32:01.010Z",
      "props": { "page_id": "home" }
    }
  ]
}
```

`visitor_id` / `session_id` wajib UUID. Kalau kosong, `page_view` tetap disimpan dengan `incomplete: true`; event lain di-drop.

`path` allowlist (trailing slash bebas): `/`, `/work`, `/portfolio`, `/portfolio/work`. Path `/.env` dll dibuang.

### Katalog `name`

| name | props |
|---|---|
| `page_view` | `page_id`: `home` \| `work` |
| `session_start` | `landing_path`, `referrer` |
| `click` | `element_id` allowlist **atau** `work_slug` |
| `outbound_click` | `channel`: `email` \| `whatsapp` \| `instagram`, `element_id` |
| `section_view` | `section_id` allowlist |
| `scroll_depth` | `percent`: 25 \| 50 \| 75 \| 90 \| 100 |
| `engagement_heartbeat` | `active_ms`, `page_id` |
| `intro_shown` / `intro_skipped` / `intro_completed` | — |
| `work_card_view` | `work_slug` atau `work_title` |

Event / `element_id` / `section_id` di luar allowlist di-drop (bukan 400 seluruh batch).

**Click `element_id` home:** `nav_logo`, `nav_toggle`, `nav_about`, `nav_work`, `nav_reviews`, `nav_services`, `nav_contact`, `nav_all_work`, `cta_view_projects`, `cta_start_project`, `cta_all_work`, `faq_item`, `intro_skip`, `contact_email_cta`, `contact_wa_cta`, `contact_email_link`, `contact_wa_link`, `social_instagram`

**Work:** `work_back_home`, `career_step`, `catalog_item`

**Section home:** `hero` `about` `work` `reviews` `beyond` `services` `process` `faq` `contact`  
**Section work:** `career` `professional` `freelance` `personal`

### Error collect

| HTTP | code |
|---|---|
| 400 | `ANALYTICS_INVALID_PAYLOAD` |
| 401 | `UNAUTHORIZED` (write key salah, kalau dikirim) |
| 403 | `CORS_FORBIDDEN` |
| 413 | `ANALYTICS_PAYLOAD_TOO_LARGE` |
| 429 | `TOO_MANY_ATTEMPTS` |

---

## 2. Admin analytics (reporting) — family-tree-fe

Base: `/api/v1/admin/analytics`

Auth **sama dengan admin panel lain**:

- `Authorization: Bearer <accessToken>` (JWT login FamilyRoots)
- `X-Module-Unlock: <unlockToken>` (password kedua)
- Hanya `role === admin` → selain itu 403 `FORBIDDEN`

Bukan `ANALYTICS_ADMIN_TOKEN`.

Query umum:

| Param | Default | Ket |
|---|---|---|
| `from` | 14 hari terakhir | `YYYY-MM-DD` inclusive, Asia/Jakarta |
| `to` | hari ini | sama |
| `page_id` | semua | `home` \| `work` |
| `exclude_bots` | `true` | `true` \| `false` |

**Bounce v1:** 1 pageview, 0 click, `active_ms` < 10s, max scroll < 25%.

### `GET /overview`

```json
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
```

### `GET /timeseries`

`data.buckets[]`: `{ date, unique_visitors, pageviews, sessions }` — semua hari di range, nilai 0 jika sepi.

### `GET /geo`

`data.items[]`: `{ country_code, country_name, count, percent }` — `count` = unique visitors.

### `GET /pages`

`data.items[]`: `{ page_id, path, pageviews, unique_visitors, avg_active_ms, bounce_rate }`

### `GET /sections`

`data.items[]`: `{ page_id, section_id, views, unique_sessions }`

### `GET /clicks`

`data.items[]`: `{ element_id, element_type, label, count, percent }` — top 50.

### `GET /outbounds`

```json
{
  "data": {
    "totals": { "email": 6, "whatsapp": 11, "instagram": 3 },
    "buckets": [{ "date": "2026-09-01", "email": 1, "whatsapp": 2, "instagram": 0 }]
  }
}
```

### `GET /referrers`

`data.referrers[]`: `{ referrer, count, percent }` (`referrer` null = direct)  
`data.utm_sources[]`: `{ source, count, percent }`

### `GET /sessions?page=1&pageSize=20`

`data.items[]` session list + `page`, `pageSize`, `total`.  
Item: `session_id`, `visitor_id`, `started_at`, `ended_at`, paths, referrer, utm, country/city, device/browser/os, counters, `outbound_channels`, `active_ms`, `is_bot`, `incomplete`.

IP dan user-agent **tidak** dikirim ke FE.

### `GET /sessions/:id`

```json
{
  "data": {
    "session": { },
    "events": [
      {
        "event_id": "…",
        "name": "page_view",
        "ts": "2026-09-14T07:32:01.010Z",
        "page_id": "home",
        "path": "/portfolio/",
        "props": { "page_id": "home" }
      }
    ]
  }
}
```

404 `ANALYTICS_SESSION_NOT_FOUND`. Events urut `ts` ascending.

### Error admin

| HTTP | code |
|---|---|
| 401 | `UNAUTHORIZED` |
| 403 | `FORBIDDEN` / `SECONDARY_UNLOCK_REQUIRED` / `SECONDARY_UNLOCK_INVALID` |
| 404 | `ANALYTICS_SESSION_NOT_FOUND` |
| 422 | `VALIDATION_ERROR` (from/to / page_id) |

---

## 3. Env BE

```
ANALYTICS_WRITE_KEY=          # opsional, collect saja
ANALYTICS_IP_HASH_SECRET=     # hash IP
ANALYTICS_CORS_ORIGINS=https://your-portfolio.example
ANALYTICS_ALLOWED_PATHS=      # opsional, default / dan /portfolio…
GEOIP_DB_PATH=                # opsional GeoLite2 .mmdb (+ npm i maxmind)
TRUSTED_PROXY_IPS=            # opsional
```

IP raw di session di-null-kan setelah 30 hari (hash tetap). Raw events dihapus setelah 90 hari. Rollup harian 12 bulan.

---

## 4. Bukan bagian v1

Heatmap, CSV, websocket, alert Telegram, consent stripping, UI di BE, tracking di luar domain portfolio, funnel endpoint khusus (hitung dari events).
