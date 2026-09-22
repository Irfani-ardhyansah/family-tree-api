# Request Plan — Portfolio Analytics Backend

Status: draft (siap direvisi sebelum dikerjakan BE)
Site: Astro static portfolio (`/` dan `/work/`)
Pemilik permintaan: Irfan
Tujuan file ini: spec ingest + reporting supaya BE bisa estimasi, design API, dan implementasi tanpa tebak-tebakan.

---

## 1. Masalah yang mau dijawab

Setiap orang yang buka halaman portfolio harus tercatat. Dari situ kita mau tahu:

1. **Berapa orang** yang akses (unique visitor) vs berapa kali halaman dibuka (pageview).
2. **Dari mana** mereka datang (negara, kota kalau ada, referrer, UTM).
3. **Mereka ngapain** di halaman: section mana yang kelihatan, elemen mana yang diklik, CTA mana yang dipakai, berapa lama stay.
4. **Mana yang paling menarik** (impresi section / kartu work vs klik).
5. **Lead intent**: klik Email, WhatsApp, Instagram, atau “Start a project”.

Ini bukan generic “pasang Google Analytics”. Data harus kita punya sendiri, query-able, dan bisa di-dashboard-in.

---

## 2. Konteks FE (penting buat BE)

- Site **static** (Astro + Nginx). Tidak ada server-side session di FE.
- FE yang kirim event ke BE via `POST` (beacon / fetch keepalive).
- **IP, country, ASN, bot-detect jangan dikirim dari browser.** BE ambil dari request + GeoIP.
- Ada 2 route yang harus di-track:
  - Home: `/` atau `/portfolio/` (tergantung deploy)
  - Work catalog: `/work/` atau `/portfolio/work/`
- Traffic sementara bisa lewat **ngrok** (`X-Forwarded-For` / `X-Real-IP` harus dipercaya dengan hati-hati).

---

## 3. Scope

### In scope (v1)

- Ingest event pageview + click + section impression + outbound CTA.
- Session + anonymous visitor.
- Enrichment IP → country (dan city kalau murah/tersedia).
- Filter bot / crawler kasar.
- API baca untuk dashboard sederhana (boleh Postman dulu, UI admin belakangan).
- Retention policy (usul: 90 hari raw event, 12 bulan aggregate harian).

### Out of scope (v1)

- Screen recording / heatmap pixel-perfect (Hotjar-style).
- Login user / account visitor.
- A/B test.
- Email capture form (belum ada form di site).
- Real-time websocket dashboard.
- Tracking di luar domain portfolio.

### Bisa menyusul (v2)

- Heatmap / scroll map.
- Funnel visual di admin UI.
- Alert Slack/Telegram kalau ada klik WhatsApp/email.
- Export CSV.

---

## 4. Definisi metrik

| Istilah | Arti |
|---|---|
| **Visitor** | Orang/browser anonim, 1 UUID di `localStorage` (`vid`). Bertahan across session. |
| **Session** | Satu kunjungan. Baru kalau idle > 30 menit, atau midnight UTC, atau ganti `utm_*` / referrer campaign. |
| **Pageview** | 1 load / SPA-equivalent load sebuah path. |
| **Impression** | Section atau kartu **masuk viewport** ≥ 50% selama ≥ 500ms. Bukan hover. |
| **Click** | Klik pada elemen yang di-allowlist (bukan semua klik di halaman). |
| **Outbound** | Klik yang meninggalkan site (mailto, wa.me, Instagram). |
| **Unique visitor (hari/minggu)** | Count distinct `visitor_id` di rentang waktu. |

Jangan samakan pageview dengan unique visitor.

---

## 5. Model identitas

```
visitor_id   UUID v4, FE generate, persist localStorage key `pf_vid`
session_id   UUID v4, FE generate, persist sessionStorage key `pf_sid`
             regenerate mengikuti aturan session di atas
```

BE **tidak** percaya IP sebagai identitas utama (NAT / mobile carrier). IP hanya untuk geo + abuse.

Setiap event wajib bawa `visitor_id` + `session_id`. Kalau salah satu kosong, BE tetap terima pageview tapi tandai `incomplete: true`.

---

## 6. Apa yang BE capture sendiri (jangan dari FE)

Dari HTTP request ingest:

- `ip` (honor `X-Forwarded-For` kiri-paling hanya dari proxy yang kita percaya: Nginx / ngrok)
- `country_code`, `country_name`, `region`, `city` (GeoIP)
- `asn`, `org` (opsional, berguna filter datacenter/bot)
- `user_agent` raw + parse: `device` (`mobile`/`desktop`/`tablet`), `os`, `browser`
- `is_bot` boolean (UA + ASN heuristic)
- `received_at` server timestamp UTC

