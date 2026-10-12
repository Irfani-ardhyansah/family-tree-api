# admin-audit-log-sort

Tanggal: 2026-10-12

Audit Log admin (`GET /api/v1/admin/audit-logs`) dapat query param `sort`:

- `sort=asc` → urutan `occurred_at` naik (paling lama dulu).
- `sort=desc` (atau tidak dikirim) → urutan turun (paling baru dulu) — perilaku lama, tidak breaking.
- Nilai selain `asc`/`desc` → `422 VALIDATION_ERROR` (`sort harus "asc" atau "desc".`).
- Urutan tetap dihormati saat digabung filter `userId`, `moduleId`, `action`, `from`/`to`, `q`, dan pagination server-side.

## Env

Tidak ada.

`RUN_SEED` tetap `false`. `SKIP_MIGRATE` tetap `false`.

## Migration

Tidak ada.

## Data awal

Tidak ada.

## Cek setelah naik

```bash
curl -fsS http://localhost:3000/api/v1/health
```

Harapan: `{"status":"ok"}`.

```bash
curl -sS -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/v1/admin/audit-logs?sort=asc&page=1&pageSize=8"
```

Harapan: `401` (route hidup, butuh login admin). `404`/`5xx` berarti endpoint belum naik.

```bash
curl -sS -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/v1/admin/audit-logs?sort=foo"
```

Harapan: `401` (tanpa login, validasi sort belum jalan). Setelah login admin, `sort=foo` harus `422`; `sort=asc` mengembalikan item pertama paling lama.
