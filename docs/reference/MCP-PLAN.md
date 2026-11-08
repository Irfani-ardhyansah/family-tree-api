# Rencana MCP Server — FamilyRoots

Status: **token MCP BE implemented (belum deploy); MCP server belum diimplementasikan** · Tanggal: 2026-11-08

Dokumen ini rencana kebutuhan MCP (Model Context Protocol) untuk aplikasi FamilyRoots.
Token MCP per person sudah diimplementasikan di BE pada 2026-11-07. Yang belum:
service `family-mcp` dan tool-toolnya. Tutorial operasional pasca-deploy ada di
[`MCP-NOURIDE-SETUP.md`](./MCP-NOURIDE-SETUP.md). Fokus:

- **Family Roots**: read-only. Cukup untuk tanya “anak si X ada berapa/siapa saja”,
  “orang tua si Y siapa”, “kapan lahir/meninggal”, detail person, dan relasi dasar.
- **Money Track**: lengkap. Baca semua data keuangan + catat/ubah/hapus transaksi,
  transfer, tarik tunai, utang/piutang, budget, wishlist, saldo awal, balancing, dll.

---

## 1. Ringkasan keputusan

| Topik | Rekomendasi |
|---|---|
| Bentuk | Satu MCP server, dua grup tool: `family_*` dan `money_*` |
| Family | Read-only, tanpa tool create/update/delete person |
| Money | Read + write lengkap, destructive tool pakai konfirmasi |
| Integrasi | Lewat REST API yang sudah ada, **bukan** akses DB langsung |
| Auth | PAT per person `frmcp_...`; Nouride menyimpan token per agent |
| Multi-user | 1 orang = 1 agent Nouride = 1 token; API tidak menyimpan `discord_id` |
| Transport | `streamable HTTP` untuk Nouride/STB; `stdio` opsional untuk client lokal |
| Packaging | Service terpisah `family-mcp`, bukan menambah route ke API |
| Default write | Read selalu aktif; write bisa dimatikan lewat env |
| Tool destruktif | Default nonaktif / wajib `confirm` eksplisit |

### 1.1 Keputusan final 2026-11-08

- Chat gateway/agent: **Nouride** (pengganti Hermes Agent), sudah terpasang di STB.
- 1 orang = 1 agent Nouride. Tiap agent punya token MCP sendiri.
- `family-mcp` adalah MCP server terpisah; Nouride adalah MCP client.
- Token MCP bersifat **pass-through**: Nouride mengirim
  `Authorization: Bearer frmcp_...` ke `family-mcp`, lalu `family-mcp` meneruskan
  header yang sama ke FamilyRoots API. `family-mcp` tidak menyimpan token.
- API hanya tahu token → person/family/modules. Tidak ada `discord_id`, link code,
  atau secondary password di API/bot.
- FE hanya mengelola token; tidak mengelola agent Nouride.

Alasan utama memakai REST API yang ada:

1. Semua aturan bisnis (saldo, validasi kategori, audit log, unlock modul) sudah ada di API.
2. Tidak ada duplikasi logika saldo/utang yang rawan beda hasil.
3. Semua perubahan tetap tercatat di `mt_audit_logs` dengan aktor yang benar.
4. MCP server tidak perlu kredensial DB dan tidak bisa merusak data di luar aturan API.

---

## 2. Tujuan dan non-tujuan

### Tujuan

- Menjawab pertanyaan keluarga dengan cepat dan akurat, misalnya:
  - “Anak Pak Budi ada berapa? Siapa saja?”
  - “Siapa orang tua Siti?”
  - “Kapan nenek meninggal?”
  - “Berapa umur si A sekarang?”
  - “Siapa saja saudara kandung si B?”
- Mencatat keuangan lengkap, misalnya:
  - “Catat pengeluaran 50 ribu dari kantong Transaksi buat makan siang.”
  - “Gajian 10 juta masuk BCA.”
  - “Pindahkan 1 juta dari BCA ke Tunai.”
  - “Catat utang ke Budi 500 ribu, jatuh tempo bulan depan.”
  - “Budi bayar utang 200 ribu.”
  - “Bulan ini habis berapa?”
  - “Buat budget Makan 2 juta bulan ini.”
  - “Tambah wishlist vacuum cleaner 2,5 juta.”
- Membaca laporan, saldo, riwayat, audit, dan reminder.

### Non-tujuan (v1)

- Menulis/mengubah data family roots (create/update/delete person).
- Modul admin, auth management, household, task board, portfolio analytics.
- Upload file/media dari MCP (attachment hanya bisa memakai `mediaId` yang sudah ada).
- Akses SQL langsung atau query bebas ke database.
- Multi-currency. Semua nominal **integer rupiah**.
- Sinkronisasi spreadsheet / open banking.

---

## 3. Temuan dari codebase

### 3.1 Endpoint yang relevan

