# Token MCP per person

Tanggal: 2026-11-07 (update keamanan: 2026-11-08)

Menambah pengelolaan token MCP: user bisa membuat, melihat, dan menghapus token
miliknya sendiri; admin bisa mencabut paksa token anggota keluarga. Token dipakai
sebagai Bearer untuk akses MCP ke API, termasuk modul yang sudah di-unlock saat
token dibuat. Token MCP **tidak** bisa mengubah kredensial/keamanan akun.

Panduan pasca-deploy (buat token, `family-mcp`, Nouride per agent):
`docs/reference/MCP-NOURIDE-SETUP.md`.

## Env

Tidak ada.

## Migration

Ada. Jalan otomatis saat container start (`SKIP_MIGRATE` tetap `false`).

- `src/database/migrations/20261107120000_create_mcp_tokens.ts`

## Data awal

Tidak ada.

## Cek setelah naik

```bash
curl -fsS http://localhost:3000/api/v1/health
```

Harapan: `{"status":"ok"}`.

```bash
curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/v1/auth/mcp-tokens
```

Harapan: `401` (route hidup, butuh login). `404` berarti route belum naik.

```bash
curl -sS -o /dev/null -w "%{http_code}\n" -X POST -H 'Content-Type: application/json' -d '{"label":"cek"}' http://localhost:3000/api/v1/auth/mcp-tokens
```

Harapan: `401` (route hidup, butuh login).

```bash
curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/v1/admin/mcp-tokens
```

Harapan: `401` (route hidup, butuh login admin). `404` berarti route belum naik.

```bash
curl -sS -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/v1/admin/mcp-tokens/1/revoke
```

Harapan: `401` (route hidup, butuh login admin).

Setelah login:
- `POST /auth/mcp-tokens` mengembalikan `token` sekali + `item`; token asli tidak
  disimpan di DB (hanya hash).
- `GET /auth/mcp-tokens` menampilkan token milik sendiri.
- `POST /admin/mcp-tokens/:id/revoke` mencabut token person lain di keluarga yang sama.
- Dengan token MCP, endpoint keamanan akun harus `403 FORBIDDEN`: WebAuthn
  credential management, `secondary-password/setup|verify|change`, `logout`,
  `PATCH /auth/me/options`, dan push subscription. Hanya `GET /auth/me` dan
  endpoint data yang boleh.
- Token MCP di endpoint `/money/*` hanya lolos kalau token dibuat dengan modul
  `money`; tanpa itu response `403 SECONDARY_UNLOCK_REQUIRED`.
