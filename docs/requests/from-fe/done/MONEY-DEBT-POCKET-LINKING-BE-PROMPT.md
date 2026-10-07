# Prompt BE — Utang/Piutang nempel ke Kantong (pocket) + efek di list transaksi

> Dokumen request **FE → BE**. Lempar prompt ini ke AI BE di repo `family-tree-api`.
>
> Related:
> [`done/MONEY-ACTIVITY-TRANSFER-POCKETS-BE-PROMPT.md`](../done/MONEY-ACTIVITY-TRANSFER-POCKETS-BE-PROMPT.md),
> [`done/MONEY-MONTHLY-REPORT-BE-PROMPT.md`](../done/MONEY-MONTHLY-REPORT-BE-PROMPT.md).

---

## 1. Konteks

Halaman FE yang terpengaruh:

| Route | File FE | API yang dipakai |
|-------|---------|------------------|
| `/money/debts` | `DebtsPage.tsx` | `GET /money/debts` |
| `/money/debts/:id` | `DebtDetailPage.tsx` | `GET /money/debts/:id`, `POST /money/debts/:id/payments` |
| `/money/transactions` | `TransactionsPage.tsx` | `GET /money/activity` |
| `/money/pockets` | `PocketsPage.tsx`, `PocketHistorySheet.tsx` | `GET /money/pockets`, `GET /money/activity` |

Kondisi sekarang (hasil audit kode BE `family-tree-api`):

- `mt_debts` **murni catatan** — tidak punya `pocket_id`, tidak menyentuh `mt_transactions`.
- `computePocketBalance()` (`src/modules/money-track/money.balance.ts`) hanya menjumlah
  `mt_transactions` + `mt_transfers` + `mt_cash_withdrawals`.
- `GET /money/activity` (`activity.service.ts`) hanya UNION 3 sumber:
  `txn` (`income`/`expense`), `transfer`, `cash_withdrawal`.
- Akibatnya: bikin piutang/utang **tidak mengubah saldo kantong** dan **tidak muncul di list transaksi**.

Goal: utang & piutang jadi **bagian dari arus kantong**, tapi tetap bisa **dibedakan** statusnya
dan **tetap ada** di list transaksi walau sudah lunas.

---

## 2. Perilaku yang diminta

| Aksi | Efek ke saldo kantong | Baris di list transaksi | Nominal yang tampil |
|------|-----------------------|-------------------------|---------------------|
| Buat **piutang** (kita meminjamkan uang) | **−amount** (saldo turun) | 1 baris, `kind: "debt"`, `direction: "piutang"` | `−amount` |
| Buat **utang** (kita meminjam uang) | **+amount** (saldo naik) | 1 baris, `kind: "debt"`, `direction: "utang"` | `+amount` |
| Bayar / cicil **piutang** (uang masuk) | **+nominal bayar** | tetap baris yang sama (tidak nambah baris) | net naik |
| Bayar / cicil **utang** (uang keluar) | **−nominal bayar** | tetap baris yang sama (tidak nambah baris) | net turun |
| **Lunas tanpa bunga** | kembali ke posisi awal | baris **tetap ada**, status `paid` | **0** + `link` ke detail |
| **Lunas dengan bunga** (total bayar > pokok) | utang → **minus** / piutang → **plus** | baris tetap ada | minus/plus |

Rumus tunggal yang dipakai untuk **effek kantong** *dan* **nominal baris di list transaksi**:

```text
netEffect(debt) = sign × (amount − paidTotal)
dengan sign = +1 untuk utang, −1 untuk piutang
```

Contoh utang `amount = 5.000.000`:

| paidTotal | netEffect | Tampilan list transaksi |
|-----------|-----------|-------------------------|
| 0 (open) | +5.000.000 | `+Rp 5.000.000` |
| 2.000.000 (partial) | +3.000.000 | `+Rp 3.000.000` |
| 5.000.000 (paid) | 0 | `Rp 0` + link „Lihat detail” |
| 5.500.000 (paid, ada bunga) | **−500.000** | `−Rp 500.000` + link |

Contoh piutang `amount = 2.000.000`: open `−2.000.000` → partial `−1.000.000` → lunas `0`
→ lunas + bunga `+300.000`.