| Area | Endpoint | Keterangan |
|---|---|---|
| Auth | `POST /api/v1/auth/login` | Body `{ code, remember? }` |
| Auth | `POST /api/v1/auth/refresh` | Body `{ refreshToken }`; token lama dirotasi |
| Auth | `POST /api/v1/auth/secondary-password/verify` | Body `{ password }` → `unlockToken` |
| Auth | `GET /api/v1/auth/me` | Profil, module status, secondary password status; validasi token MCP |
| Auth | `GET/POST/DELETE /api/v1/auth/mcp-tokens` | Token MCP self-service; token asli hanya sekali |
| Auth | `GET /api/v1/admin/mcp-tokens`, `POST /api/v1/admin/mcp-tokens/:id/revoke` | Admin list/revoke |
| Family | `GET /api/v1/persons?scope=family&limit=100&page=N` | Semua person aktif di family |
| Family | `GET /api/v1/persons/:id` | Detail person |
| Family | `GET /api/v1/persons?view=tree&...` | Graph lengkap + filter subgraph |
| Money | `GET /api/v1/money/setup` | Workspace, person, mode, sample data |
| Money | `GET /api/v1/money/dashboard` | Ringkasan periode + saldo per person |
| Money | `GET /api/v1/money/reports/monthly` | Laporan bulanan lengkap |
| Money | `GET/POST/PATCH/DELETE /api/v1/money/accounts` | Account bank/ewallet/cash |
| Money | `GET/POST/PATCH/DELETE /api/v1/money/pockets` | Pocket + saldo computed |
| Money | `POST /api/v1/money/pockets/:id/archive` dan `/unarchive` | Archive |
| Money | `GET/POST/PATCH/DELETE /api/v1/money/categories` | Kategori income/expense |
| Money | `GET /api/v1/money/preferences`, `PUT /api/v1/money/preferences` | Default pocket/kategori |
| Money | `GET/POST/PATCH/DELETE /api/v1/money/transactions` | Transaksi |
| Money | `GET /api/v1/money/activity` | Feed gabungan txn/transfer/cash/debt |
| Money | `POST /api/v1/money/transfers`, `GET/PATCH/DELETE /transfers/:id` | Transfer |
| Money | `GET/POST /api/v1/money/cash-withdrawals`, `GET/PATCH/DELETE /cash-withdrawals/:id` | Tarik tunai |
| Money | `POST /api/v1/money/opening-balances` | Saldo awal batch |
| Money | `GET /api/v1/money/balancing`, `POST /balancing/check`, `POST /balancing/adjust` | Balancing |
| Money | `GET/POST/PATCH/DELETE /api/v1/money/wishlist` | Wishlist |
| Money | `GET/POST/PATCH/DELETE /api/v1/money/debts`, `POST /debts/:id/payments` | Utang/piutang + pembayaran |
| Money | `GET /api/v1/money/budgets`, `PUT /api/v1/money/budgets` | Budget per kategori |
| Money | `GET /api/v1/money/audit-logs`, `GET /audit-logs/:id` | Audit |
| Money | `GET /api/v1/money/reminders` | Reminder in-app |

### 3.2 Batasan penting

1. **Route `/money/*` untuk sesi JWT butuh dua header**:
   - `Authorization: Bearer <accessToken>`
   - `X-Module-Unlock: <unlockToken>`
   Token MCP yang dibuat dengan modul `money` boleh tanpa `X-Module-Unlock`.
2. `unlockToken` hanya berlaku **15 menit** (`SECONDARY_UNLOCK_TTL`, default 900 detik).
   Access token JWT default **1 jam**. Token MCP tidak punya expiry default; berlaku
   sampai dicabut user/admin.
3. Nominal uang adalah **integer rupiah**, tanpa desimal. Tanggal `YYYY-MM-DD`.
   Tahun-bulan laporan `YYYY-MM`.
4. **Tidak ada endpoint khusus anak/saudara.** Relasi dihitung dari graph person:
   `fatherId`, `motherId`, `spouseIds`. Untuk family <100 orang, cukup ambil semua
   person lewat `scope=family` lalu hitung di MCP.
5. **Tidak ada `GET /money/transfers` (list).** Detail transfer ada di
   `GET /money/transfers/:id`; daftar transfer bisa diambil dari
   `GET /money/activity?kind=transfer` (field lebih ringkas).
6. **Saldo hanya di level pocket.** Saldo account = jumlah saldo pocket di bawah account
   tersebut. API tidak mengirim saldo account langsung.
7. API memakai envelope `{ "data": ... }`; error `{ "data": null, "error": { code, message } }`.
8. `GET /persons` mode list maksimal `limit=100`. Family lebih besar perlu pagination.
9. `GET /persons` mengembalikan phone/address. Ini PII; MCP sebaiknya tidak mengirim
   ke LLM kecuali diminta eksplisit (`includeContact=true`).
10. `POST /money/workspace/reset`, `POST /money/setup/persons`, dan couple link/unlink
    adalah operasi setup/destruktif. Jangan diekspos sebagai tool default.

---

## 4. Arsitektur yang diusulkan

```
┌─────────────────┐      MCP        ┌──────────────────┐      HTTP internal   ┌─────────────────┐
│ Nouride agent   │ ◄────────────► │ family-mcp        │ ◄──────────────────► │ FamilyRoots API │
│ (MCP client)    │ streamable HTTP │ (MCP server)      │  Bearer frmcp_...    │ (Express)       │
└─────────────────┘                 └──────────────────┘                      └────────┬────────┘
                                                                                       │
                                                                                       ▼
                                                                                  MySQL
```

Komponen MCP server:

1. **Transport layer** — Streamable HTTP (utama untuk Nouride). `stdio` opsional.
2. **Auth pass-through** — ambil `Authorization: Bearer frmcp_...` dari request MCP,
   teruskan ke API. Tidak ada login/refresh/secondary password di MCP server.
3. **API client** — wrapper typed untuk endpoint family dan money; token per request.
4. **Context cache** — cache pendek (mis. 30 detik) per person/family, bukan global.
5. **Name resolver** — ubah “Transaksi”, “BCA”, “Makan”, “Budi” menjadi ID yang valid.
6. **Relation engine** — hitung anak, orang tua, saudara, cucu, mertua dari graph person.
7. **Tool layer** — schema zod + deskripsi + annotation + guardrail.
8. **Formatter** — output ringkas untuk LLM (JSON terstruktur + ringkasan teks).

