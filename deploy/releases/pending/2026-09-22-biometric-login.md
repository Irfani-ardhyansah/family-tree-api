# biometric-login

Tanggal: 2026-09-22

Login biometrik (WebAuthn): tabel kredensial, saklar modul `biometric` (default mati), dan endpoint daftar/login/admin.

## Env

Tambah manual ke `.env.docker` di STB. Nilai contoh ada di `.env.docker.example`.

- `WEBAUTHN_RP_ID` — hostname frontend saja, tanpa `http://` dan tanpa port. Harus sama dengan host yang dipakai browser. Bukan `localhost` kalau dibuka dari HP atau laptop lain.
- `WEBAUTHN_RP_NAME` — nama yang muncul di dialog sistem. Isi `FamilyRoots`.
- `WEBAUTHN_ORIGIN` — origin penuh frontend, sama persis dengan address bar, misalnya `http://192.168.1.50:5173`.

`RUN_SEED` tetap `false`. `SKIP_MIGRATE` tetap `false`.

## Migration

Ada. Jalan otomatis saat container start (`SKIP_MIGRATE` tetap `false`).

- `src/database/migrations/20260922120000_create_webauthn.ts`

Menambah nilai enum `biometric` pada `core_module_statuses`, plus tabel `core_webauthn_credentials` dan `core_webauthn_challenges`. Tidak mengisi data keluarga.

## Data awal

Tidak ada.

Saklar login biometrik dibuat aplikasi saat admin atau `/auth/me` pertama kali membaca status modul, dengan `enabled: false`. Jangan set `RUN_SEED=true`.

## Cek setelah naik

```bash
curl -fsS http://localhost:3000/api/v1/health
```

Harapan: `{"status":"ok"}`.

Route biometrik hidup, dan modul masih mati (belum ada keluarga yang menyalakan saklar):

```bash
curl -sS -X POST http://localhost:3000/api/v1/auth/webauthn/login/options \
  -H 'Content-Type: application/json' \
  -d '{}'
```

Harapan: HTTP 403 dan `"code":"BIOMETRIC_DISABLED"`. HTTP 404 berarti route belum naik.