Jangan simpan body password/PII lain. Email/WA yang diklik cukup sebagai **event name**, bukan isi pesan.

Usul privacy: simpan `ip` raw maksimal 30 hari, setelah itu hash (`sha256(ip + secret)`) atau drop. Country tetap di aggregate.

---

## 7. Payload yang FE kirim

Semua event 1 bentuk. FE boleh batch.

`POST /v1/analytics/collect`

Headers:

- `Content-Type: application/json`
- `Origin` harus allowlist domain portfolio + ngrok (saat staging)
- Opsional: `Authorization: Bearer <public_write_key>` (key **boleh** ada di FE; rate-limit + origin check yang jaga abuse)

Body:

```json
{
  "schema_version": 1,
  "visitor_id": "8c1d0c5a-2f3a-4b1e-9c0d-1a2b3c4d5e6f",
  "session_id": "b91e2a10-1111-4aaa-8bbb-cccccccccccccccc",
  "sent_at": "2026-09-14T14:32:01.120Z",
  "page": {
    "path": "/portfolio/",
    "title": "Irfan — Fullstack Developer | Portfolio",
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
      "event_id": "f0a1...",
      "name": "page_view",
      "ts": "2026-09-14T14:32:01.010Z",
      "props": {
        "page_id": "home"
      }
    }
  ]
}
```

Aturan ingest:

- Max 50 events / request, max body 32 KB.
- Idempoten by `event_id` (ULID/UUID dari FE). Duplikat → 202, no double count.
- `202 Accepted` untuk sukses (jangan blok UI).
- `413` / `429` / `400` dengan `{ "error": "..." }`.
- Tidak perlu CORS cookie. `Access-Control-Allow-Origin` spesifik, bukan `*`.

Beacon: FE akan pakai `navigator.sendBeacon` saat `visibilitychange` / `pagehide` untuk flush antrian. BE harus terima `text/plain` fallback kalau sendBeacon tidak set JSON content-type — **usul: FE selalu Blob `application/json`**. Kalau BE lebih gampang satu content-type, lock ke JSON saja.

---

## 8. Katalog event v1 (dari UI yang ada sekarang)

`page_id`: `home` | `work`

### 8.1 Wajib

| `name` | Kapan fire | `props` |
|---|---|---|
| `page_view` | Setiap load halaman | `page_id` |
| `session_start` | Session baru | `landing_path`, `referrer` |
| `click` | Klik elemen allowlist | `element_id`, `element_type`, `label`, `href?`, `section_id?` |
| `outbound_click` | Klik mailto / wa.me / Instagram | `channel` (`email`\|`whatsapp`\|`instagram`), `element_id` |
| `section_view` | Section ≥50% viewport ≥500ms, **sekali per section per session** | `section_id` |
| `scroll_depth` | Milestone 25, 50, 75, 90, 100 — **sekali per nilai per pageview** | `percent` |
| `engagement_heartbeat` | Setiap 15s selama tab visible, max 20 menit | `active_ms`, `page_id` |

`engagement_heartbeat` dipakai hitung time-on-page yang tidak tertipu tab idle.

### 8.2 Allowlist klik (home)

Pakai `element_id` stabil, jangan CSS class.

| `element_id` | `element_type` | Lokasi |
|---|---|---|
| `nav_logo` | `link` | Navbar `~/irfan` |
| `nav_toggle` | `button` | Menu mobile |
| `nav_about` | `link` | Nav About |
| `nav_work` | `link` | Nav Work |
| `nav_reviews` | `link` | Nav Reviews |
| `nav_services` | `link` | Nav Services |
| `nav_contact` | `link` | Nav Contact |
| `nav_all_work` | `link` | Nav All work |
| `cta_view_projects` | `cta` | Hero primary |
| `cta_start_project` | `cta` | Hero secondary (scroll ke contact) |
| `cta_all_work` | `link` | “View all work →” |
| `faq_item` | `disclosure` | FAQ open/close — props: `question`, `open` (bool) |
| `intro_skip` | `button` | Skip terminal intro |
| `contact_email_cta` | `cta` | Tombol “Let's talk…” |
| `contact_wa_cta` | `cta` | Tombol WhatsApp |
| `contact_email_link` | `link` | Link email |
| `contact_wa_link` | `link` | Link WhatsApp |
| `social_instagram` | `link` | Instagram |

Section ids home (untuk `section_view`):

`hero` `about` `work` `reviews` `beyond` `services` `process` `faq` `contact`

Kartu work di home (impresi + klik kartu):