### Pilihan packaging

| Opsi | Kelebihan | Kekurangan | Putusan |
|---|---|---|---|
| A. MCP akses DB langsung | Cepat | Duplikasi logika saldo/audit, rawan bypass aturan | ❌ |
| B. MCP service terpisah, panggil REST API | Aman, audit tetap, deployment terpisah | Perlu token pass-through, sedikit overhead HTTP | ✅ rekomendasi |
| C. MCP jadi route di API (`/api/v1/mcp`) | Satu container | Transport MCP bercampur Express, auth ganda, deploy API ikut berubah | ⏳ nanti jika perlu |

Rekomendasi: **B**. Buat repo/service terpisah `family-mcp` dengan `package.json`
sendiri, image arm64, dan join network Docker Compose yang sudah ada. API tidak
perlu diubah lagi untuk MVP; token MCP sudah tersedia.

---

## 5. Auth dan keamanan

### 5.1 Alur token (final)

1. User login ke aplikasi FamilyRoots (JWT sesi).
2. User membuat token MCP di **Pengaturan → Token MCP**.
   - FE memanggil `POST /auth/mcp-tokens` dengan `label` dan `modules`.
   - Kalau memilih modul sensitif, FE meminta secondary password dan mengirim
     `X-Module-Unlock` saat membuat token.
3. API mengembalikan token `frmcp_...` **sekali**. API menyimpan SHA-256 hash,
   hint, dan `unlock_modules`.
4. User menempelkan token ke agent Nouride. Nouride menyimpannya di secret store
   terenkripsi (AES-256-GCM), bukan di `mcp.toml`.
5. Setiap request MCP:
   - Nouride mengirim `Authorization: Bearer frmcp_...` ke `family-mcp`.
   - `family-mcp` meneruskan header yang sama ke FamilyRoots API.
   - API memverifikasi hash token → `person_id`, `family_id`, `unlock_modules`.
6. Kalau token dicabut/kedaluwarsa/tidak valid, API mengembalikan 401
   `MCP_TOKEN_INVALID`. Nouride menandai agent gagal; user membuat token baru.
7. Tidak ada refresh token, login code, atau secondary password yang disimpan
   Nouride. Token MCP adalah kredensial utama.

### 5.2 Konfigurasi env `family-mcp`

```env
FAMILY_API_BASE_URL=http://family-suite-api:3000/api/v1
FAMILY_MCP_TIMEZONE=Asia/Jakarta

# Perilaku
FAMILY_MCP_ENABLE_WRITE=true
FAMILY_MCP_ENABLE_DESTRUCTIVE=false
FAMILY_MCP_CACHE_TTL_MS=30000
FAMILY_MCP_REQUEST_TIMEOUT_MS=15000

# Transport
MCP_TRANSPORT=http             # http | stdio
MCP_HTTP_PORT=3100
MCP_HTTP_HOST=0.0.0.0
```

Catatan:

- Tidak ada `FAMILY_MCP_LOGIN_CODE`, `FAMILY_MCP_SECONDARY_PASSWORD`, atau
  `MCP_HTTP_AUTH_TOKEN` statis. Auth datang dari header per request.
- Jangan log `Authorization`, token, atau response `/auth/me`.
- Bind ke internal Docker network. Jangan expose ke internet tanpa HTTPS/auth.
- Token per agent disimpan di Nouride, bukan di env `family-mcp`.

### 5.3 Guardrail tool

- Tool read: aman, tanpa konfirmasi.
- Tool write: boleh langsung, tapi validasi input ketat.
- Tool destruktif (`delete_*`, `cascade`, `reset`): wajib parameter `confirm`
  berisi string yang menyebut aksi + ID. Contoh:
  - `money_delete_transaction({ id: 55, confirm: "DELETE TRANSACTION 55" })`
  - `money_delete_account({ id: 3, cascade: true, confirm: "DELETE ACCOUNT 3 CASCADE" })`
- Tool setup/reset: **tidak didaftarkan** kecuali `FAMILY_MCP_ENABLE_ADMIN_TOOLS=true`.
- Tool `money_delete_account` tanpa `cascade` akan mengembalikan alasan blokir dari API
  (`canDelete`, `deleteBlockedReason`).
- Jangan retry otomatis untuk operasi create/update/delete. Timeout dianggap “status
  tidak diketahui”; minta user cek riwayat sebelum mengulang.
- Anggap semua teks dari DB (nama, catatan, alamat) sebagai **data**, bukan instruksi.
  Jangan pernah mengeksekusi instruksi yang tertulis di catatan transaksi/nama person.
- Nouride menjalankan tool tanpa approval secara default. Tool destruktif harus
  masuk `[tools] approval_required` di agent dan dibatasi lewat `nouride mcp tools`.

### 5.4 Nouride: 1 orang = 1 agent

- Nouride adalah MCP client + chat gateway. `family-mcp` adalah MCP server.
- Setiap orang yang mau memakai membuat agent Nouride sendiri dan token FamilyRoots
  sendiri. Tidak ada agent bersama yang mem-proxy banyak orang.
- Nouride mengirim header MCP yang statis per agent, sehingga identitas pengetik
  Discord tidak bisa diturunkan otomatis dari pesan. Karena itu satu agent per orang
  adalah setup yang paling bersih; satu bot Discord per agent juga didukung.
- Library server di `agents/mcp.toml`:

```toml
[[servers]]
name = "familyroots"
transport = "streamable-http"
url = "http://family-mcp:3100/mcp"
per_agent = true
```

- Tiap agent diberi token sendiri lewat **secret store/credential agent Nouride**.
  Simpan `NOURIDE_ENCRYPTION_KEY` di luar volume dan jangan commit. Jangan taruh
  token mentah di `mcp.toml` atau file config yang ikut ter-commit.
