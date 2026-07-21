# FamilyRoots — Dokumentasi Mock Data → BE Seeder

Sumber FE: `src/data/mockFamilyData.ts`  
Artifact JSON siap import: [`seed/mock-family-seed.json`](./seed/mock-family-seed.json)

Dokumen ini untuk AI/engineer **Backend** saat mengerjakan **Part 1 (schema + seed)** di [`BE-AUTH-API-PLAN.md`](./BE-AUTH-API-PLAN.md).

---

## Ringkasan

| Item | Nilai |
|---|---|
| `familyId` (disarankan) | `family-ardhyansah-demo` |
| `familyName` | Keluarga Ardhyansah (Demo) |
| `rootPersonId` | `me` |
| Total persons | **95** |
| Alive (bisa login) | **63** |
| Deceased (tidak bisa login) | **32** |
| Pasangan (pasangan unik) | **43** |

### Aturan default FE (ikuti di seeder)

1. Default `status` = `alive` kecuali di-set `deceased`.
2. Jika `status === deceased` dan `religion` kosong → set `religion = "islam"`.
3. `spouseIds` selalu **dua arah** (`A→B` dan `B→A`).
4. Relasi orang tua: `fatherId` + `motherId` (keduanya opsional, tapi di mock hampir selalu berpasangan).
5. `loginCode` **derived** dari `fullName` + `birthDate` — **nickname tidak dipakai**. Jangan simpan sebagai password. Field `_computedLoginCode` di JSON hanya untuk smoke test.
6. ID di mock adalah **slug string stabil** (`me`, `father`, `pat-ggp-m`, …). BE boleh:
   - pakai slug langsung sebagai PK, **atau**
   - map slug → UUID dengan tabel lookup `legacy_id`.

---

## Urutan insert seeder (wajib)

Insert orang tua dulu (FK `father_id` / `mother_id`), pasangan boleh setelah kedua individu ada.

```
1. Family row
2. Generasi paling atas (tidak punya father/mother)
3. Generasi berikutnya (yang merujuk ID di step 2)
4. …ulang sampai anak terkecil
5. Junction spouses (dari array spouses di JSON)
```

Atau: insert semua person **tanpa FK dulu**, lalu `UPDATE` father/mother/spouse — lebih aman untuk circular-free tree ini.

---

## Struktur pohon (fokus root `me`)

```
[Orang Tua Buyut Ayah]          [Orang Tua Buyut Ibu]
  pat-ggp-m ── pat-ggp-f          mat-ggp-m ── mat-ggp-f
  (+ ortu buyut lain per cabang)  (+ ortu buyut lain per cabang)
           │                                │
[Buyut Ayah]                        [Buyut Ibu]
  pat-buyut-m ── pat-buyut-f          mat-buyut-m ── mat-buyut-f
  (+ saudara buyut + pasangan)        (+ saudara buyut + pasangan)
           │                                │
[Kakek/Nenek Ayah]                  [Kakek/Nenek Ibu]
  pat-gp-m ── pat-gp-f                mat-gp-m ── mat-gp-f
  (+ saudara kakek + pasangan)         (+ saudara kakek + pasangan)
           │                                │
     father ══════════════════════════ mother
  (+ paman/bibi ayah + pasangan)   (+ paman/bibi ibu + pasangan)
           │
     ┌─────┼─────────┬─────────┐
   sib-1   me      sib-2     sib-3
     │      │        │         │
   +sp/anak me-sp  +sp/anak  +sp/anak
            │
         me-c1, me-c2

Cabang pasangan (me-sp):
  sp-pat-buyut-* → sp-pat-gp-* → sp-father
  sp-mat-buyut-* → sp-mat-gp-* → sp-mother
  sp-father ── sp-mother → me-sp

Akun demo terpisah (tidak di pohon utama):
  demo-mr  (login MR170845)
```

---

## Akun uji login (prioritas)

Pakai ini dulu untuk smoke test auth. Kode dihitung ulang di BE dari nama+tanggal — nilai di bawah harus **identik**.

| personId | Nama | Nickname | birthDate | Login code | Catatan |
|---|---|---|---|---|---|
| `demo-mr` | Mulyono Raka | — | 1945-08-17 | `MR170845` | Demo eksplisit di mock |
| `me` | Mochamad Irfani Ardhyansah | — | 1999-03-21 | `MIA210399` | `rootPersonId`, `isSelf`, `role=admin` |
| `me-sp` | Hj. Ayu Kirana | Ayu | 2001-05-17 | `AK170501` | Pasangan root |
| `father` | H. Budi Ardhyansah | Ayah | 1975-01-20 | `BA200175` | Inisial Budi + Ardhyansah |
| `mother` | Hj. Citra Maharani | Ibu | 1976-10-12 | `CM121076` | Inisial Citra + Maharani |
| `sib-1` | H. Andi Pratama | Kak Andi | 1998-03-14 | `AP140398` | Saudara |
| `pat-gp-m` | H. Wijaya | — | 1950-05-08 | `WIJAYA080550` | 1 kata setelah gelar |