- `work_card_view` / `click` dengan `work_slug` atau `work_title` slugified, contoh: `ecommerce-platform`, `campus-ops`, `kledo`, `international-freelance`

### 8.3 Allowlist klik (work page)

| `element_id` | Keterangan |
|---|---|
| `work_back_home` | ← Back to home |
| `career_step` | Step di career progression — props: `index`, `title` |
| `catalog_item` | Item di Professional / Freelance / Personal — props: `group`, `title` |

Section ids work: `career` `professional` `freelance` `personal`

### 8.4 Intro (home only)

| `name` | Kapan |
|---|---|
| `intro_shown` | Overlay terminal tampil |
| `intro_skipped` | User tekan skip |
| `intro_completed` | Animasi selesai sendiri |

Berguna: berapa orang nonton intro vs skip.

---

## 9. Schema usulan (longgar, BE boleh beda asal query-nya ketemu)

### `visitors`

- `visitor_id` PK
- `first_seen_at`, `last_seen_at`
- `first_country_code`, `last_country_code`
- `first_referrer`, `first_utm_json`

### `sessions`

- `session_id` PK
- `visitor_id`
- `started_at`, `ended_at` (update dari heartbeat terakhir)
- `landing_path`, `exit_path`
- `referrer`, `utm_*`
- `country_code`, `city`, `device`, `browser`, `os`
- `is_bot`
- `ip_hash` (atau `ip` TTL pendek)
- `pageview_count`, `click_count`, `outbound_count`
- `max_scroll_percent`
- `active_ms`

### `events`

- `event_id` PK
- `visitor_id`, `session_id`
- `name`, `ts`, `received_at`
- `page_id`, `path`
- `props` JSONB
- `country_code`, `is_bot`

Index: `(ts)`, `(name, ts)`, `(session_id, ts)`, `(props->>'element_id')` kalau perlu.

### `daily_rollups` (boleh job malam)

Per tanggal UTC + `page_id`:

- `unique_visitors`, `sessions`, `pageviews`
- `outbound_email`, `outbound_whatsapp`, `outbound_instagram`
- top countries (json)
- avg `active_ms`

Raw event jangan jadi satu-satunya sumber dashboard jangka panjang.

---

## 10. API baca (untuk dashboard / Postman)

Semua read **protected** (admin token, jangan public).

Base: `/v1/analytics`

Query umum: `from`, `to` (ISO date, inclusive, timezone `Asia/Jakarta` default), `page_id?`, `exclude_bots=true` default.

| Method | Path | Isi |
|---|---|---|
| `GET` | `/overview` | unique visitors, sessions, pageviews, avg active time, bounce rate, outbound totals |
| `GET` | `/timeseries` | daily buckets untuk visitors + pageviews |
| `GET` | `/geo` | breakdown country (count + %) |
| `GET` | `/pages` | path / page_id performance |
| `GET` | `/sections` | impressions + avg time in view kalau ada |
| `GET` | `/clicks` | top `element_id` + count |
| `GET` | `/outbounds` | email / wa / ig, plus timeseries |
| `GET` | `/sessions` | list session terbaru (paginated): country, device, landing, last path, active_ms, outbound? |
| `GET` | `/sessions/:id` | timeline event 1 session (replay kasar: page_view → section_view → click) |
| `GET` | `/referrers` | referrer + utm_source |

**Bounce (v1):** session dengan 1 pageview, 0 click, `active_ms` < 10s, max scroll < 25%.

Contoh `GET /overview?from=2026-09-01&to=2026-09-14`:

```json
{
  "from": "2026-09-01",
  "to": "2026-09-14",
  "exclude_bots": true,
  "unique_visitors": 128,
  "sessions": 151,
  "pageviews": 210,
  "bounce_rate": 0.41,
  "avg_active_ms": 74000,
  "outbounds": {
    "email": 6,
    "whatsapp": 11,
    "instagram": 3
  }
}
```

---

## 11. Funnel yang harus bisa dihitung dari data v1

Tanpa endpoint khusus dulu, asal event lengkap:

1. `page_view` home
2. `section_view` `work`
3. `click` `cta_all_work` **atau** `nav_all_work`
4. `page_view` work
5. `section_view` `contact` (kalau balik home) **atau** `outbound_click`

Funnel lead:

1. `page_view`
2. `section_view` `contact`
3. `outbound_click` channel email|whatsapp

---

## 12. Bot, noise, abuse

- Default report **exclude** `is_bot = true`.
- Tandai bot kalau: UA kosong / known crawler, ASN datacenter, hit rate > 30 collect / menit / IP.
- Rate limit write key: 60 req/menit/IP, 120 events/menit/IP.
- Abaikan `page_view` yang `path` di luar allowlist site.
- Ngrok scanners (path random, `/.env`, dll) jangan masuk analytics — ingest hanya dari origin FE.