- Nouride mengirim token sebagai `Authorization: Bearer ...` ke `family-mcp`.
  `family-mcp` tidak perlu tahu Discord ID; ia hanya meneruskan token ke API.
- Batasi tool per agent:

```bash
nouride mcp tools familyroots --agent <agent-id> \
  --only family_search_people,family_get_person,money_get_dashboard
```

- Tool destruktif masuk `approval_required` di agent:

```toml
[tools]
approval_required = [
  "familyroots__money_delete_transaction",
  "familyroots__money_delete_account",
]
```

- Token user A tidak bisa dipakai agent user B karena masing-masing punya secret
  sendiri. Kalau admin mencabut token, agent itu langsung gagal.
- Tidak ada tabel `core_mcp_links`, `core_mcp_link_codes`, atau `discord_id` di API.
  Mapping identitas Discord → agent/token sepenuhnya milik Nouride.

### 5.5 Status implementasi token MCP (2026-11-07)

Yang sudah dibangun di BE adalah **PAT self-service**:

- `GET/POST/DELETE /auth/mcp-tokens` — user membuat/melihat/menghapus token sendiri.
- `GET /admin/mcp-tokens` + `POST /admin/mcp-tokens/:id/revoke` — admin mencabut paksa.
- Token prefix `frmcp_`, disimpan sebagai SHA-256 hash; token asli hanya muncul sekali.
- `unlock_modules` opsional (`money`, `core`, `household`). Token dengan modul tersebut
  boleh melewati `X-Module-Unlock`; modul `admin` tidak diizinkan.
- Maksimal 5 token aktif per person. Satu token per agent/device.
- Endpoint kelola token, seluruh endpoint admin, dan endpoint keamanan/device
  (WebAuthn, secondary password, logout, `PATCH /auth/me/options`, push subscription)
  hanya menerima JWT sesi aplikasi, bukan token MCP. Token MCP hanya untuk endpoint
  data dan `GET /auth/me`.
- Mapping `discord_id → person_id + token` disimpan di Nouride, bukan di API. API
  hanya tahu token → person.

---

## 6. Desain tool

### 6.1 Tipe referensi yang dipakai berulang

Tool menerima **ID atau nama**. Resolver mengubah nama menjadi ID.

```ts
type PersonRef   = { personId?: number; personName?: string };
type AccountRef  = { accountId?: number; accountName?: string; person?: PersonRef };
type PocketRef   = { pocketId?: number; pocketName?: string; account?: AccountRef };
type CategoryRef = { categoryId?: number; categoryName?: string; type?: 'income' | 'expense' };
type DebtRef     = { debtId?: number; counterpartyName?: string; direction?: 'utang' | 'piutang' };
```

Aturan resolusi:

1. Jika `*Id` diisi, pakai ID dan validasi ada di workspace.
2. Jika hanya nama, cocokkan exact case-insensitive, lalu normalized/contains.
3. Jika hasil >1, **jangan menebak**. Kembalikan `ambiguous: true` + kandidat lengkap
   (id, nama, account/person context) supaya LLM bisa bertanya ke user.
4. Jika hasil 0, kembalikan error + saran tool list yang relevan.
5. Pocket ditampilkan dengan label kontekstual, mis. `"BCA · Transaksi"`, agar tidak
   tertukar dengan pocket “Transaksi” di account lain.
6. Untuk create transaction, jika pocket tidak diisi, pakai default dari
   `money/preferences` (`expensePocketId` / `incomePocketId`) untuk person terkait.
   Jika tetap ambigu, minta user memilih.

### 6.2 Tool Family Roots (read-only)

> Tidak ada tool `family_create_*`, `family_update_*`, atau `family_delete_*`.

| Tool | Fase | Endpoint / sumber | Output |
|---|---|---|---|
| `family_search_people` | P0 | `GET /persons?scope=family&q=` + filter lokal | `count`, daftar ringkas: id, nama, nickname, gender, birthDate, deathDate, status, umur |
| `family_get_person` | P0 | `GET /persons/:id` + graph family | Detail lengkap + relasi langsung (orang tua, pasangan, anak, saudara) |
| `family_get_relations` | P0 | Graph lokal dari `scope=family` | Anak/orang tua/saudara/pasangan/cucu/mertua/leluhur/keturunan |
| `family_get_summary` | P1 | Graph lokal | Total orang, hidup/meninggal, gender, root person, sebaran generasi |
| `family_get_tree` | P1 | `GET /persons?view=tree` | Node/edge ringkas + meta; opsional untuk pertanyaan luas |

#### `family_get_person` — bentuk output

```json
{
  "id": 42,
  "fullName": "Budi Santoso",
  "nickname": "Budi",
  "gender": "male",
  "birthDate": "1950-04-12",
  "deathDate": "2021-08-03",
  "status": "deceased",
  "age": null,
  "ageAtDeath": 71,
  "religion": "islam",
  "occupation": "Petani",
  "generationLabel": "Kakek",
  "photoUrl": null,
  "father": { "id": 10, "fullName": "..." },
  "mother": { "id": 11, "fullName": "..." },
  "spouses": [
    { "id": 43, "fullName": "Siti", "gender": "female", "status": "alive" }
  ],
  "children": {
    "count": 3,
    "items": [
      {
        "id": 50,
        "fullName": "Andi",
        "gender": "male",
        "birthDate": "1975-01-01",
        "deathDate": null,
        "status": "alive",
        "age": 51
      }
    ]
  },
  "siblings": {
    "count": 2,
    "full": [{ "id": 44, "fullName": "..." }],
    "halfPaternal": [],
    "halfMaternal": []
  },
  "contact": null
}
```

