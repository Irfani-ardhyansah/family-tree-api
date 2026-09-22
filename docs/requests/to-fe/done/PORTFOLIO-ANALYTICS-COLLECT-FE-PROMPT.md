# Prompt FE — Portfolio analytics tracker (collect)

Salin blok di bawah ke chat AI / ticket **FE portfolio** (Astro). Ini **bukan** halaman admin.

Kontrak lengkap: [`docs/reference/PORTFOLIO-ANALYTICS-API.md`](../../reference/PORTFOLIO-ANALYTICS-API.md)  
UI admin terpisah: [`PORTFOLIO-ANALYTICS-ADMIN-FE-PROMPT.md`](./PORTFOLIO-ANALYTICS-ADMIN-FE-PROMPT.md)

---

## Prompt

```
Kamu mengerjakan snippet tracker analytics di site portfolio Astro (static).

## Konteks
Pengunjung TIDAK login. Jangan pakai JWT FamilyRoots / cookie akun.
Generate UUID sendiri:
- visitor_id: localStorage key `pf_vid` (bertahan)
- session_id: sessionStorage key `pf_sid`
  session baru jika idle > 30 menit, midnight UTC, atau ganti utm_* / referrer campaign

Endpoint:
POST {API_BASE}/api/v1/analytics/collect
Content-Type: application/json
Origin: domain portfolio (CORS). Jangan kirim IP.
Authorization: Bearer WRITE_KEY hanya jika env FE punya key (opsional, bukan login).

Sukses = 202 { data: { accepted, duplicate_event_ids } }
Gagal (4xx/network) → drop antrian, jangan retry agresif. Jangan blok UI.

schema_version: 1
Max 50 events / request, body < 32 KB.
event_id unik per event (UUID atau ULID) — boleh kirim ulang; BE idempotent.

path kirim apa adanya (contoh `/` atau `/portfolio/` atau `/work/`). Jangan hardcode base path di tracker.

## Events yang wajib
- page_view tiap load (page_id home | work)
- session_start saat sid baru
- click hanya element allowlist (data-track="nav_about") — bukan semua klik
- outbound_click untuk mailto / wa.me / Instagram (channel email|whatsapp|instagram)
- section_view: IntersectionObserver ≥50% viewport ≥500ms, sekali per section per session
- scroll_depth: 25, 50, 75, 90, 100 sekali per nilai per pageview
- engagement_heartbeat: tiap 15s tab visible, max 20 menit, props.active_ms kumulatif
- intro_shown / intro_skipped / intro_completed (home)
- work_card_view saat kartu work masuk viewport; klik kartu: click + work_slug

Flush: batch fetch keepalive + sendBeacon(pagehide/visibilitychange) dengan Blob type application/json.

Allowlist element_id dan section_id: lihat docs/reference/PORTFOLIO-ANALYTICS-API.md bagian Collect.

## Jangan
- Jangan kirim IP / country / ASN dari browser
- Jangan pasang di halaman admin analytics
- Jangan track path di luar site (/.env, dll)
- Jangan minta user login untuk tracking
```