---

## 13. Privacy / UU PDP (jangan diskip)

Tujuan pemrosesan: memahami traffic portfolio + minat pengunjung, **bukan** jual data.

Usul v1 (revisi legal nanti):

- Tidak ada cookie pihak ketiga.
- `vid` first-party di localStorage (bukan iklan).
- Tidak gabungkan dengan data Upwork/email klien.
- Tidak rekam isi form (belum ada form).
- IP: raw terbatas, lalu hash/drop.
- Retention: raw 90 hari, rollup 12 bulan, lalu hapus.
- Admin akses reporting terbatas.

Kalau mau banner consent: FE urusan; BE tetap terima flag `consent: analytics | denied`. Kalau `denied`, BE hanya simpan pageview aggregate tanpa `visitor_id`/IP — **keputusan produk, masih open**.

---

## 14. Non-functional

| Item | Target v1 |
|---|---|
| Volume | < 20k events/hari (portfolio pribadi). Postgres cukup. |
| Ingest latency | p95 < 200ms (202, proses GeoIP async boleh) |
| Availability ingest | jangan sampai ngerusak FE; gagal → FE drop, tidak retry agresif |
| Dashboard query | p95 < 1s untuk 90 hari rollup |
| Timezone laporan | `Asia/Jakarta` |
| Env | `staging` (ngrok) + `production` |

GeoIP: MaxMind GeoLite2 atau service setara. Cache hasil per IP 24 jam.

---

## 15. Pembagian kerja

**BE**

- Endpoint collect + auth write key + CORS.
- Tabel, idempotensi, GeoIP, bot flag, rollup job.
- Endpoint read admin.
- Env spec: `ANALYTICS_WRITE_KEY`, `ANALYTICS_ADMIN_TOKEN`, `TRUSTED_PROXY_IPS`, `GEOIP_DB_PATH`.

**FE (setelah API staging ready)**

- Snippet tracker kecil di `BaseLayout.astro`.
- Generate vid/sid, allowlist click listener, IntersectionObserver section, scroll milestone, heartbeat, flush on hide.
- `data-track="nav_about"` dll di komponen (boleh dikerjakan paralel setelah element_id di atas di-lock).

**Belum dikerjakan FE sekarang.** Tunggu revisi plan ini.

---

## 16. Urutan implementasi yang disarankan

1. Collect `page_view` + GeoIP + overview unique/pageview. Sudah cukup “berapa yang akses dari negara mana”.
2. `click` + `outbound_click` allowlist. Sudah cukup “impresi aktivitas / minat”.
3. `section_view` + `scroll_depth` + heartbeat.
4. Session timeline + rollup + bot filter.
5. (Opsional) alert Telegram untuk outbound WhatsApp/email.

Jangan mulai dari heatmap.

---

## 17. Open questions (isi waktu revisi)

1. Admin reporting: cukup API/Postman, Metabase, atau BE bikin UI?
2. Consent banner: ya / tidak untuk v1?
3. Simpan IP raw berapa lama?
4. Perlu alert Telegram/Slack untuk klik WhatsApp?
5. Base path production: `/` atau `/portfolio/`? (FE kirim `path` apa adanya; BE jangan hardcode)
6. Apakah preview ngrok ikut masuk DB production atau environment `staging` terpisah?
7. Bahasa dashboard: ID atau EN?

---

## 18. Acceptance criteria v1

- Setiap buka home/work (manusia, bukan bot kasar) menghasilkan `page_view` + session.
- Overview bisa jawab: unique visitor, pageview, top 5 negara, top 10 klik, jumlah klik Email vs WhatsApp vs Instagram, dalam rentang tanggal.
- 1 session bisa di-drill: urutan event + country + device.
- Duplikat `event_id` tidak nambah count.
- Origin asing tidak bisa nulis event.
- FE tidak pernah kirim IP.

---

## 19. Contoh timeline 1 session (yang kita mau lihat)

```
14:32:01  page_view          page_id=home   ID / Yogyakarta / mobile
14:32:02  intro_shown
14:32:06  intro_skipped
14:32:08  section_view       hero
14:32:12  click              cta_view_projects
14:32:13  section_view       work
14:32:18  click              work_card  slug=kledo
14:32:40  click              cta_all_work
14:32:41  page_view          page_id=work
14:32:55  section_view       professional
14:33:20  click              work_back_home
14:33:28  section_view       contact
14:33:30  outbound_click     channel=whatsapp  element_id=contact_wa_cta
```

Kalau BE bisa simpan dan query pola seperti ini, request ini dianggap ketemu.