Catatan:

- `age` dihitung dari `birthDate` sampai hari ini (timezone Asia/Jakarta).
- `ageAtDeath` dihitung dari `birthDate` sampai `deathDate` jika `status=deceased`.
- `children` = semua person dengan `fatherId == id` **atau** `motherId == id`, dedupe.
- `siblings`:
  - `full`: `fatherId` sama **dan** `motherId` sama.
  - `halfPaternal`: `fatherId` sama, `motherId` beda.
  - `halfMaternal`: `motherId` sama, `fatherId` beda.
- `contact` hanya diisi jika `includeContact=true`. Default `false` agar nomor HP/alamat
  tidak otomatis masuk konteks LLM.
- `includeDeceased` default `true`. Bisa `false` untuk pertanyaan “anak yang masih hidup”.

#### `family_get_relations` — enum relasi

`relation`: `"children" | "parents" | "siblings" | "spouses" | "grandchildren" | "in_laws" | "ancestors" | "descendants"`

- `depth` hanya untuk `ancestors`/`descendants` (1–3, default 1).
- Output selalu `{ relation, count, people[] }`.

#### Contoh pemakaian

| Pertanyaan user | Tool calls |
|---|---|
| “Anak Pak Budi ada berapa, siapa saja?” | `family_search_people({ query: "Budi" })` → `family_get_person({ personId })` |
| “Kapan nenek meninggal?” | `family_search_people` → `family_get_person` → baca `deathDate`, `ageAtDeath` |
| “Siapa orang tua Siti?” | `family_get_person` → `father`, `mother` |
| “Siapa saja cucu Pak Budi?” | `family_get_person` → `family_get_relations({ relation: "grandchildren" })` |

---

### 6.3 Tool Money Track

> Tool money untuk sesi JWT memakai header unlock; token MCP memakai `unlock_modules`.
> Jika akses modul gagal, tool mengembalikan error yang bisa ditindaklanjuti, bukan
> error 500.

#### Tool baca

| Tool | Fase | Endpoint | Catatan |
|---|---|---|---|
| `money_get_context` | P0 | setup + accounts + pockets + categories + preferences | **Tool pertama yang disarankan**; untuk resolve nama dan lihat saldo |
| `money_get_dashboard` | P0 | `GET /money/dashboard` | Periode default bulan berjalan |
| `money_get_monthly_report` | P0 | `GET /money/reports/monthly` | `yearMonth` wajib |
| `money_list_accounts` | P0 | `GET /money/accounts` | + total saldo per account dihitung MCP |
| `money_list_pockets` | P0 | `GET /money/pockets` | Saldo, account, owner, goal |
| `money_list_categories` | P0 | `GET /money/categories` | Filter `type` |
| `money_list_transactions` | P0 | `GET /money/transactions` | Filter lengkap + pagination |
| `money_get_transaction` | P0 | `GET /money/transactions/:id` | Termasuk `balanceAfter` |
| `money_list_activity` | P0 | `GET /money/activity` | Feed gabungan; `includeDebts` |
| `money_get_transfer` | P0 | `GET /money/transfers/:id` | Detail transfer |
| `money_list_cash_withdrawals` | P0 | `GET /money/cash-withdrawals` | Pagination |
| `money_get_cash_withdrawal` | P0 | `GET /money/cash-withdrawals/:id` | Detail |
| `money_list_debts` | P0 | `GET /money/debts` | Filter status/direction/pocket |
| `money_get_debt` | P0 | `GET /money/debts/:id` | Termasuk payments + sisa |
| `money_list_budgets` | P0 | `GET /money/budgets?yearMonth=` | `yearMonth` wajib |
| `money_list_wishlist` | P0 | `GET /money/wishlist` | Progress jika linked pocket |
| `money_list_reminders` | P0 | `GET /money/reminders` | Debt due/budget |
| `money_get_balancing` | P1 | `GET /money/balancing` | Saldo tercatat per pocket |
| `money_list_audit_logs` | P1 | `GET /money/audit-logs` | Filter entity/actor/action/tanggal |
| `money_get_audit_log` | P1 | `GET /money/audit-logs/:id` | `includeRaw` untuk before/after |
| `money_get_preferences` | P1 | `GET /money/preferences` | Default pocket/kategori |
| `money_list_transfers` | P1* | `GET /money/activity?kind=transfer` | *Butuh endpoint baru jika mau detail penuh |

#### Tool tulis

