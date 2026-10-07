# Utang/Piutang nempel ke Kantong — integrasi FE

> Spek lengkap (keputusan, acceptance criteria, rumus): BE sudah live di
> [`from-fe/done/MONEY-DEBT-POCKET-LINKING-BE-PROMPT.md`](../../from-fe/done/MONEY-DEBT-POCKET-LINKING-BE-PROMPT.md).
> Dokumen ini yang dipakai FE buat ngerjain bagian UI-nya.

## Perubahan BE (yang sudah live)

1. **Debt bisa di-link ke kantong.** `pocketId` opsional di `POST /money/debts` &
   `PATCH /money/debts/:id` (`null` = lepas link, catatan saja).
   Response debt punya `pocketId`, `pocketLabel`, `netEffect`, `interestAmount`, `balanceWarning`.
   `GET /money/debts?pocketId=` filter opsional.
2. **Saldo kantong ikut efek debt** (derived, tanpa ledger baru):
   `netEffect = sign × (amount − paidTotal)`, `sign = +1` utang / `−1` piutang.
3. **`GET /money/activity` ada `kind: "debt"`** — satu baris agregat per debt
   (tanggal = tanggal buat debt; riwayat bayar tetap di `GET /money/debts/:id`).
   Opt-out: `?includeDebts=false` (jaring aman kalau FE belum siap).
4. **Bayar melebihi pokok tidak lagi `422`** — kelebihan bayar jadi bunga:
   `interestAmount = max(0, paidTotal − amount)`.

### Item activity `kind: "debt"`

```json
{
  "id": "debt:12",
  "kind": "debt",
  "title": "Pinjaman Budi",
  "categoryName": "Utang",
  "categoryId": null,
  "personId": 1,
  "personName": "Irfan",
  "pocketId": 101,
  "pocketLabel": "Transaksi · BCA",
  "toPocketId": null,
  "toPocketLabel": null,
  "amount": 500000,
  "date": "2026-08-01",
  "signed": "neg",
  "netAmount": -500000,
  "direction": "utang",
  "status": "paid",
  "principalAmount": 5000000,
  "paidTotal": 5500000,
  "remaining": 0,
  "interestAmount": 500000,
  "link": "/money/debts/12"
}
```

- `amount` = `Math.abs(netAmount)` (selalu ≥ 0, sama seperti kind lain).
- `signed` = `pos`/`neg`/`neutral` — `neutral` (`netAmount = 0`) = **lunas tanpa bunga**,
  baris **tetap ada** di list.
- `netAmount` = nilai bertanda (bisa `0` / negatif) → FE tinggal tampilin, tidak usah hitung.
- `direction` `utang`|`piutang`, `status` `open`|`partial`|`paid`, `link` → `/money/debts/:id`.

### `balanceWarning` (info, bukan error)

Muncul di response `POST`/`PATCH`/`POST .../payments` kalau saldo kantong minus —
HTTP tetap `2xx`:

```json
{
  "balanceWarning": {
    "isNegative": true,
    "pocketId": 101,
    "pocketLabel": "Transaksi · BCA",
    "pocketBalanceAfter": -1500000,
    "shortfall": 1500000,
    "message": "Saldo kantong Transaksi · BCA minus (Rp 1.500.000). Mohon sesuaikan kantongnya di menu Balancing."
  }
}
```

`balanceWarning = null` kalau saldo cukup / debt tidak pakai kantong.

## FE saran

1. `moneyApi.ts` — `kind` + `MoneyUiTx['kind']` tambah `'debt'`; map `direction`, `status`,
   `principalAmount`, `paidTotal`, `remaining`, `netAmount`, `interestAmount`, `link`.
   Debt API tambah `pocketId`, `pocketLabel`, `netEffect`, `interestAmount`, `balanceWarning`.
2. `TransactionsPage.tsx` — chip filter „Utang/Piutang"; tampilkan `0` saat lunas tanpa bunga,
   `−Rp x` saat `signed === 'neg'`; badge **„Bunga Rp x”** kalau `interestAmount > 0`;
   sembunyikan Edit/Hapus untuk `kind === 'debt'` (bukan ledger row) dan ganti ikon audit
   jadi **link ke `/money/debts/:id`**.
3. `PocketHistorySheet.tsx` — baris `kind === 'debt'` tidak ikut hitungan Masuk/Keluar,
   tampilkan badge „Utang/Piutang” + link ke detail (pakai `link` dari BE).
4. `DebtsPage.tsx` / `DebtDetailPage.tsx` — tampilkan kantong ter-link + `netEffect`,
   baris „Bunga” di ringkasan & riwayat pembayaran.
5. `CrudModals.tsx` (modal debt) — select **Kantong** (opsional, kosong = „Tanpa kantong
   (catatan saja)”) + helper text efek saldo. Kalau response ada `balanceWarning` →
   pop-up info dengan tombol „Atur kantong” → `/money/pockets`.
6. `DebtDetailPage` — izinkan input nilai > sisa (bunga) dan tampilkan „Bunga Rp x”.

Urutan aman: deploy BE → deploy FE → baru user mulai link debt ke kantong.
Selama FE belum siap, kirim `GET /money/activity?...&includeDebts=false`.