**Negative cases**

| Kasus | Contoh | Expected |
|---|---|---|
| Deceased | `pat-ggp-m` (H. Mulyono Ardhyansah) | Login ditolak (`CODE_NOT_FOUND`) |
| Format salah | `ABC` / `123456` | `400 CODE_INVALID_FORMAT` |
| Kode salah | `XXXX010100` | `401 CODE_NOT_FOUND` |

Semua kode alive ada di JSON field `_computedLoginCode` (63 entri).

---

## Katalog person per lapisan

### A. Orang tua buyut — garis ayah (deceased)

| id | fullName | gender | birthDate | deathDate | spouseIds |
|---|---|---|---|---|---|
| `pat-ggp-m` | H. Mulyono Ardhyansah | male | 1900-01-01 | 1972-06-10 | `pat-ggp-f` |
| `pat-ggp-f` | Hj. Kasuma | female | 1902-05-01 | 1980-12-25 | `pat-ggp-m` |
| `pat-buyut-f-ggp-m` | H. Harjo Santoso | male | 1899-04-12 | 1968-02-20 | `pat-buyut-f-ggp-f` |
| `pat-buyut-f-ggp-f` | Hj. Siti Rahayu | female | 1903-08-30 | 1982-10-05 | `pat-buyut-f-ggp-m` |
| `pat-nbuyut-ggp-m` | H. Prasetyo | male | 1897-06-01 | 1965-11-11 | `pat-nbuyut-ggp-f` |
| `pat-nbuyut-ggp-f` | Hj. Ani | female | 1900-12-15 | 1975-03-22 | `pat-nbuyut-ggp-m` |
| `pat-nbuyut-f-ggp-m` | H. Basuki | male | 1895-01-20 | 1960-07-08 | `pat-nbuyut-f-ggp-f` |
| `pat-nbuyut-f-ggp-f` | Hj. Rukmini | female | 1898-09-03 | 1978-01-14 | `pat-nbuyut-f-ggp-m` |

Extra: `pat-ggp-m` punya `photoUrl` (Unsplash) + `occupation: Petani & Pedagang`.

### B. Orang tua buyut — garis ibu (deceased)

| id | fullName | gender | birthDate | deathDate | spouseIds |
|---|---|---|---|---|---|
| `mat-ggp-m` | H. Surya Wijaya | male | 1898-11-01 | 1970-03-18 | `mat-ggp-f` |
| `mat-ggp-f` | Hj. Mira | female | 1901-08-01 | 1985-07-04 | `mat-ggp-m` |
| `mat-buyut-f-ggp-m` | H. Gunawan | male | 1896-05-18 | 1963-09-25 | `mat-buyut-f-ggp-f` |
| `mat-buyut-f-ggp-f` | Hj. Wulan | female | 1900-02-07 | 1979-12-01 | `mat-buyut-f-ggp-m` |
| `mat-nbuyut-ggp-m` | H. Iskandar | male | 1894-10-10 | 1958-04-30 | `mat-nbuyut-ggp-f` |
| `mat-nbuyut-ggp-f` | Hj. Melati | female | 1897-07-22 | 1971-08-16 | `mat-nbuyut-ggp-m` |
| `mat-nbuyut-f-ggp-m` | H. Darma | male | 1892-03-05 | 1955-06-12 | `mat-nbuyut-f-ggp-f` |
| `mat-nbuyut-f-ggp-f` | Hj. Sari | female | 1895-11-28 | 1973-02-09 | `mat-nbuyut-f-ggp-m` |

### C. Buyut (ortu kakek/nenek)