| Tool | Fase | Endpoint | Catatan |
|---|---|---|---|
| `money_create_transaction` | P0 | `POST /money/transactions` | `income`/`expense`; pocket/kategori bisa nama |
| `money_update_transaction` | P0 | `PATCH /money/transactions/:id` | Partial update |
| `money_delete_transaction` | P0 | `DELETE /money/transactions/:id` | Wajib `confirm` |
| `money_create_transfer` | P0 | `POST /money/transfers` | `interpersonal`/`interpocket` |
| `money_create_cash_withdrawal` | P0 | `POST /money/cash-withdrawals` | Bank/ewallet → cash |
| `money_create_debt` | P0 | `POST /money/debts` | Utang/piutang, opsional link pocket |
| `money_update_debt` | P0 | `PATCH /money/debts/:id` | Termasuk lepas link pocket (`pocketId: null`) |
| `money_add_debt_payment` | P0 | `POST /money/debts/:id/payments` | Overpay = bunga |
| `money_create_account` | P1 | `POST /money/accounts` | bank/ewallet/cash |
| `money_update_account` | P1 | `PATCH /money/accounts/:id` | |
| `money_delete_account` | P1 | `DELETE /money/accounts/:id?cascade=` | `confirm`, cascade eksplisit |
| `money_create_pocket` | P1 | `POST /money/pockets` | |
| `money_update_pocket` | P1 | `PATCH /money/pockets/:id` | |
| `money_archive_pocket` | P1 | `POST /money/pockets/:id/archive` | |
| `money_unarchive_pocket` | P1 | `POST /money/pockets/:id/unarchive` | |
| `money_delete_pocket` | P1 | `DELETE /money/pockets/:id` | Hard delete + cascade; `confirm` |
| `money_create_category` | P1 | `POST /money/categories` | |
| `money_update_category` | P1 | `PATCH /money/categories/:id` | |
| `money_delete_category` | P1 | `DELETE /money/categories/:id` | `confirm` |
| `money_update_transfer` | P1 | `PATCH /money/transfers/:id` | |
| `money_delete_transfer` | P1 | `DELETE /money/transfers/:id` | `confirm` |
| `money_update_cash_withdrawal` | P1 | `PATCH /money/cash-withdrawals/:id` | |
| `money_delete_cash_withdrawal` | P1 | `DELETE /money/cash-withdrawals/:id` | `confirm` |
| `money_set_opening_balances` | P1 | `POST /money/opening-balances` | Batch; sekali per pocket |
| `money_check_balance` | P1 | `POST /money/balancing/check` | Bandingkan saldo aktual |
| `money_adjust_balance` | P1 | `POST /money/balancing/adjust` | Buat transaksi adjustment |
| `money_create_wishlist_item` | P1 | `POST /money/wishlist` | |
| `money_update_wishlist_item` | P1 | `PATCH /money/wishlist/:id` | |
| `money_delete_wishlist_item` | P1 | `DELETE /money/wishlist/:id` | `confirm` |
| `money_delete_debt` | P1 | `DELETE /money/debts/:id` | `confirm` |
| `money_upsert_budgets` | P1 | `PUT /money/budgets` | Batch per kategori |
| `money_update_preferences` | P1 | `PUT /money/preferences` | Default pocket/kategori, quick amounts |
| `money_setup_workspace` | P2 | `POST /money/setup/persons` | Admin-only, default nonaktif |
| `money_link_couple` | P2 | `POST /money/couple-link` | Admin-only |
| `money_unlink_couple` | P2 | `DELETE /money/couple-link` | Admin-only |
| `money_reset_workspace` | P2 | `POST /money/workspace/reset` | Sangat destruktif; default nonaktif |

\* `money_list_transfers` disarankan memakai endpoint baru `GET /money/transfers`
(belum ada). Untuk MVP bisa memakai `money_list_activity({ kind: "transfer" })`.

#### Schema input tool utama

**`money_create_transaction`**

```json
{
  "type": "expense",
  "amount": 50000,
  "date": "2026-11-07",
  "pocket": { "pocketName": "Transaksi", "account": { "accountName": "BCA" } },
  "category": { "categoryName": "Makan", "type": "expense" },
  "note": "Makan siang",
  "attachmentMediaId": null
}
```

- `type`: `"income" | "expense"` saja. `opening_balance`/`adjustment` lewat tool khusus.
- `amount`: integer > 0.
- `date`: opsional, default hari ini (Asia/Jakarta).
- `pocket`: wajib efektif. Jika tidak diisi, pakai default preference; jika tetap
  tidak ada, error dengan daftar pocket.
- `category`: opsional; kalau diisi harus tipe yang cocok.
- `note`: maksimal 500 karakter.

**`money_create_transfer`**

```json
{
  "kind": "interpocket",
  "fromPocket": { "pocketName": "Transaksi", "account": { "accountName": "BCA" } },
  "toPocket": { "pocketName": "Tabungan", "account": { "accountName": "BCA" } },
  "amount": 1000000,
  "date": "2026-11-07",
  "note": "Pindah ke tabungan"
}
```

- `kind`:
  - `interpersonal`: beda person, hanya mode couple.
  - `interpocket`: person sama, atau personal ↔ joint.
- Saldo sumber dicek API. Jika kurang → `INSUFFICIENT_BALANCE`.

**`money_create_cash_withdrawal`**

```json
{
  "fromAccount": { "accountName": "BCA" },
  "fromPocket": { "pocketName": "Transaksi" },
  "amount": 500000,
  "date": "2026-11-07",
  "note": "Tarik buat bayar tukang"
}
```

- Bank/ewallet → cash milik person pemilik account.
- Bukan transfer biasa. Untuk pindah antar pocket non-cash, pakai `money_create_transfer`.
- `toCashAccountId`/`toCashPocketId` dihitung API, jangan dikirim.

**`money_create_debt`**

```json
{
  "person": { "personName": "Irfan" },
  "counterpartyName": "Budi",
  "direction": "piutang",
  "amount": 1000000,
  "date": "2026-11-01",
  "dueDate": "2026-12-01",
  "pocket": { "pocketName": "Transaksi", "account": { "accountName": "BCA" } },
  "note": "Pinjam buat modal"
}
```

- `direction`: `utang` (saya berutang) / `piutang` (orang berutang ke saya).
- `pocket` opsional. `null` = catatan saja, saldo tidak berubah.
- Jika pocket di-link, efek saldo dihitung API; saldo bisa minus dan response berisi
  `balanceWarning` (bukan error).

**`money_add_debt_payment`**

```json
{
  "debt": { "counterpartyName": "Budi", "direction": "piutang" },
  "amount": 200000,
  "date": "2026-11-07",
  "note": "Cicilan 1"
}
```

**`money_upsert_budgets`**

