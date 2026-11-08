# Tutorial Pasca-Deploy — Token MCP, `family-mcp`, dan Nouride

Status: **draft operasional** — token MCP BE sudah diimplementasikan; service
`family-mcp` belum di-scaffold. Dokumen ini berlaku setelah BE naik ke STB dan
image `family-mcp` tersedia.

Terakhir diperbarui: 2026-11-08.

## Daftar isi

1. [Ringkas arsitektur](#0-ringkas-arsitektur)
2. [Sebelum deploy](#1-sebelum-deploy)
3. [Deploy BE token MCP ke STB](#2-deploy-be-token-mcp-ke-stb)
4. [Cek cepat setelah BE naik](#3-cek-cepat-setelah-be-naik)
5. [Buat token pertama](#4-buat-token-pertama)
6. [Tes token MCP langsung ke API](#5-tes-token-mcp-langsung-ke-api)
7. [Deploy service `family-mcp`](#6-deploy-service-family-mcp)
8. [Setup Nouride per agent](#7-setup-nouride-per-agent)
9. [Onboarding anggota keluarga berikutnya](#8-onboarding-anggota-keluarga-berikutnya)
10. [Revoke dan rotasi token](#9-revoke-dan-rotasi-token)
11. [Monitoring dan perawatan STB](#10-monitoring-dan-perawatan-stb)
12. [Troubleshooting](#11-troubleshooting)
13. [Checklist setelah deploy](#12-checklist-setelah-deploy)
14. [Jangan dilakukan](#13-jangan-dilakukan)
15. [Referensi](#14-referensi)

Dokumen ini menjelaskan urutan kerja **setelah deploy BE**:

1. memastikan fitur token MCP benar-benar hidup di STB,
2. membuat token untuk agent Nouride,
3. menjalankan service `family-mcp`,
4. menghubungkan Nouride per agent,
5. menguji, mencabut, dan merotasi token.

Untuk arsitektur dan daftar tool, lihat
[`MCP-PLAN.md`](./MCP-PLAN.md). Untuk request UI token ke FE, lihat
[`MCP-TOKEN-FE-PROMPT.md`](../requests/to-fe/done/MCP-TOKEN-FE-PROMPT.md).

---

## 0. Ringkas arsitektur

```text
Nouride agent A -> token A -> family-mcp -> API FamilyRoots -> person A
Nouride agent B -> token B -> family-mcp -> API FamilyRoots -> person B
```

Aturan utama:

- **1 orang = 1 agent Nouride = 1 token FamilyRoots.**
- Token disimpan di secret store Nouride, **bukan** di `mcp.toml`.
- `family-mcp` tidak menyimpan token. Ia meneruskan
  `Authorization: Bearer frmcp_...` dari Nouride ke API.
- API hanya tahu token → person/family/modul. Tidak ada `discord_id` di API.
- Admin bisa mencabut token siapa pun dari aplikasi FamilyRoots.

---

## 1. Sebelum deploy

Di laptop:

```bash
npm run build
npm test
```

Pastikan catatan deploy ada di `deploy/releases/pending/`:

```bash
ls deploy/releases/pending/
```

Catatan fitur ini: `2026-11-07-mcp-tokens.md`.

Di STB, sebaiknya backup database dulu sesuai prosedur backup yang biasa dipakai.
Migration fitur ini **additive** (hanya membuat tabel `core_mcp_tokens`), tetapi
backup tetap aman.

Cek kapasitas STB:

```bash
df -h
docker system df
```

Kalau disk tight, bersihkan image/container yang benar-benar tidak dipakai
sebelum menambah service baru.

---

## 2. Deploy BE token MCP ke STB

Semua perintah `docker compose` di bawah dijalankan dari folder repo BE di STB.

Dari laptop:

```bash
ssh <user>@<host-stb>
cd /path/ke/family-tree-api
git status
git pull
bash scripts/deploy.sh
```

`scripts/deploy.sh` akan:

1. menampilkan catatan `pending/`,
2. mengecek `.env.docker`,
3. build + `docker compose up -d`,
4. menjalankan migration saat container start,
5. menunggu health check,
6. menjalankan curl di bagian **Cek setelah naik**,
7. memindahkan catatan yang lolos ke `shipped/`.

Kalau berhasil, catatan `2026-11-07-mcp-tokens.md` pindah dari `pending/` ke
`shipped/`. Di laptop, tarik perubahan itu:

```bash
git pull
```

Kalau container tidak sehat:

```bash
docker compose --env-file .env.docker logs --tail=200 api
```

---

## 3. Cek cepat setelah BE naik

### 3.1 Health

```bash
curl -fsS http://localhost:3000/api/v1/health
```

Harapan: `{"status":"ok"}`.

### 3.2 Route token hidup

```bash
curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/v1/auth/mcp-tokens
```

Harapan: `401`. Kalau `404`, route belum naik atau container belum rebuild.

### 3.3 Migration tabel token

```bash
docker compose --env-file .env.docker exec db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" -e "SHOW TABLES LIKE \"core_mcp_tokens\";"'
```

Harapan: tabel `core_mcp_tokens` muncul. Nama service `db`, env password, dan
`MYSQL_DATABASE` sesuaikan dengan compose STB.

### 3.4 Endpoint admin hidup

```bash
curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/v1/admin/mcp-tokens
```

Harapan: `401` (butuh login admin). `404` berarti route belum naik.

---

## 4. Buat token pertama

Token dibuat dari **sesi aplikasi**, bukan dari token MCP. Bisa lewat UI FE
setelah FE selesai, atau lewat curl untuk uji cepat. Contoh di bawah memakai
`jq`; kalau STB belum punya `jq`, install dulu atau baca JSON-nya manual.

### 4.1 Login dan simpan access token

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"code":"<LOGIN_CODE>","remember":false}' | jq -r '.data.accessToken')
```

Cek:

```bash
curl -s http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN" | jq '.data.fullName'
```

### 4.2 Buat token tanpa modul sensitif

Cocok untuk agent yang hanya perlu Family Roots.

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/mcp-tokens \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"label":"Nouride - <nama-agent>","modules":[]}' | jq
```

Simpan nilai `.data.token` dari response. Token asli **hanya muncul sekali**.

### 4.3 Buat token dengan akses Money Track

Verifikasi password kedua dulu:

```bash
UNLOCK=$(curl -s -X POST http://localhost:3000/api/v1/auth/secondary-password/verify \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"password":"<PASSWORD_KEDUA>"}' | jq -r '.data.unlockToken')
```

Lalu buat token dengan modul `money`:

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/mcp-tokens \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Module-Unlock: $UNLOCK" \
  -H 'Content-Type: application/json' \
  -d '{"label":"Nouride - <nama-agent>","modules":["money"]}' | jq
```

Modul yang boleh: `money`, `core`, `household`. Modul `admin` sengaja ditolak.

### 4.4 Lihat daftar token

```bash
curl -s http://localhost:3000/api/v1/auth/mcp-tokens \
  -H "Authorization: Bearer $TOKEN" | jq
```

Yang tampil hanya hint, bukan token asli. Kalau token hilang, hapus lalu buat baru.

---

## 5. Tes token MCP langsung ke API

Simpan token di shell:

```bash
export MCP_TOKEN='frmcp_...'
```

### 5.1 Validasi identitas

```bash
curl -s http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer $MCP_TOKEN" | jq '.data.fullName'
```

Harapan: nama person pemilik token.

### 5.2 Akses Family Roots

```bash
curl -s "http://localhost:3000/api/v1/persons?page=1&limit=1" \
  -H "Authorization: Bearer $MCP_TOKEN" | jq '.data.pagination'
```

### 5.3 Akses Money (kalau token punya modul `money`)

```bash
curl -s http://localhost:3000/api/v1/money/dashboard \
  -H "Authorization: Bearer $MCP_TOKEN" | jq
```

Kalau token dibuat tanpa modul `money`, response harus
`403 SECONDARY_UNLOCK_REQUIRED`.

### 5.4 Pastikan endpoint keamanan ditolak

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/v1/auth/secondary-password/verify \
  -H "Authorization: Bearer $MCP_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"password":"x"}'
```

Harapan: `403`. Token MCP tidak boleh mengubah kredensial/keamanan akun.

### 5.5 Tes revoke

Cabut token:

```bash
curl -s -X DELETE http://localhost:3000/api/v1/auth/mcp-tokens/<ID> \
  -H "Authorization: Bearer $TOKEN" | jq
```

Setelah dicabut, `/auth/me` dengan token itu harus `401 MCP_TOKEN_INVALID`.

---

## 6. Deploy service `family-mcp`

> Bagian ini baru bisa dijalankan setelah repo/image `family-mcp` dibuat.
> `family-mcp` adalah service terpisah, bukan route baru di API.

### 6.1 Yang perlu disiapkan

- repo/service `family-mcp` (Node 22 + TypeScript + MCP SDK),
- transport **Streamable HTTP**,
- endpoint `GET /health`,
- image **linux/arm64**,
- akses ke network Docker yang sama dengan API.

### 6.2 Env service

```env
FAMILY_API_BASE_URL=http://api:3000/api/v1
FAMILY_MCP_TIMEZONE=Asia/Jakarta
MCP_TRANSPORT=http
MCP_HTTP_PORT=3100
MCP_HTTP_HOST=0.0.0.0
FAMILY_MCP_ENABLE_WRITE=true
FAMILY_MCP_ENABLE_DESTRUCTIVE=false
FAMILY_MCP_CACHE_TTL_MS=30000
FAMILY_MCP_REQUEST_TIMEOUT_MS=15000
```

Catatan:

- Tidak ada token di env ini.
- `api` adalah nama service BE di compose STB. Sesuaikan kalau berbeda.
- Jangan publish port ke publik. Cukup internal Docker network/VPN.
- Jangan log header `Authorization`.

### 6.3 Contoh service di compose

Kalau `family-mcp` ditambahkan ke compose yang sama dengan BE:

```yaml
services:
  family-mcp:
    build: ../family-mcp
    container_name: family-mcp
    restart: unless-stopped
    environment:
      FAMILY_API_BASE_URL: http://api:3000/api/v1
      FAMILY_MCP_TIMEZONE: Asia/Jakarta
      MCP_TRANSPORT: http
      MCP_HTTP_PORT: "3100"
      MCP_HTTP_HOST: 0.0.0.0
      FAMILY_MCP_ENABLE_WRITE: "true"
      FAMILY_MCP_ENABLE_DESTRUCTIVE: "false"
    networks:
      - family_net
    healthcheck:
      test:
        [
          "CMD",
          "node",
          "-e",
          "fetch('http://127.0.0.1:3100/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))",
        ]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 20s
```

> `family_net` dan `../family-mcp` hanya contoh. Ganti dengan nama network
> service BE dan path repo `family-mcp` yang sebenarnya.

Kalau `family-mcp` memakai compose terpisah, gunakan network external yang sama
dengan BE. Cek nama network dulu:

```bash
docker network ls
```

```bash
docker inspect <nama-container-api> --format '{{json .NetworkSettings.Networks}}'
```

### 6.4 Build dan jalankan

```bash
docker compose --env-file .env.docker up -d --build family-mcp
```

Cek status:

```bash
docker compose --env-file .env.docker ps family-mcp
```

Cek log:

```bash
docker compose --env-file .env.docker logs --tail=100 family-mcp
```

### 6.5 Health check

Kalau port tidak dipublish ke host, cek dari dalam container:

```bash
docker compose --env-file .env.docker exec family-mcp \
  node -e "fetch('http://127.0.0.1:3100/health').then(r=>r.text()).then(console.log)"
```

Harapan: response sehat dari service MCP.

---

## 7. Setup Nouride per agent

### 7.1 Prinsip

- Satu orang memakai satu agent Nouride.
- Satu agent memakai satu token FamilyRoots.
- Kalau satu orang punya Discord + Telegram, buat token terpisah per agent.
- Jangan pakai satu agent bersama untuk banyak orang: Nouride mengirim credential
  yang statis per agent, jadi identitas pengetik tidak bisa dibedakan otomatis.

### 7.2 Daftarkan server di library Nouride

Contoh di `agents/mcp.toml`:

```toml
[[servers]]
name = "familyroots"
transport = "streamable-http"
url = "http://family-mcp:3100/mcp"
per_agent = true
```

`per_agent = true` penting supaya tiap agent punya credential sendiri. Nama
server `familyroots` menjadi prefix tool di Nouride, mis.
`familyroots__family_search_people`. Path `/mcp` mengikuti rencana; sesuaikan
dengan endpoint yang benar-benar diekspos service `family-mcp`.

### 7.3 Simpan token di secret store agent

Buka agent yang bersangkutan di Nouride, lalu isi credential/token `familyroots`
lewat secret store/Connectors. Bentuk UI/CLI bisa berbeda tergantung versi
Nouride; yang penting:

- token masuk ke **secret store** Nouride,
- token **tidak** ditulis mentah di `mcp.toml`,
- token **tidak** di-commit ke Git.

Jangan memakai login code atau secondary password sebagai credential Nouride.
Cukup token `frmcp_...`.

### 7.4 Aktifkan server untuk agent

Pastikan server `familyroots` aktif hanya untuk agent yang berhak. Kalau memakai
CLI Nouride, gunakan perintah enable server per agent sesuai versi terpasang.

### 7.5 Batasi tool per agent

Contoh allowlist untuk agent yang hanya perlu baca family + dashboard money
(contoh bentuk perintah; cek `nouride mcp tools --help` untuk versi terpasang):

```bash
nouride mcp tools familyroots --agent <agent-id> \
  --only family_search_people,family_get_person,money_get_dashboard
```

Prinsipnya: mulai dari tool read-only, tambah tool write hanya kalau perlu.

### 7.6 Tool destruktif wajib approval

Nouride menjalankan tool tanpa approval secara default. Untuk tool berbahaya,
tambahkan di config agent:

```toml
[tools]
approval_required = [
  "familyroots__money_delete_transaction",
  "familyroots__money_delete_account",
]
```

Kalau tidak butuh tool destruktif sama sekali, jangan masukkan ke allowlist.

### 7.7 Tes dari Nouride

Kirim pertanyaan sederhana ke agent:

```text
Siapa saja anak Pak Budi?
```

Lalu tes money kalau token punya modul `money`:

```text
Saldo kantong Transaksi berapa?
```

Cek di FamilyRoots:

- `GET /auth/mcp-tokens` → `lastUsedAt` token harus terisi.
- Log `family-mcp` tidak boleh menampilkan token.
- Kalau gagal, lihat tabel troubleshooting di bawah.

---

## 8. Onboarding anggota keluarga berikutnya

Ulangi alur ini **per orang**:

1. Orang tersebut login ke FamilyRoots.
2. Buka **Pengaturan → Token MCP**.
3. Buat token dengan label `Nouride - <nama-agent>`.
4. Pilih modul:
   - `[]` kalau hanya Family Roots,
   - `["money"]` kalau perlu Money Track,
   - `["core"]` / `["household"]` kalau perlu modul itu.
5. Copy token sekali.
6. Di Nouride, buat agent + bot/connection milik orang itu.
7. Simpan token di secret store agent tersebut.
8. Aktifkan `familyroots` dan atur allowlist tool.
9. Tes satu pertanyaan family dan satu pertanyaan money (kalau ada).
10. Minta orang itu menyimpan token di tempat aman.

Admin dapat melihat semua token di **Admin → Token MCP** dan mencabut paksa
token siapa pun. Cabut paksa = agent yang memakai token itu langsung kehilangan
akses.

---

## 9. Revoke dan rotasi token

### Kalau token bocor

1. Buka **Pengaturan → Token MCP** (atau **Admin → Token MCP**).
2. Hapus/cabut token yang bocor.
3. Buat token baru.
4. Ganti credential di agent Nouride.
5. Tes ulang.

Token lama langsung mati. Tidak ada masa tenggang.

### Kalau user pindah agent/device

- Buat token baru untuk agent baru.
- Cabut token lama setelah agent baru terbukti jalan.
- Maksimal 5 token aktif per person; hapus token yang tidak dipakai.

### Kalau `family-mcp` bermasalah

- Stop container `family-mcp`; API tetap jalan normal.
- Token tidak perlu dicabut kalau service hanya sedang maintenance.
- Setelah service hidup lagi, Nouride bisa memakai token yang sama.

---

## 10. Monitoring dan perawatan STB

Cek container:

```bash
docker compose --env-file .env.docker ps
```

Cek resource:

```bash
docker stats --no-stream
```

Cek disk:

```bash
df -h
docker system df
```

Kalau disk tight, bersihkan image/container yang tidak dipakai **setelah**
memastikan tidak ada rollback yang membutuhkan image lama.

Aktifkan log rotation untuk `family-mcp` dan API. Jangan biarkan log tumbuh
tanpa batas di STB.

---

## 11. Troubleshooting

| Gejala | Kemungkinan | Solusi |
|---|---|---|
| `404` di `/auth/mcp-tokens` | BE belum naik / container belum rebuild | Cek deploy, rebuild, lihat log `api` |
| `401 MCP_TOKEN_INVALID` di Nouride | Token salah, dicabut, atau terpotong | Buat token baru, ganti credential agent |
| `403 SECONDARY_UNLOCK_REQUIRED` di money | Token tidak punya modul `money` | Buat token baru dengan `modules: ["money"]` |
| `403 FORBIDDEN` di endpoint keamanan | Memang sengaja diblokir untuk token MCP | Gunakan sesi aplikasi, bukan token MCP |
| `502` / connection refused dari Nouride | `family-mcp` mati, URL salah, atau beda network | Cek `docker compose ps`, log, dan network |
| Nouride connect tapi tool kosong | Server belum di-enable untuk agent / allowlist kosong | Enable `familyroots`, cek `nouride mcp tools` |
| Tool destruktif ditolak | Masuk `approval_required` | Approve di Nouride atau jangan pakai tool itu |
| `lastUsedAt` tidak berubah | Agent tidak benar-benar memakai token itu | Cek credential agent dan log `family-mcp` |
| Nouride gagal setelah restart | Secret store/key tidak persisten | Cek `NOURIDE_ENCRYPTION_KEY` dan volume Nouride |
| STB kehabisan disk | Image/log lama menumpuk | `docker system df`, prune yang aman, log rotation |

---

## 12. Checklist setelah deploy

- [ ] `bash scripts/deploy.sh` selesai tanpa error.
- [ ] Catatan `2026-11-07-mcp-tokens.md` sudah pindah ke `shipped/`.
- [ ] `GET /api/v1/health` → `200`.
- [ ] `GET /api/v1/auth/mcp-tokens` tanpa auth → `401`.
- [ ] Tabel `core_mcp_tokens` ada.
- [ ] Token pertama berhasil dibuat dan `.data.token` disimpan.
- [ ] `GET /auth/me` dengan token MCP → nama person benar.
- [ ] `GET /persons` dengan token MCP → data family keluar.
- [ ] Money dashboard dengan token `money` → keluar; token tanpa `money` → `403`.
- [ ] Endpoint keamanan dengan token MCP → `403`.
- [ ] Revoke token → token lama `401`.
- [ ] `family-mcp` sehat dan bisa diakses Nouride.
- [ ] Satu agent Nouride berhasil memanggil satu tool family.
- [ ] Tool destruktif masuk approval/allowlist yang benar.
- [ ] `lastUsedAt` token terisi setelah dipakai.
- [ ] Tidak ada token di log, Git, atau `mcp.toml`.

---

## 13. Jangan dilakukan

- Jangan menaruh token `frmcp_...` di `mcp.toml`, `.env` yang di-commit, atau
  chat publik.
- Jangan memakai satu token untuk banyak orang.
- Jangan memakai login code atau secondary password sebagai credential Nouride.
- Jangan mengekspos `family-mcp` ke internet tanpa HTTPS/auth tambahan.
- Jangan menjalankan `RUN_SEED=true` atau `SKIP_MIGRATE=true` di STB.
- Jangan menganggap token MCP bisa mengelola admin, token lain, atau keamanan akun.
- Jangan lupa mencabut token lama setelah rotasi.

---

## 14. Referensi

- [`deploy/README.md`](../../deploy/README.md) — prosedur deploy STB.
- [`deploy/releases/pending/2026-11-07-mcp-tokens.md`](../../deploy/releases/pending/2026-11-07-mcp-tokens.md) — catatan deploy fitur token.
- [`MCP-PLAN.md`](./MCP-PLAN.md) — arsitektur MCP, daftar tool, keputusan auth.
- [`MCP-TOKEN-FE-PROMPT.md`](../requests/to-fe/done/MCP-TOKEN-FE-PROMPT.md) — kontrak UI token untuk FE.
- [`INSTALLATION.md`](./INSTALLATION.md) — setup lokal dan smoke test API.