| id | fullName | parents (F/M) | birthDate | deathDate | spouse |
|---|---|---|---|---|---|
| `pat-buyut-m` | H. Ardhyansah | pat-ggp-m / pat-ggp-f | 1925-03-12 | 1998-08-20 | `pat-buyut-f` |
| `pat-buyut-f` | Hj. Suminah | pat-buyut-f-ggp-m / pat-buyut-f-ggp-f | 1928-07-04 | 2005-11-15 | `pat-buyut-m` |
| `pat-nbuyut-m` | H. Sutrisno | pat-nbuyut-ggp-m / pat-nbuyut-ggp-f | 1924-11-08 | 1996-05-17 | `pat-nbuyut-f` |
| `pat-nbuyut-f` | Hj. Kartini | pat-nbuyut-f-ggp-m / pat-nbuyut-f-ggp-f | 1927-02-19 | 2003-09-28 | `pat-nbuyut-m` |
| `mat-buyut-m` | H. Wijaya Kusuma | mat-ggp-m / mat-ggp-f | 1926-01-18 | 2001-04-09 | `mat-buyut-f` |
| `mat-buyut-f` | Hj. Dewi Lestari | mat-buyut-f-ggp-m / mat-buyut-f-ggp-f | 1930-09-22 | 2010-06-30 | `mat-buyut-m` |
| `mat-nbuyut-m` | H. Hartono | mat-nbuyut-ggp-m / mat-nbuyut-ggp-f | 1923-08-14 | 1994-12-03 | `mat-nbuyut-f` |
| `mat-nbuyut-f` | Hj. Sulastri | mat-nbuyut-f-ggp-m / mat-nbuyut-f-ggp-f | 1929-05-06 | 2008-07-19 | `mat-nbuyut-m` |

### D. Saudara buyut + pasangan

**Garis ayah** (anak `pat-ggp-m`/`pat-ggp-f`, deceased, deathDate `2015-01-01`):

| id | fullName | birth | spouse id / name |
|---|---|---|---|
| `pat-buyut-sib-1` | H. Karim Ardhyansah | 1923-06-01 | `pat-buyut-sib-1-sp` / Hj. Halimah (1925-01-01, **alive**) |
| `pat-buyut-sib-2` | Hj. Maryam | 1931-02-14 | `pat-buyut-sib-2-sp` / H. Yusuf (1925-01-01, **alive**) |

**Garis ibu** (anak `mat-ggp-m`/`mat-ggp-f`, deceased, deathDate `2018-03-01`):

| id | fullName | birth | spouse id / name |
|---|---|---|---|
| `mat-buyut-sib-1` | H. Slamet Wijaya | 1924-09-20 | `mat-buyut-sib-1-sp` / Hj. Kasih (1926-01-01, **alive**) |
| `mat-buyut-sib-2` | Hj. Siti Aminah | 1932-12-05 | `mat-buyut-sib-2-sp` / H. Rahman (1926-01-01, **alive**) |

### E. Kakek / nenek

| id | fullName | parents | birthDate | spouse | occupation |
|---|---|---|---|---|---|
| `pat-gp-m` | H. Wijaya | pat-buyut-m/f | 1950-05-08 | `pat-gp-f` | PNS |
| `pat-gp-f` | Hj. Ratna Sari | pat-nbuyut-m/f | 1953-12-01 | `pat-gp-m` | — |
| `mat-gp-m` | H. Agus Salim | mat-buyut-m/f | 1952-02-14 | `mat-gp-f` | Pedagang |
| `mat-gp-f` | Hj. Lestari | mat-nbuyut-m/f | 1955-08-27 | `mat-gp-m` | — |

### F. Saudara kakek/nenek + pasangan (alive)

**Ayah** — parents `pat-buyut-m`/`pat-buyut-f`:

| id | fullName | birth | spouse |
|---|---|---|---|
| `pat-gp-sib-1` | H. Bambang Wijaya | 1948-03-22 | `pat-gp-sib-1-sp` Hj. Suryani (1950-01-01) |
| `pat-gp-sib-2` | Hj. Endang | 1956-07-10 | `pat-gp-sib-2-sp` H. Herman (1950-01-01) |

**Ibu** — parents `mat-buyut-m`/`mat-buyut-f`:

| id | fullName | birth | spouse |
|---|---|---|---|
| `mat-gp-sib-1` | H. Candra Salim | 1949-11-05 | `mat-gp-sib-1-sp` Hj. Mirna (1952-01-01) |
| `mat-gp-sib-2` | Hj. Indah | 1958-04-18 | `mat-gp-sib-2-sp` H. Jaya (1952-01-01) |

### G. Generasi orang tua (anak kakek ayah / ibu)

**Anak `pat-gp-m`/`pat-gp-f` (6 orang):**

| id | fullName | birth | spouse | Extra |
|---|---|---|---|---|
| `pat-sib-1` | H. Tono Wijaya | 1970-04-03 | `pat-sib-1-sp` Hj. Yuni Hartati | address Surabaya |
| `pat-sib-2` | H. Joko Susilo | 1972-09-15 | `pat-sib-2-sp` Hj. Wati Indah | — |
| `father` | H. Budi Ardhyansah | 1975-01-20 | `mother` | nickname `Ayah`, phone, address Malang, occupation Wiraswasta |
| `pat-sib-3` | Hj. Siti Rahayu | 1977-06-11 | `pat-sib-3-sp` H. Eko Prasetyo | — |
| `pat-sib-4` | H. Rudi Hartono | 1979-11-28 | `pat-sib-4-sp` Hj. Nia Permata | — |
| `pat-sib-5` | Hj. Ani Wulandari | 1982-03-05 | `pat-sib-5-sp` H. Dimas Anggara | — |