```json
{
  "yearMonth": "2026-11",
  "items": [
    { "category": { "categoryName": "Makan", "type": "expense" }, "limitAmount": 2000000 }
  ]
}
```

**`family_get_person`**

```json
{
  "personId": 42,
  "includeRelations": true,
  "includeContact": false,
  "includeDeceased": true
}
```

Bisa juga `{ "name": "Budi Santoso" }`; jika lebih dari satu hasil, tool mengembalikan
kandidat.

---

## 7. Format output dan error

### 7.1 Output

- Sertakan `structuredContent` (JSON) dan ringkasan teks singkat.
- Field uang: integer + label `Rp` di ringkasan teks. Contoh:
  `"amount": 50000, "amountText": "Rp 50.000"`.
- Tanggal: `YYYY-MM-DD`; waktu audit: ISO 8601.
- List default ringkas; field detail hanya jika diminta (`includeRaw`, `includeContact`).
- Pagination: `page`, `pageSize`, `total`, `hasNext`.
- Untuk hasil besar (tree/audit), batasi `pageSize` default 20 dan maksimal 100.

### 7.2 Pemetaan error API

| HTTP / code | Pesan ke user/agent | Tindakan |
|---|---|---|
| `SECONDARY_UNLOCK_REQUIRED` | “Modul money belum di-unlock.” | Sesi JWT: verify secondary password. Token MCP: buat token baru dengan modul `money` |
| `SECONDARY_UNLOCK_INVALID` | “Unlock kedaluwarsa/tidak cocok.” | Verify ulang lalu retry sekali |
| `SECONDARY_PASSWORD_NOT_SET` | “Secondary password belum diatur.” | Arahkan setup di aplikasi |
| `MCP_TOKEN_INVALID` | “Token MCP tidak valid atau dicabut.” | Jangan retry; ganti token di agent Nouride |
| `VALIDATION_ERROR` | Sertakan field + nilai yang diizinkan | Jangan retry; perbaiki argumen |
| `INSUFFICIENT_BALANCE` | Sertakan saldo sumber + nominal | Tawarkan cek saldo/transfer lain |
| `CONFLICT` | Sertakan alasan (mis. pocket punya saldo) | Tawarkan archive/balancing |
| `NOT_FOUND` | Sertakan resource + saran list tool | Jangan menebak ID |
| `MONEY_NOT_CONFIGURED` | “Money Track belum disetup.” | Arahkan setup |
| Timeout/5xx | “Status tidak diketahui.” | Jangan retry untuk write; minta cek riwayat |

---

## 8. Contoh alur percakapan

| User | Tool call | Hasil |
|---|---|---|
| “Saldo kantong Transaksi berapa?” | `money_get_context` atau `money_list_pockets({ includeArchived:false })` | Saldo + account |
| “Catat pengeluaran 50rb dari kantong Transaksi buat makan siang” | `money_create_transaction({ type:"expense", amount:50000, pocket:{pocketName:"Transaksi"}, category:{categoryName:"Makan",type:"expense"}, note:"Makan siang" })` | Transaksi + `balanceAfter` |
| “Gajian 10 juta masuk BCA” | `money_get_context` → `money_create_transaction({ type:"income", amount:10000000, pocket: ... })` | Jika BCA punya beberapa pocket, minta pilih |
| “Pindahkan 1 juta dari BCA ke Tunai” | `money_create_cash_withdrawal({ fromAccount:{accountName:"BCA"}, fromPocket:{pocketName:"Transaksi"}, amount:1000000 })` | Saldo sumber turun, cash naik |
| “Pindahkan 1 juta dari Transaksi ke Tabungan” | `money_create_transfer({ kind:"interpocket", fromPocket:..., toPocket:..., amount:1000000 })` | Transfer |
| “Catat utang ke Budi 500rb” | `money_create_debt({ direction:"utang", counterpartyName:"Budi", amount:500000, person:... })` | Debt |
| “Budi bayar utang 200rb” | `money_list_debts({ direction:"utang" })` → `money_add_debt_payment` | Debt + payments |
| “Bulan ini habis berapa?” | `money_get_monthly_report({ yearMonth:"2026-11" })` | Summary + kategori |
| “Buat budget Makan 2 juta bulan ini” | `money_upsert_budgets({ yearMonth:"2026-11", items:[...] })` | Budget |
| “Anak Pak Budi ada berapa?” | `family_search_people({ query:"Budi" })` → `family_get_person({ personId })` | `children.count` + nama |
| “Kapan nenek meninggal?” | `family_search_people` → `family_get_person` | `deathDate`, `ageAtDeath` |

---

## 9. Perubahan API yang mungkin diperlukan

Tidak wajib untuk MVP, tapi perlu diputuskan saat review:

1. **`GET /money/transfers` (list)** — saat ini hanya ada `GET /transfers/:id`.
   Untuk riwayat transfer yang lengkap, tambah list dengan filter tanggal/pocket/person
   + pagination. Alternatif MVP: pakai `GET /money/activity?kind=transfer`.
2. **Endpoint relasi person** — `GET /persons/:id/relations` bisa menghemat fetch seluruh
   family. Belum perlu untuk 95 orang; pertimbangkan jika data >500.
3. **Detail endpoint** untuk pocket/account/category/wishlist — saat ini list + filter
   sudah cukup. Tambah hanya jika data besar.
4. **Idempotency key** untuk create transaksi/transfer — mencegah double-submit saat
   timeout. Perlu migration/kolom atau tabel idempotency.
5. **Personal access token (PAT) MCP** — **sudah diimplementasikan** (2026-11-07).
   Tidak perlu `core_mcp_links`, `core_mcp_link_codes`, `link/start`, atau
   `link/confirm`. API hanya menyimpan `core_mcp_tokens`; mapping agent/token ada
   di Nouride. Detail di bagian 5.1–5.5.

