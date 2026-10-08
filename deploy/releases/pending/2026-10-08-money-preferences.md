# money-preferences

Tanggal: 2026-10-08

Preferensi Money Track per workspace lewat `GET`/`PUT /api/v1/money/preferences`: tipe default, nominal cepat, default kantong/kategori (scope "Gabungan") + override per-person. `GET` mengembalikan default bila belum pernah disimpan (200, bukan 404); `PUT` menyimpan replace penuh dan menormalkan ID yang tidak valid jadi `null`.

## Env

Tidak ada.

`RUN_SEED` tetap `false`. `SKIP_MIGRATE` tetap `false`.

## Migration

Ada. Jalan otomatis saat container start (`SKIP_MIGRATE` tetap `false`).

- `src/database/migrations/20261008100000_create_mt_preferences.ts` — membuat tabel `mt_preferences` (1 baris per workspace; kolom `default_tx_type` enum, JSON `quick_amounts`/`shared`/`persons`; FK `workspace_id` → `mt_workspaces.id` `ON DELETE CASCADE`; unique `mt_preferences_workspace_unique`).

## Data awal

Tidak ada. Default preferensi dikembalikan oleh kode (`defaultPreferences()`), bukan seeder.

## Cek setelah naik

```bash
curl -fsS http://localhost:3000/api/v1/health
```

Harapan: `{"status":"ok"}`.

```bash
curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/v1/money/preferences
```

Harapan: `401` (route hidup, butuh login). `404` berarti route belum naik.

```bash
curl -sS -o /dev/null -w "%{http_code}\n" -X PUT -H 'Content-Type: application/json' -d '{}' http://localhost:3000/api/v1/money/preferences
```

Harapan: `401` (butuh login sebelum validasi jalan).
