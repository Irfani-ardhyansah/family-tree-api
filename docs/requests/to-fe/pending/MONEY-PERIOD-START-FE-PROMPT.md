# Jadwal Reset / Gajian Money Track — integrasi FE

> BE sudah live. Default tetap **tanggal 1**, jadi tidak ada perubahan perilaku
> untuk workspace yang belum mengatur apa pun.

## Kenapa

Selama ini periode Money Track = bulan kalender (1–akhir bulan). Banyak keluarga
gajian di akhir bulan (tanggal 30/31, atau hari kerja terakhir kalau 30/31
Sabtu/Minggu/libur). Sekarang periode bisa diatur supaya dashboard, laporan
bulanan, budget, dan reminder memakai rentang gajian yang sama.

Ini **bukan** fitur hapus data. `POST /money/workspace/reset` tetap untuk wipe
workspace.

## Perubahan response

### `GET /money/preferences` / `PUT /money/preferences`

Ada objek baru `period`:

```json
{
  "defaultTxType": "expense",
  "quickAmounts": [10000, 20000, 50000, 100000, 200000],
  "shared": { "...": "..." },
  "persons": {},
  "period": {
    "startMode": "fixed_day",
    "startDay": 1,
    "weekendAdjust": "none",
    "holidays": [],
    "current": {
      "yearMonth": "2026-11",
      "label": "November 2026",
      "from": "2026-11-01",
      "to": "2026-11-30"
    }
  }
}
```

| Field | Tipe | Arti |
|---|---|---|
| `period.startMode` | `"fixed_day"` \| `"last_day"` \| `"last_workday"` | Aturan tanggal mulai periode |
| `period.startDay` | `number` 1–31 | Dipakai hanya saat `startMode = "fixed_day"`. Kalau bulan lebih pendek, otomatis di-clamp ke hari terakhir. |
| `period.weekendAdjust` | `"none"` \| `"previous_workday"` \| `"next_workday"` | Kalau tanggal mulai jatuh Sabtu/Minggu, geser mundur atau maju ke hari kerja |
| `period.holidays` | `string[]` (`YYYY-MM-DD`) | Libur manual yang ikut dilewati saat mencari hari kerja. Opsional. |
| `period.current` | object | Periode yang sedang berjalan; **pakai `from`/`to` ini untuk tampilan** |

`period.current.yearMonth` = key periode (bulan tempat periode **mulai**), bukan
selalu bulan kalender berjalan.

### `GET /money/dashboard`

`period` sekarang punya `from` & `to`:

```json
{
  "period": {
    "yearMonth": "2026-10",
    "label": "Oktober 2026",
    "from": "2026-10-30",
    "to": "2026-11-29"
  }
}
```

Kalau query `?period=` tidak dikirim, BE memilih periode berjalan sesuai setting.
Kalau dikirim, nilainya adalah `yearMonth` (key periode), bukan tanggal.

### `GET /money/reports/monthly?yearMonth=`

- `period.from` / `period.to` mengikuti setting.
- `previousPeriod` sekarang juga punya `from` / `to`.
- `daily[]` berisi tanggal dari `period.from` sampai `period.to`.

### `GET /money/budgets?yearMonth=` & `PUT /money/budgets`

- `yearMonth` tetap key periode.
- `spentAmount` dihitung dari `period.from`–`period.to` (bukan 1–akhir bulan).
- FE sebaiknya memakai `dashboard.period.yearMonth` / `preferences.period.current.yearMonth`
  saat membuka halaman budget.

### `GET /money/reminders`

Reminder budget otomatis memakai periode berjalan sesuai setting.

### `GET /money/activity`, `GET /money/transactions`

Filter `from`/`to` tetap tanggal eksplisit. Untuk menampilkan satu periode,
kirim `period.from` & `period.to` dari dashboard/preferences.

## Contoh `PUT /money/preferences`

Gajian di hari kerja terakhir bulan (otomatis mundur kalau 30/31 weekend):

```json
{
  "defaultTxType": "expense",
  "quickAmounts": [10000, 20000, 50000, 100000, 200000],
  "shared": { "...": "..." },
  "persons": {},
  "period": {
    "startMode": "last_workday",
    "startDay": 1,
    "weekendAdjust": "none",
    "holidays": []
  }
}
```

Gajian tanggal 30/31, tapi kalau jatuh Sabtu/Minggu mundur ke hari kerja
sebelumnya:

```json
{
  "period": {
    "startMode": "fixed_day",
    "startDay": 30,
    "weekendAdjust": "previous_workday",
    "holidays": ["2026-12-31"]
  }
}
```

Catatan:
- `startDay` tetap dikirim walau `startMode` bukan `fixed_day` (diabaikan).
- Kalau `period` **tidak** dikirim, BE mempertahankan setting yang sudah ada.
  Kirim `period: {}` kalau memang mau reset ke default tanggal 1.
- `holidays` maksimal 366 tanggal; format harus `YYYY-MM-DD` dan tanggal valid.
- `last_workday` menghitung Senin–Jumat + `holidays`. Tanggal merah yang tidak
  dimasukkan ke `holidays` tetap dianggap hari kerja.

## Saran UI (halaman Pengaturan Money)

1. Tambah section **“Periode / Jadwal Gajian”**.
2. Radio/segmented:
   - `Tanggal 1 (default)` → `fixed_day`, `startDay: 1`
   - `Tanggal tertentu` → `fixed_day`, input angka 1–31
   - `Hari terakhir bulan` → `last_day`
   - `Hari kerja terakhir` → `last_workday`
3. Kalau `fixed_day`: select **“Kalau jatuh Sabtu/Minggu”**:
   - `Tetap` → `none`
   - `Mundur ke hari kerja sebelumnya` → `previous_workday`
   - `Maju ke hari kerja berikutnya` → `next_workday`
4. Kalau `last_workday` atau `weekendAdjust` aktif: tampilkan daftar **Tanggal
   libur** (opsional, multi-date). Ini untuk tanggal merah yang bukan Sabtu/Minggu.
5. Tampilkan preview dari `period.current`:
   `Periode berjalan: 30 Okt 2026 – 29 Nov 2026`.
6. Di dashboard/laporan, tampilkan rentang `from`–`to`, jangan cuma nama bulan.
   Contoh label: `Oktober 2026 · 30 Okt–29 Nov`.
7. Di halaman budget, kirim `yearMonth` dari periode berjalan, bukan
   `new Date().toISOString().slice(0, 7)` (itu bulan kalender).
8. Kalau user memilih tanggal 1 + `none`, perilaku sama persis seperti sekarang.

## Urutan aman

1. Deploy BE (migration otomatis).
2. FE baca `period.current`; belum perlu ubah apa pun kalau belum mau menampilkan
   setting — default tetap tanggal 1.
3. Setelah section Pengaturan siap, user bisa mengubah jadwal gajian.
