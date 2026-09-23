# Deploy ke STB

Naik versi tetap manual lewat SSH. Folder ini yang menandai fitur mana yang siap naik, dan apa yang harus dicek di server sebelum container di-build ulang.

Spek FE/BE tetap di `docs/requests/`. Jangan taruh catatan deploy di sana.

Agent di repo ini mengikuti [`.cursor/rules/stb-deploy-notes.mdc`](../.cursor/rules/stb-deploy-notes.mdc): selesai fitur yang mengubah API, migration, env, atau data, catatan `pending/` ikut dibuat di perubahan yang sama. Pindah ke `shipped/` hanya setelah STB benar-benar sudah naik.

## Tanda siap deploy

```
deploy/releases/
  pending/     # kode selesai, STB belum naik
  shipped/     # sudah compose up di STB dan health-nya ok
  _template.md
```

Satu file per fitur. Nama: `YYYY-MM-DD-nama-fitur.md` (salin dari `_template.md`).

Isi selalu empat bagian:

| Bagian | Arti |
|---|---|
| Env | Key baru yang harus ditambah manual ke `.env.docker` di STB. Contoh nilai ada di `.env.docker.example`. |
| Migration | Nama file migration. Di STB ini jalan sendiri saat container start. |
| Data awal | Hampir selalu "tidak ada". Nilai baru yang tetap lewat ENUM di migration, bukan seeder. |
| Cek setelah naik | Perintah yang dijalankan di STB setelah container hidup. |

File ini ikut commit bareng fiturnya. Ada file baru di `pending/` = belum naik STB.

Versi cukup tanggal di nama file. Tidak pakai tag semver.

## Saat fitur selesai (di laptop)

1. Salin template:

   ```bash
   cp deploy/releases/_template.md deploy/releases/pending/YYYY-MM-DD-nama-fitur.md
   ```

2. Isi empat bagian. Kalau tidak ada env / migration / data awal, tulis **Tidak ada.**
3. Commit bareng kode fiturnya, lalu push.

Data yang tetap (modul, status, jenis) jangan di seeder. Tambah sebagai konstanta TypeScript, dan migration yang memperluas ENUM hanya kalau kolom belum punya nilai itu. Setelah migration jalan di STB, nilai itu ada di database. `scripts/deploy.sh` tidak menjalankan seeder.

## Jangan nyalakan seed di STB

`RUN_SEED` di `.env.docker` tetap `false`. `scripts/deploy.sh` menolak jalan kalau nilainya `true`, dan tidak pernah memanggil seeder.

Seeder tetap manual (`npm run seed` di laptop untuk data demo). `01_mock_family_data` dan `02_events_memoriam_data` menghapus data lalu mengisi ulang. Jangan jalankan itu di STB.

`SKIP_MIGRATE` tetap `false`. Perintah deploy menolak jalan kalau nilainya `true`.

## Naik ke STB (SSH)

Dari laptop:

```bash
ssh <user>@<host-stb>
cd /path/ke/family-tree-api
```

Di STB, working tree harus bersih selain `.env.docker` (file itu di-ignore, tidak ikut `git pull`).

```bash
git status
git pull
bash scripts/deploy.sh
```

`npm run deploy` sama isinya. Perintah itu:

1. Menampilkan catatan di `deploy/releases/pending/`.
2. Berhenti kalau `.env.docker` belum punya key yang ada di `.env.docker.example`. Tambah key-nya (nilai contoh di file example), lalu jalankan ulang. File `.env.docker` yang sudah ada tidak ditimpa.
3. Berhenti kalau `RUN_SEED` atau `SKIP_MIGRATE` bernilai `true`.
4. `docker compose up -d --build`. Migration yang belum ada di database jalan sendiri saat container start. Kalau tidak ada migration baru, langkah itu hanya build dan nyalakan ulang.
5. Menunggu health check. Seeder tidak dijalankan.
6. Menjalankan setiap `curl` di bagian **Cek setelah naik** pada catatan `pending/`. HTTP 404 dan 5xx dihitung gagal. Status lain (termasuk 401 dan 403) berarti route-nya ada.
7. Kalau semua curl lolos, `git mv` semua catatan `pending/` ke `shipped/`, commit, dan push. Kalau ada yang gagal, file tetap di `pending/` dan penyebabnya ditulis di output.

Kalau container tidak sehat, lihat log:

```bash
docker compose --env-file .env.docker logs --tail=200 api
```

Kalau curl gagal, perbaiki di laptop, push, lalu di STB `git pull` dan `bash scripts/deploy.sh` lagi.

## Urutan singkat

1. Laptop: tulis catatan di `pending/` (termasuk curl di **Cek setelah naik**), commit, push.
2. STB: `ssh` → `git pull` → `bash scripts/deploy.sh`.
3. Kalau skrip selesai, catatan sudah pindah ke `shipped/`. Laptop: `git pull`.
