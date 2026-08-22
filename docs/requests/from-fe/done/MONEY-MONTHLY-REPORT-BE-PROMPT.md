# Prompt BE — Monthly evaluation report API

Lempar prompt ini ke AI BE.

Related kontrak: [`docs/requests/to-be/MONEY-TRACK-API.md`](../../to-be/MONEY-TRACK-API.md)  
FE sementara aggregat dari `GET /money/activity` (bulan ini + bulan lalu). Endpoint ini **direkomendasikan** agar report akurat (tanpa batas pagination) dan lebih cepat.

---

## Konteks

Halaman FE **Reporting** (`/money/reporting`) dipakai evaluasi bulanan:

- Ringkasan income / expense / net + MoM %
- Tren harian + cashflow kumulatif
- Breakdown kategori, kantong, person
- Ringkasan transfer & tarik tunai
- Snapshot utang/piutang (sudah dari `/money/debts`)

**Out of scope endpoint ini:** wishlist progress (akan jadi menu terpisah).

Saat ini FE call `GET /money/activity?from=&to=&pageSize=500` — rawis jika transaksi > 500 atau butuh 2 bulan + agregat multi-dimensi.

---

## Request

### `GET /money/reports/monthly`

Query:

| Param | Required | Contoh | Ket |
|-------|----------|--------|-----|
| `yearMonth` | ya | `2026-08` | Periode evaluasi |
| `scope` | tidak | `all` \| `person` | Default `all` |
| `personId` | jika scope=person | `1` | |

Auth + `X-Module-Unlock` sama seperti route `/money/*` lain.

### Response shape

```json
{
  "period": { "yearMonth": "2026-08", "label": "Agustus 2026", "from": "2026-08-01", "to": "2026-08-31" },
  "previousPeriod": { "yearMonth": "2026-07", "label": "Juli 2026" },
  "scope": "all",
  "summary": {
    "income": 24500000,
    "expense": 14180000,
    "net": 10320000,
    "savingsRatePct": 42.1,
    "incomeChangePct": 8.0,
    "expenseChangePct": -3.2,
    "netChangePct": 15.5,
    "txnCount": 86,
    "expenseTxnCount": 70,
    "incomeTxnCount": 16
  },
  "previousSummary": {
    "income": 22700000,
    "expense": 14650000,
    "net": 8050000
  },
  "daily": [
    {
      "date": "2026-08-01",
      "income": 0,
      "expense": 85000,
      "net": -85000,
      "cumulativeNet": -85000
    }
  ],
  "byCategory": {
    "expense": [
      { "categoryId": 3, "categoryName": "Makan", "amount": 3200000, "pct": 22.6, "count": 28 }
    ],
    "income": [
      { "categoryId": 10, "categoryName": "Gaji", "amount": 20000000, "pct": 81.6, "count": 2 }
    ]
  },
  "byPocket": [
    {
      "pocketId": 101,
      "pocketName": "Transaksi",
      "accountName": "BCA",
      "personId": 1,
      "personName": "Irfan",
      "income": 500000,
      "expense": 4100000,
      "net": -3600000
    }
  ],
  "byPerson": [
    {
      "personId": 1,
      "personName": "Irfan",
      "income": 12000000,
      "expense": 7000000,
      "net": 5000000
    }
  ],
  "moves": {
    "transfer": { "count": 4, "amount": 5500000 },
    "cashWithdrawal": { "count": 3, "amount": 1200000 }
  },
  "topExpenseDays": [
    { "date": "2026-08-12", "expense": 950000, "income": 0 }
  ],
  "debtsOpen": {
    "utangRemaining": 750000,
    "piutangRemaining": 800000,
    "dueSoonCount": 1,
    "openCount": 2
  }
}
```

### Aturan aggregat

1. **Income / expense** hanya dari transaksi ledger `type=income|expense` (bukan transfer, cash withdrawal, opening, adjustment).
2. **Transfer / cash_withdrawal** masuk `moves` saja — jangan dihitung ke expense.
3. **`daily`**: isi semua hari di bulan (nilai 0 jika kosong); `cumulativeNet` = running sum `(income - expense)` dari tgl 1.
4. **`*ChangePct`**: vs `previousSummary`; jika previous = 0 dan current > 0 → `null` atau `100` (dokumentasikan pilihan BE; FE treat `null` sebagai “n/a”).
5. **`byPocket`**: group by pocket sisi transaksi; untuk expense/income pakai `pocketId` transaksi. Sort by `|net|` atau `expense` desc.
6. **`topExpenseDays`**: max 5 hari expense tertinggi.
7. **`debtsOpen`**: snapshot sisa open/partial saat request (boleh mirror list debts), bukan “perubahan di bulan itu” (kecuali BE nanti tambah `debtPaidInPeriod`).
8. Integer rupiah; pct boleh float 1 desimal.

### Error

| Kode | Kapan |
|------|--------|
| `VALIDATION_ERROR` | `yearMonth` invalid |
| `FORBIDDEN` / unlock | sama kontrak money lain |

### Opsional (boleh menyusul)

- `GET /money/reports/monthly.csv?yearMonth=` — export server-side  
- Query `compare=previous|yearAgo`  
- `budgetVsActual` array (reuse `/money/budgets`) — FE budget UI masih stub

---

## Acceptance

- [ ] Satu request mengembalikan semua blok di atas untuk `yearMonth` + scope
- [ ] Jumlah `summary.income/expense` = sum `daily` = sum `byCategory` (masing-masing tipe)
- [ ] Transfer tidak menggelembungkan expense
- [ ] FE bisa ganti aggregat lokal dengan endpoint ini tanpa ubah layout Reporting

---

## Catatan FE (sementara)

Sampai endpoint ini live, Reporting memakai:

- `GET /money/activity` bulan ini + bulan lalu  
- `GET /money/debts` untuk snapshot utang/piutang  
- Export CSV di-generate client-side
