# money-debt-pocket-linking

Tanggal: 2026-09-30

Utang/piutang bisa di-link ke kantong: `mt_debts.pocket_id` baru, saldo kantong ikut naik/turun (utang `+`, piutang `−`, dihitung derived dari `mt_debts` + `mt_debt_payments`), dan `GET /money/activity` punya `kind: "debt"` berisi satu baris agregat per debt dengan `netAmount`, `interestAmount` (kelebihan bayar), `status`, `direction`, dan `link: "/money/debts/:id"`. Bayar melebihi pokok tidak lagi `422` (dihitung sebagai bunga), dan response mutasi debt punya `balanceWarning` kalau saldo kantong jadi minus (peringatan, bukan error).

## Env

Tidak ada.

`RUN_SEED` tetap `false`. `SKIP_MIGRATE` tetap `false`.

## Migration

Ada. Jalan otomatis saat container start (`SKIP_MIGRATE` tetap `false`).

- `src/database/migrations/20260930100000_alter_mt_debts_add_pocket_link.ts` — menambah `mt_debts.pocket_id` (nullable, FK ke `mt_pockets.id`, `ON DELETE SET NULL`) + index `mt_debts_workspace_pocket_idx`. Debt lama `pocket_id = NULL` tetap valid dan tidak mengubah response/saldo apa pun.

## Data awal

Tidak ada.

Nilai `kind: "debt"` cukup konstanta TypeScript — bukan ENUM di migration. Seeder debt (`03_money_track_data.ts`) sudah di-link ke kantong untuk demo lokal, tidak dijalankan di STB.

## Cek setelah naik

```bash
curl -fsS http://localhost:3000/api/v1/health
```

Harapan: `{"status":"ok"}`.

```bash
curl -sS -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/v1/money/activity"
```

Harapan: `401` (route hidup, butuh login). `404` berarti build/commit belum naik.

```bash
curl -sS -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/v1/money/debts"
```

Harapan: `401` (route hidup, butuh login).