**Catatan penting:** satu debt = **satu baris agregat** di list transaksi (bukan 1 baris saat buat
+ banyak baris saat bayar). Ini yang bikin nominal bisa „jadi 0” saat lunas.
Tanggal baris memakai `mt_debts.date`; riwayat pembayaran tetap ada di detail debt
(`GET /money/debts/:id` → `payments[]`).

### 2.1 Saldo kantong tidak cukup → dibiarkan (keputusan)

Aplikasi ini **murni pencatatan** dan harus mengikuti realita, jadi piutang tetap **boleh**
dibuat walau saldo kantong < `amount` (saldo boleh jadi **minus**).

- BE **tidak** melempar `INSUFFICIENT_BALANCE` untuk pembuatan/ubah debt.
- Sebagai gantinya BE mengirim **flag peringatan** di response (lihat §6.1) supaya FE bisa
  memunculkan **pop-up notifikasi**: „Saldo kantong minus, mohon sesuaikan kantongnya.”
- Pop-up bersifat **informasi**, bukan blocker. User nanti membetulkan kantong lewat
  balancing/opening balance.

### 2.2 Bunga = kelebihan bayar (keputusan: cukup overpay)

Tidak perlu field bunga di `mt_debts`. Bunga dihitung dari kelebihan bayar:

```text
interestAmount = max(0, paidTotal − amount)
```

Contoh: utang `amount = 1.000.000`, dikembalikan `1.200.000` → `interestAmount = 200.000`
dan FE menampilkannya sebagai **„Bunga Rp 200.000”** (badge/label), bukan sebagai pokok.
Efeknya ke saldo kantong sudah otomatis: `netEffect = +1.000.000 − 1.200.000 = −200.000`.

---

## 3. Perubahan BE — data

### 3.1 Migration baru

`src/database/migrations/2026MMDDHHMMSS_alter_mt_debts_add_pocket_link.ts`

```ts
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable(Tables.MONEY_DEBTS, (table) => {
    table.integer('pocket_id').unsigned().nullable().after('person_id');
    table
      .foreign('pocket_id')
      .references(`${Tables.MONEY_POCKETS}.id`)
      .onDelete('SET NULL');
    table.index(['workspace_id', 'pocket_id'], 'mt_debts_workspace_pocket_idx');
  });
}
```

Batasan desain:

- **Nullable** → debt lama & debt yang belum di-link tetap valid (`pocket_id = NULL`) dan
  **tidak mengubah saldo** (perilaku lama). Jadi data existing aman.
- `ON DELETE SET NULL` → hapus pocket tidak menghapus catatan utang/piutang (data tetap ada).
- Tidak ada tabel/kolom transaksi ledger baru → **tidak menyentuh `mt_transactions`**.

### 3.2 `MoneyDebtRow` / `MoneyDebtDto`

```ts
// money.types.ts
export type MoneyDebtRow = { /* ...existing */ pocket_id: number | null };

export type MoneyDebtDto = {
  // ...existing
  pocketId: number | null;
  /** "Transaksi · BCA" — null kalau belum di-link */
  pocketLabel?: string | null;
  /** netEffect = sign × (amount − paidTotal). 0 = lunas tanpa bunga, bisa negatif (utang + bunga) */
  netEffect?: number;
  /** max(0, paidTotal − amount) → FE tampilkan sebagai "Bunga" (§2.2) */
  interestAmount?: number;
  /** Peringatan saldo kantong minus (bukan error) — FE pakai untuk pop-up notifikasi (§6.1) */
  balanceWarning?: MoneyDebtBalanceWarning | null;
};

export type MoneyDebtBalanceWarning = {
  /** Kantong jadi minus setelah debt ini di-link */
  isNegative: boolean;
  pocketId: number;
  pocketLabel: string;
  /** Saldo kantong setelah efek debt ini (boleh negatif) */
  pocketBalanceAfter: number;
  /** Kekurangan = max(0, amount − saldoSebelum) — 0 kalau saldo masih cukup */
  shortfall: number;
  message: string; // e.g. "Saldo kantong minus. Mohon sesuaikan kantongnya."
};
```