Jika salah satu diimplementasikan, ikuti `AGENTS.md`: tambahkan catatan deploy di
`deploy/releases/pending/YYYY-MM-DD-nama-fitur.md` dan update `.env.example` /
`.env.docker.example` bila ada env baru.

---

## 10. Struktur kode yang diusulkan

```text
family-mcp/
  package.json
  tsconfig.json
  Dockerfile
  README.md
  src/
    index.ts                 # entrypoint streamable HTTP (stdio opsional)
    config/env.ts
    auth/passthrough.ts      # ambil Authorization per request, teruskan ke API
    api/client.ts            # fetch wrapper + token per request + envelope + error mapping
    api/family.ts
    api/money.ts
    cache/context-cache.ts
    resolve/person.ts
    resolve/account.ts
    resolve/pocket.ts
    resolve/category.ts
    resolve/debt.ts
    relations/graph.ts       # anak, orang tua, saudara, cucu, mertua
    tools/family/*.ts
    tools/money/*.ts
    format/money.ts
    format/person.ts
    guard/confirm.ts
    errors.ts
  test/
    relations.test.ts
    resolve.test.ts
    auth-passthrough.test.ts
    money-tools.test.ts
    family-tools.test.ts
```

Dependensi yang diusulkan:

- `@modelcontextprotocol/sdk`
- `zod`
- `undici` (opsional; Node 18+ sudah punya `fetch`)
- `vitest` untuk test
- `typescript`

Script:

```json
{
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run"
  }
}
```

Untuk deployment STB, tambahkan service `family-mcp` di `docker-compose.yml`.
Service ini:

- join network `shared_net` (atau network BE yang sudah ada)
- `FAMILY_API_BASE_URL=http://family-suite-api:3000/api/v1`
- image arm64, log rotation, tanpa token di env
- tidak expose port ke publik; hanya internal/VPN
- health check `GET /health`
- Nouride mengakses `http://family-mcp:3100/mcp`

---

## 11. Pertanyaan untuk review

1. **Transport**: **Streamable HTTP** untuk Nouride di STB. `stdio` hanya opsional
   untuk client lokal. Setuju?
2. **Siapa user MCP**: sudah diputuskan **1 orang = 1 agent Nouride = 1 token**.
   Tidak ada link code / `discord_id` di API. Untuk money: token memakai
   `unlock_modules` trusted saat dibuat. Setuju?
3. **Write default**: apakah tool tulis money langsung aktif, atau default read-only
   dan diaktifkan lewat env?
4. **Tool destruktif**: apakah delete transaksi/pocket/account perlu selalu aktif,
   atau cukup lewat aplikasi?
5. **Privasi**: bolehkah nomor HP/alamat person ikut ke LLM jika diminta, atau
   sebaiknya tidak pernah?
6. **Family scope**: cukup person + relasi, atau perlu events/memoriam juga?
7. **Transfer list**: setuju menambah `GET /money/transfers` di API, atau cukup
   pakai activity?
8. **Attachment**: perlu upload media dari MCP, atau cukup referensi `mediaId`?
9. **Nama tool**: setuju prefix `family_` / `money_`, atau mau nama Indonesia?
10. **Idempotency**: perlu proteksi double-submit sejak awal?

---

## 12. Acceptance criteria

- Pertanyaan “anak X ada berapa dan siapa saja” terjawab dalam **≤2 tool call**,
  dengan count + nama + tanggal lahir/meninggal.
- Pertanyaan “kapan X meninggal” mengembalikan `deathDate` dan `ageAtDeath` yang benar.
- “Catat pengeluaran 50rb dari kantong Transaksi” berhasil dalam **1 tool call**
  setelah context, dan response menyertakan saldo setelah transaksi.
- Nama ambigu (mis. dua pocket “Transaksi” di account berbeda) **tidak pernah**
  ditebak; tool mengembalikan kandidat.
- Semua write money tetap menghasilkan audit log API.
- Tool money gagal dengan pesan jelas jika token MCP tidak punya modul `money`;
  user diarahkan membuat token baru dengan unlock money.
- Token MCP, `Authorization`, dan secondary password **tidak pernah** muncul di log.
- `npm run build` dan `npm test` API tetap lolos; MCP punya test sendiri.
- Jika ada perubahan runtime API, deploy note STB ikut dibuat.

---

## 13. Estimasi kasar

| Pekerjaan | Estimasi |
|---|---|
| Scaffold MCP + pass-through auth + API client | 1–2 hari |
| Family tools + relation engine | 0,5–1 hari |
| Money read tools + context + resolver | 1 hari |
| Money write tools + guardrail + error mapping | 2–3 hari |
| Test + dokumentasi + Docker | 1–2 hari |
| **Total MVP (P0)** | **± 5–7 hari** |
| P1 (manajemen lengkap) | +2–3 hari |
| P2 (admin/PAT/idempotency) | sesuai kebutuhan |

---

## 14. Rekomendasi urutan implementasi

1. Scaffold `family-mcp/` + config + pass-through auth + API client.
2. `family_search_people` + `family_get_person` + relation engine.
3. `money_get_context` + semua tool baca money.
4. `money_create_transaction` + update/delete + resolver pocket/kategori.
5. `money_create_transfer`, `money_create_cash_withdrawal`.
6. Debt/payment, budget, wishlist.
7. Account/pocket/category CRUD, balancing, opening balance.
8. Guardrail destruktif + test + dokumentasi.
9. Docker arm64 + deploy note + setup Nouride per agent.
