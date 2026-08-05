# Prompt BE — Flag `hasSampleData` untuk Hapus Data Contoh (Money Track)

Lempar prompt ini ke AI BE.

---

## Konteks

FE Money Track punya tombol **Hapus Data Contoh** (panggil `POST /money/workspace/reset` mode wipe).  
Tombol itu harus:

1. Muncul **hanya sekali** selama workspace masih berisi seed/data contoh.
2. **Hilang permanen** setelah wipe sukses — meskipun user sudah input data real.
3. Konsisten **lintas device / browser** (bukan mengandalkan localStorage FE).

Saat ini FE masih fallback ke localStorage. Butuh flag dari BE.

---

## Request

### 1. Tambah field di `GET /money/setup`

```json
{
  "isConfigured": true,
  "mode": "couple",
  "persons": [],
  "coupleLinkedAt": null,
  "needsOpeningBalances": false,
  "hasSampleData": true
}
```

| Field | Type | Arti |
|-------|------|------|
| `hasSampleData` | `boolean` | `true` = masih ada seed/data contoh di workspace ini → FE tampilkan tombol Hapus Data Contoh. `false` = sudah di-wipe / workspace real → tombol disembunyikan. |

### 2. Persistensi flag (penting)

Jangan infer `hasSampleData` hanya dari “apakah ada transaksi”.  
Setelah user wipe lalu isi data real, data tetap ada — flag harus tetap `false`.

Usulan implementasi:

- Simpan di workspace/settings, mis. `MoneyWorkspace.sampleDataClearedAt` atau `hasSampleData`.
- Saat **seeder demo** pertama kali dijalankan untuk workspace → `hasSampleData = true`.
- Saat `POST /money/workspace/reset` dengan `mode: "wipe"` sukses → set **`hasSampleData = false`** (permanen untuk workspace itu).
- `mode: "reseed"` (jika masih dipakai) → boleh set kembali `hasSampleData = true`.

### 3. Response wipe (opsional tapi helpful)

`POST /money/workspace/reset` response boleh include:

```json
{
  "mode": "wipe",
  "keepSetup": true,
  "hasSampleData": false,
  "deleted": { "transactions": 12, "pockets": 0, "accounts": 0 }
}
```

### 4. Auth

Sama seperti route `/money/*`: JWT + `X-Module-Unlock`.

---

## Acceptance criteria

- [ ] `GET /money/setup` selalu mengembalikan `hasSampleData` (boolean).
- [ ] Setelah wipe sukses, `hasSampleData` = `false` di setup.
- [ ] Login ulang / device lain: tombol FE tidak muncul lagi jika `hasSampleData` false.
- [ ] User yang sudah isi data real setelah wipe: flag tetap `false`.
- [ ] Workspace baru yang di-seed demo: `hasSampleData` = `true`.

---

## FE (sudah siap)

FE sudah membaca `setup.hasSampleData`:

- `true` → tampilkan tombol Hapus Data Contoh  
- `false` → sembunyikan  
- field belum ada → fallback localStorage sementara  

Related kontrak: `docs/requests/to-be/MONEY-TRACK-API.md` §3.1 Setup.