Pasangan sibling default birthDate: `1975-01-01`.

**Anak `mat-gp-m`/`mat-gp-f` (7 orang):**

| id | fullName | birth | spouse | Extra |
|---|---|---|---|---|
| `mat-sib-1` | H. Agus Pratama | 1971-02-18 | `mat-sib-1-sp` Hj. Rina Melati | address Jakarta |
| `mat-sib-2` | Hj. Dewi Anggraini | 1973-07-25 | `mat-sib-2-sp` H. Bambang Setiawan | — |
| `mother` | Hj. Citra Maharani | 1976-10-12 | `father` | nickname `Ibu`, phone + phoneAlt, address Malang, Guru SD |
| `mat-sib-3` | H. Hendra Kusuma | 1978-04-30 | `mat-sib-3-sp` Hj. Fitri Handayani | — |
| `mat-sib-4` | Hj. Rina Safitri | 1980-12-08 | `mat-sib-4-sp` H. Yoga Mahendra | — |
| `mat-sib-5` | H. Fajar Nugroho | 1983-05-17 | `mat-sib-5-sp` Hj. Siska Amelia | — |
| `mat-sib-6` | Hj. Maya Sari | 1985-09-03 | `mat-sib-6-sp` H. Rizky Aditya | — |

### H. Cabang mertua (`me-sp`)

| id | fullName | birth / death | parents | spouse |
|---|---|---|---|---|
| `sp-pat-buyut-m` | H. Kirana | 1927-02-10 / 2000-05-12 | — | `sp-pat-buyut-f` |
| `sp-pat-buyut-f` | Hj. Mulyani | 1930-08-25 / 2008-01-03 | — | `sp-pat-buyut-m` |
| `sp-mat-buyut-m` | H. Santoso | 1929-06-18 / 2003-09-07 | — | `sp-mat-buyut-f` |
| `sp-mat-buyut-f` | Hj. Wulan | 1932-11-30 / 2012-04-22 | — | `sp-mat-buyut-m` |
| `sp-pat-gp-m` | H. Hartono | 1951-04-05 | sp-pat-buyut-* | `sp-pat-gp-f` |
| `sp-pat-gp-f` | Hj. Ani | 1954-10-20 | sp-pat-buyut-* | `sp-pat-gp-m` |
| `sp-mat-gp-m` | H. Basuki | 1953-07-14 | sp-mat-buyut-* | `sp-mat-gp-f` |
| `sp-mat-gp-f` | Hj. Sari | 1956-12-02 | sp-mat-buyut-* | `sp-mat-gp-m` |
| `sp-father` | H. Agus Kirana | 1978-03-08 | sp-pat-gp-* | `sp-mother` (nickname Ayah Pasangan, Dokter) |
| `sp-mother` | Hj. Melati | 1980-09-15 | sp-mat-gp-* | `sp-father` (nickname Ibu Pasangan) |

### I. Generasi root (`father`/`mother`) + anak

| id | fullName | nickname | birth | spouse | children | role / flags |
|---|---|---|---|---|---|---|
| `sib-1` | H. Andi Pratama | Kak Andi | 1998-03-14 | `sib-1-sp` Hj. Rina Oktavia (2000-01-01) | `sib-1-c1` Fadil Ardhyansah (2020-06-01), `sib-1-c2` Fira Maharani (2022-11-18) | member |
| `me` | Mochamad Irfani Ardhyansah | — | 1999-03-21 | `me-sp` Hj. Ayu Kirana | `me-c1` Zahra Kirana (2024-02-10), `me-c2` Zaki Ardhyansah (2023-09-05) | **admin**, `isSelf`, SE, phone, address Malang |
| `sib-2` | Hj. Sari Dewi | Adik Sari | 2002-01-07 | `sib-2-sp` H. Doni Saputra (2000-01-01) | `sib-2-c1` Kevin Saputra (2023-04-22), `sib-2-c2` Karin Saputra (2025-01-30) | member |
| `sib-3` | H. Bayu Nugroho | Adik Bayu | 2004-12-19 | `sib-3-sp` Hj. Lina Permata (2000-01-01) | `sib-3-c1` Reza Nugroho (2024-07-14), `sib-3-c2` Rani Nugroho (2025-03-08) | member |