`MoneyDebtPaymentDto` tambah (opsional, buat riwayat di halaman detail):

```ts
/** Porsi pembayaran ini yang dihitung sebagai bunga (running, §2.2) */
interestAmount?: number;
```

Query tambahan (opsional, murah): `GET /money/debts?pocketId=`.
Tidak perlu endpoint baru `GET /money/pockets/:id/debts` — dari sisi kantong cukup pakai
`link` dari item activity (`/money/debts/:id`, §5.2/§12).

---

## 4. Perubahan BE — rumus saldo kantong

`computePocketBalance(pocketId)` di `money.balance.ts` ditambah komponen debt:

```text
balance = txn + transferIn − transferOut + cashIn − cashOut + debtEffect

debtEffect(P) = Σ debt yang pocket_id = P  →  sign × (amount − paidTotal)
                sign = +1 (utang) | −1 (piutang)
```

Implementasi 1 query tambahan (boleh digabung ke `Promise.all` yang sudah ada):

```sql
SELECT COALESCE(SUM(
  CASE d.direction WHEN 'utang' THEN 1 ELSE -1 END
  * (d.amount - COALESCE(p.paid, 0))
), 0) AS total
FROM mt_debts d
LEFT JOIN (
  SELECT debt_id, SUM(amount) AS paid
  FROM mt_debt_payments
  GROUP BY debt_id
) p ON p.debt_id = d.id
WHERE d.pocket_id = ?
```

Karena saldo selalu dihitung ulang (`computePocketBalances` dipakai pockets / dashboard /
balancing / cek saldo transfer & tarik tunai), **tidak ada baris ledger yang perlu di-rewrite**:
ubah `pocketId` / `amount` / `direction`, tambah pembayaran, atau hapus debt → efek saldo
otomatis ikut benar. Ini alasan utama pendekatan „derived” dipilih supaya tidak merusak sistem lama.

Update juga komentar doc-block di atas `computePocketBalance()` supaya rumus resminya tercatat.

---

## 5. Perubahan BE — `GET /money/activity`

### 5.1 Kind baru: `debt`

`MONEY_ACTIVITY_KINDS`/`ACTIVITY_KINDS` di `activity.service.ts` ditambah `'debt'`, dan
`MoneyActivityKind` di `money.types.ts` + FE `MoneyUiTx['kind']` ditambah `'debt'`.

Tambahkan 1 branch UNION baru (sejajar dengan branch `txn`/`xfer`/`cash`):

```sql
SELECT CONCAT('debt:', d.id)  AS feed_id,
       'debt'                 AS kind,
       d.counterparty_name    AS title,
       NULL                   AS category_id,
       d.pocket_id            AS pocket_id,
       NULL                   AS to_pocket_id,
       (CASE d.direction
          WHEN 'utang' THEN d.amount - COALESCE(p.paid, 0)
          ELSE COALESCE(p.paid, 0) - d.amount
        END)                  AS amount,          -- boleh 0 / negatif
       d.date                 AS date,
       d.id                   AS sort_id,
       d.direction            AS debt_direction,
       d.status               AS debt_status,
       d.amount               AS debt_amount,
       COALESCE(p.paid, 0)    AS debt_paid_total,
       d.id                   AS debt_id
FROM mt_debts d
INNER JOIN mt_pockets dp ON dp.id = d.pocket_id
LEFT JOIN (
  SELECT debt_id, SUM(amount) AS paid
  FROM mt_debt_payments
  GROUP BY debt_id
) p ON p.debt_id = d.id
WHERE d.workspace_id = ?
  AND d.pocket_id IS NOT NULL
```

Branch `txn`/`xfer`/`cash` yang sudah ada cukup ditambah kolom `NULL` untuk
`debt_direction`, `debt_status`, `debt_amount`, `debt_paid_total`, `debt_id` supaya jumlah kolom
UNION sama.

Filter yang berlaku untuk branch debt (samakan polanya dengan branch lain):

| Param | Perlakuan |
|-------|-----------|
| `from` / `to` | filter `d.date` |
| `pocketId` | `d.pocket_id = ?` |
| `personId` | `dp.owner_person_id = ?` (owner kantong, konsisten dengan branch lain) |
| `q` | `d.counterparty_name LIKE ?` |
| `categoryId` / `uncategorized` | debt **di-skip** (mengikuti perilaku transfer/cash) |
| `kind` | `'debt'` → hanya branch debt; `'all'` → ikutkan debt |