`me-sp` parents = `sp-father` / `sp-mother`, nickname `Ayu`, birth `2001-05-17`, phone `081355566677`.

Parent assignment anak: ayah = id yang `gender=male` dari pasangan, ibu = yang `female`.

### J. Akun demo login (di luar pohon)

| id | fullName | birthDate | role | Extra |
|---|---|---|---|---|
| `demo-mr` | Mulyono Raka | 1945-08-17 | admin | phone, address Malang, occupation Pensiunan PNS |

Tidak punya `fatherId`/`motherId`/`spouseIds`.

---

## Field address yang terisi (untuk uji map)

| id | city | lat / lng |
|---|---|---|
| `father` | Kota Malang | -7.97 / 112.63 |
| `mother` | Kota Malang | -7.965 / 112.635 |
| `me` | Kota Malang | -7.9666 / 112.6326 |
| `demo-mr` | Kota Malang | -7.9666 / 112.6326 |
| `pat-sib-1` | Kota Surabaya | (tanpa coords) |
| `mat-sib-1` | DKI Jakarta | (tanpa coords) |

Detail street/district/postal lengkap ada di JSON.

---

## Shape record seeder (mirror FE `Person`)

```json
{
  "id": "me",
  "fullName": "Mochamad Irfani Ardhyansah",
  "nickname": null,
  "gender": "male",
  "birthDate": "1999-03-21",
  "deathDate": null,
  "status": "alive",
  "religion": null,
  "photoUrl": null,
  "occupation": "Software Engineer",
  "phone": "081112223344",
  "phoneAlt": null,
  "address": {
    "street": "...",
    "district": "Lowokwaru",
    "city": "Kota Malang",
    "province": "Jawa Timur",
    "postalCode": "65141",
    "country": "Indonesia",
    "latitude": -7.9666,
    "longitude": 112.6326
  },
  "fatherId": "father",
  "motherId": "mother",
  "spouseIds": ["me-sp"],
  "generationLabel": "Kamu",
  "isSelf": true,
  "role": "admin"
}
```

Enums:

- `gender`: `male` | `female`
- `status`: `alive` | `deceased`
- `religion`: `islam` | `other` | null
- `role`: `admin` | `member` | null

---

## Cara pakai untuk AI BE

### Prompt Part 1 (tempel)

```
Kerjakan PART 1 schema + seeder FamilyRoots.
Sumber data: docs/BE-MOCK-SEEDER.md + docs/seed/mock-family-seed.json
- Buat 1 family: family-ardhyansah-demo, rootPersonId = me
- Import semua 95 persons (hormati fatherId/motherId/spouseIds)
- Jangan simpan login code sebagai password; login code derived
- Setelah seed, verifikasi smoke:
  - count persons = 95
  - alive = 63, deceased = 32
  - login code demo-mr = MR170845
  - login code me = MIA210399
```

### Validasi pasca-seed (SQL / script)

```text
COUNT(*) persons == 95
COUNT status=alive == 63
COUNT status=deceased == 32
person id=me exists, is_self=true, role=admin
person id=demo-mr exists
spouse pairs == 43 (atau 86 rows junction jika disimpan 2 arah — pilih 1 model)
BuildLoginCode(demo-mr) == "MR170845"
BuildLoginCode(me) == "MIA210399"
BuildLoginCode(father) == "BA200175"
```

---

## Catatan penting untuk BE

1. **Jangan** hardcode hanya 5 orang “cukup untuk login” lalu abaikan pohon — FE tree/map butuh seluruh 95.
2. Beberapa pasangan sibling punya `birthDate` placeholder `1975-01-01` / `2000-01-01` — sengaja dari mock FE; ikut saja.
3. Dua orang bisa punya nama mirip di cabang berbeda (`Hj. Wulan`, `H. Hartono`, dll.) — bedakan by `id`.
4. Field `_computedLoginCode` di JSON **hanya dokumentasi/test**; hapus sebelum persist ke DB production schema.
5. Jika BE memakai UUID: simpan mapping `legacy_slug → uuid` agar relasi FK di JSON tetap bisa di-resolve.

---

## File terkait

| File | Isi |
|---|---|
| `docs/seed/mock-family-seed.json` | Full dump 95 persons + spouses + recommendedTestLogins |
| `src/data/mockFamilyData.ts` | Source of truth FE |
| `src/utils/loginCode.ts` | Algoritma login code (harus bit-identical di BE) |
| `docs/BE-AUTH-API-PLAN.md` | Rencana API auth (Part 1 memakai dokumen ini) |