### 5.2 Field baru di item activity

```ts
export type MoneyActivityItemDto = {
  // ...existing (kind: MoneyActivityKind — sekarang termasuk 'debt')
  /** Hanya untuk kind='debt' */
  direction?: 'utang' | 'piutang' | null;
  status?: 'open' | 'partial' | 'paid' | null;
  /** Pokok catatan (mt_debts.amount) */
  principalAmount?: number | null;
  paidTotal?: number | null;
  /** max(0, principalAmount − paidTotal) */
  remaining?: number | null;
  /** signed net effect; 0 = lunas tanpa bunga; bisa negatif (utang + bunga) */
  netAmount?: number | null;
  /** max(0, paidTotal − principalAmount) → FE tampilkan badge "Bunga" */
  interestAmount?: number | null;
  /** untuk kind='debt' → `/money/debts/:id` (dipakai juga sebagai link di halaman kantong) */
  link: string;
};
```

Aturan nilai untuk `kind = 'debt'`:

- `amount` = `Math.abs(netEffect)` (biar konsisten: kind lain selalu positif).
- `signed` = `'pos'` kalau net > 0, `'neg'` kalau net < 0, `'neutral'` kalau net === 0.
- `netAmount` = net bertanda (0 / negatif) → FE tidak perlu hitung sendiri.
- `interestAmount` = `max(0, paidTotal − principalAmount)` → badge „Bunga” di FE (§2.2).
- `link` = `/money/debts/:id` (dipakai FE untuk baris di list transaksi **dan** link dari kantong).
- `title` = `counterpartyName` (boleh di-prefix `Piutang ` / `Utang ` sesuai `directionLabel`).
- `categoryName` = `'Piutang'` / `'Utang'`, `categoryId` = `null`.
- `pocketId` / `pocketLabel` = kantong yang di-link.

Contoh response untuk **utang lunas + bunga**:

```json
{
  "id": "debt:12",
  "kind": "debt",
  "title": "Pinjaman Budi",
  "categoryName": "Utang",
  "categoryId": null,
  "personId": 1,
  "personName": "Irfan",
  "pocketLabel": "Transaksi · BCA",
  "pocketId": 101,
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

### 5.3 Opt-out flag (jaring keamanan)

Tambah query param `includeDebts` (`true` default, boleh `false`) di
`GET /money/activity`. Kalau `false`, branch debt tidak dimasukkan sama sekali.
Ini pegangan kalau FE belum sempat handle `kind: "debt"` — cukup kirim
`?includeDebts=false` tanpa perlu rollback BE.

> Karena branch debt hanya muncul untuk debt yang **punya `pocket_id`**, deployment BE
> ini tidak mengubah response untuk data lama (semua `pocket_id = NULL`) sampai ada user
> meng-link debt ke kantong.

`GET /money/transactions` **tidak** berubah (debt bukan baris `mt_transactions`).
`GET /money/reports/monthly` dan `GET /money/dashboard` **tidak** berubah: debt bukan
income/expense, jadi tidak boleh menggelembungkan `summary.income`/`summary.expense`.

---

## 6. Perubahan BE — endpoint debts

### 6.1 `POST /money/debts`

Body tambahan (opsional, boleh `null`):

```json
{
  "personId": 1,
  "counterpartyName": "Budi",
  "direction": "utang",
  "amount": 5000000,
  "date": "2026-08-01",
  "dueDate": "2026-09-01",
  "note": "opsional",
  "pocketId": 101
}
```

Aturan:

- `pocketId` opsional. Kalau dikirim → wajib pocket milik workspace & **tidak archived**,
  kalau tidak → `404 MONEY_POCKET_NOT_FOUND` (reuse error code yang sudah ada).
- `pocketId: null` / tidak dikirim → debt tetap „off-ledger” (perilaku lama, saldo tidak berubah).
- **Tidak** menolak piutang walaupun saldo kantong < amount (keputusan §2.1: aplikasi pencatatan,
  ikut realita). Saldo kantong boleh minus.
- Balance tidak perlu di-update manual; dihitung ulang saat ada request (lihat §4).

Response tambahan saat kantong jadi minus (bukan error, HTTP tetap `201`):

```json
{
  "id": 12,
  "pocketId": 101,
  "pocketLabel": "Transaksi · BCA",
  "netEffect": -2000000,
  "interestAmount": 0,
  "balanceWarning": {
    "isNegative": true,
    "pocketId": 101,
    "pocketLabel": "Transaksi · BCA",
    "pocketBalanceAfter": -1500000,
    "shortfall": 500000,
    "message": "Saldo kantong minus Rp 1.500.000. Mohon sesuaikan kantongnya di menu Balancing."
  }
}
```

FE memakai `balanceWarning` → **pop-up notifikasi** (toast/modal info) yang mengarahkan user ke
halaman kantong/balancing. `balanceWarning` bernilai `null` kalau saldo masih cukup atau debt
tidak di-link ke kantong.

### 6.2 `PATCH /money/debts/:id`

- Boleh ubah `pocketId` (termasuk `null` untuk melepas link), `amount`, `direction`, `date`, dll.
- Efek saldo otomatis benar karena dihitung ulang — tidak ada ledger yang perlu di-rewrite.
- Status `open|partial|paid` tetap auto dari `paidTotal` (logic `debtStatusFromPaid` sudah ada).

### 6.3 `POST /money/debts/:id/payments`

- Perilaku lama: validasi `amount > remaining` → `422 VALIDATION_ERROR`.
- **Perlu dilonggarkan**: bayar **boleh melebihi** pokok (bunga/denda). `paidTotal` > `amount`
  valid → `netEffect` jadi negatif (utang) / positif (piutang), persis seperti yang diminta.
- `remaining` tetap `Math.max(0, amount − paidTotal)`.
- **Keputusan §2.2:** dilonggarkan **langsung** — tidak perlu flag `allowOverpay`.
  Response tambahkan `interestAmount = max(0, paidTotal − amount)` (dan per pembayaran:
  `interestAmount` = porsi bayar ini yang melewati sisa pokok, dihitung *running* dari
  pembayaran sebelumnya ke atas).
- Contoh running: pokok 1.000.000 → bayar 400.000 (`interestAmount` 0, sisa 600.000) →
  bayar 800.000 (`interestAmount` 200.000, sisa 0, status `paid`).
- `status` tetap auto: `open` → `partial` → `paid` (sekali `paid`, tidak turun walau ada overpay).

### 6.4 `DELETE /money/debts/:id`

Tidak berubah. Karena efek saldo derived, hapus debt = efek saldo otomatis hilang.
FE tetap tampilkan konfirmasi „Riwayat pembayaran juga ikut terhapus.”

---

## 7. Cascade & audit

### 7.1 Hapus pocket / account

`deletePocketsCascade()` (`money.cascade.ts`) ditambah 1 langkah **sebelum** pocket dihapus:

```ts
await trx(Tables.MONEY_DEBTS)
  .where({ workspace_id: workspaceId })
  .whereIn('pocket_id', pocketIds)
  .update({ pocket_id: null });
```

Tujuannya: catatan utang/piutang **tetap hidup** walau kantongnya dihapus (`pocket_id` jadi
`NULL` → kembali off-ledger). `deleteAccountCascade()` otomatis ikut karena delegasi.
`deletePocketsCascade` mematikan FK checks, jadi pastikan langkah ini eksplisit.

### 7.2 Audit log

- `POST /money/debts` / `PATCH` — sertakan `pocketId` di `before`/`after` snapshot supaya
  perubahan link kebaca di audit (`entityType: "debt"`, sudah ada).
- Pembayaran tetap pakai `AUDIT_ENTITY_TYPES.DEBT_PAYMENT` (`entityType: "debt_payment"`).

### 7.3 Seed (opsional, buat demo)

`03_money_track_data.ts` boleh di-update supaya sebagian debt seed punya `pocket_id`
biar fitur kelihatan di demo. Debt seed lama boleh dibiarkan `NULL`.

---

## 8. Yang TIDAK berubah (jaga kompatibilitas)

| Area | Dampak | Alasan |
|------|--------|--------|
| `mt_transactions`, `mt_transfers`, `mt_cash_withdrawals` | **tidak ada perubahan skema/isi** | efek debt dihitung derived, bukan ditulis ke ledger |
| `GET /money/reports/monthly` | income/expense/net/`byCategory`/`byPocket` tetap | debt bukan income/expense |
| `GET /money/dashboard` | `summary.income/expense/net` tetap | idem |
| `GET /money/transactions` | tidak berubah | debt bukan baris ledger |
| `GET /money/balancing` | `recordedBalance` ikut naik/turun karena `computePocketBalance` | memang diinginkan (saldo tercatat = saldo riil) |
| Transfer & tarik tunai | cek `INSUFFICIENT_BALANCE` otomatis pakai saldo baru | konsisten |
| Debt lama (`pocket_id = NULL`) | tidak muncul di activity, saldo tidak berubah | backward compatible |
| Archive pocket | `canArchive` butuh saldo 0 → debt open bikin pocket tidak bisa di-archive. Kalau perlu, lepaskan debt dulu | konsekuensi, bukan bug |

Catatan konsekuensi yang perlu disepakati (bukan blocker):

- Baris agregat debt di activity memakai tanggal **pembuatan** debt, jadi pembayaran di bulan
  lain tidak memunculkan baris baru di bulan itu. „Perubahan” nominal baris tetap kelihatan
  (net ikut turun) tapi tidak ada baris per tanggal bayar. Riwayat per pembayaran sudah
  tersedia di `GET /money/debts/:id`.
- Kalau nanti mau baris pembayaran muncul juga di list transaksi, itu jadi opsi
  (kind `'debt_payment'`) — **belum termasuk** request ini.

---

## 9. Rencana rilis & kompatibilitas FE

1. **BE** merge migration + balikan activity `kind: "debt"` (default `includeDebts=true`).
   Debt lama (`pocket_id = NULL`) → response belum berubah sama sekali.
2. **FE** merge mapping `kind: "debt"` sebelum user mulai me-link debt ke kantong.
3. Kalau FE belum siap, kirim `GET /money/activity?...&includeDebts=false` sebagai
   jaring aman (tanpa perlu rollback BE).

Urutan aman: deploy BE → deploy FE → baru link debt ke kantong.

---

## 10. Tugas FE setelah BE live

1. `src/modules/money-track/api/moneyApi.ts`
   - `MoneyActivityApi.kind` + `MoneyUiTx.kind` tambah `'debt'`.
   - `MoneyDebtApi` tambah `pocketId`, `pocketLabel`, `netEffect`, `interestAmount`,
     `balanceWarning`.
   - `mapActivityToUiTx()`: teruskan `direction`, `status`, `principalAmount`, `paidTotal`,
     `remaining`, `netAmount`, `interestAmount`, `link`.
   - `MoneyUiTx` tambah `link: string` + `status?`, `direction?`, `remaining?`,
     `interestAmount?`.
2. `TransactionsPage.tsx`
   - `KindFilter` tambah `'debt'`; chip filter „Utang/Piutang”.
   - `kindTone`/`kindLabel` untuk `'debt'` (2 warna: utang vs piutang, badge status
     `open/partial/paid`).
   - Nominal: tampilkan `0` saat lunas tanpa bunga, `−Rp x` saat `signed === 'neg'`
     (pakai `formatIdr` yang sudah handle minus).
   - Saat `kind === 'debt'`: **sembunyikan** tombol Edit/Hapus (bukan ledger row) dan
     ubah ikon audit jadi **link ke detail** (`/money/debts/:id`).
   - `totals.income/expense` jangan ikut menghitung debt (sudah aman karena filter per kind).
   - Tampilkan badge **„Bunga Rp x”** kalau `interestAmount > 0`.
3. `PocketHistorySheet.tsx` — `kind === 'debt'` tidak boleh masuk hitungan Masuk/Keluar
   (filter `income`/`expense` sudah aman), tapi tampilkan baris dengan badge
   „Utang/Piutang” + **link yang bisa diklik** ke `/money/debts/:id` (pakai `link` dari BE,
   tidak perlu endpoint baru).
4. `DebtsPage.tsx` / `DebtDetailPage.tsx` — tampilkan kantong yang di-link + `netEffect`,
   dan baris **Bunga** di ringkasan + riwayat pembayaran kalau `interestAmount > 0`.
5. `CrudModals.tsx` (modal debt) — tambah select **Kantong** (`fetchMoneyPockets()`),
   opsional/kosong = „Tanpa kantong (catatan saja)”; helper text efek saldo.
   Setelah simpan, kalau response punya `balanceWarning` → buka **pop-up notifikasi**
   (info, bukan error) dengan tombol „Atur kantong” → `/money/pockets`.
6. `DebtDetailPage` — tombol „Catat pembayaran” biarkan nilai > sisa (bunga) setelah BE
   melonggarkan validasi (§6.3), dan tampilkan „Bunga Rp x” pada pembayaran yang overpay.

---

## 11. Acceptance criteria

- [ ] Buat piutang dengan `pocketId` → `GET /money/pockets` saldo kantong **turun** sebesar amount.
- [ ] Buat utang dengan `pocketId` → saldo kantong **naik** sebesar amount.
- [ ] Baris debt muncul di `GET /money/activity` dengan `kind: "debt"`, `direction`, `status`,
      `signed`, dan `link: "/money/debts/:id"`.
- [ ] Setelah lunas tanpa bunga → baris **tetap ada**, `amount = 0`, `signed: "neutral"`,
      `link` menunjuk detail.
- [ ] Bayar melebihi pokok (bunga) → baris **tetap ada**, `netAmount` negatif (utang) /
      positif (piutang), saldo kantong ikut menyesuaikan.
- [ ] Utang 1.000.000 dibayar 1.200.000 → `interestAmount = 200000`, `remaining = 0`,
      `status = "paid"`, dan selalu **HTTP 2xx** (tidak lagi `422` karena overpay).
- [ ] Piutang dengan saldo kantong tidak cukup → **tetap sukses** (2xx) dan response berisi
      `balanceWarning.isNegative = true` + `pocketBalanceAfter` negatif + `message`.
- [ ] `balanceWarning` = `null` kalau saldo cukup / debt tidak pakai kantong.
- [ ] Item activity `kind: "debt"` punya `link` yang bisa dipakai FE untuk klik ke
      `/money/debts/:id` (baik dari halaman transaksi maupun dari kantong).
- [ ] `PATCH` ganti `pocketId` / `amount` / `direction` → saldo & baris activity ikut benar
      tanpa ledger rusak.
- [ ] Hapus pocket ber-link debt → debt tetap ada dengan `pocket_id = null`, saldo & activity bersih.
- [ ] `GET /money/reports/monthly` & `/money/dashboard`: `income`/`expense` **tidak**
      terpengaruh debt.
- [ ] Debt lama (`pocket_id = null`) → response activity & saldo **sama seperti sebelum rilis**.
- [ ] `includeDebts=false` → response activity identik dengan sebelum fitur.

---

## 12. Keputusan (sudah final — jangan diubah tanpa konfirmasi)

| # | Pertanyaan | Keputusan |
|---|-----------|-----------|
| 1 | Piutang dengan saldo kantong tidak cukup | **Dibiarkan** (tidak diblokir). Aplikasi murni pencatatan → saldo boleh minus. FE memunculkan **pop-up notifikasi** dari `balanceWarning` supaya user membetulkan kantongnya (§2.1, §6.1). |
| 2 | Presisi bunga | **Cukup overpay.** Tanpa field bunga baru di `mt_debts`. Utang 1.000.000 dikembalikan 1.200.000 → selisih **200.000** dihitung `interestAmount = max(0, paidTotal − amount)` dan FE menampilkannya sebagai **„Bunga”** (§2.2, §6.3). |
| 3 | Endpoint daftar debt per kantong | **Tidak perlu endpoint baru.** Halaman detail debt sudah ada (`/money/debts/:id`) → item activity `kind: "debt"` cukup mengirim `link` supaya dari kantong user bisa klik ke detail (§5.2, §10.3). `GET /money/debts?pocketId=` hanya opsional/murah, bukan syarat. |
