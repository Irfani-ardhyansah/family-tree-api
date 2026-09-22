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
| Data awal | Hampir selalu "tidak ada". Lihat peringatan seed di bawah. |
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

Data referensi yang wajib ada di server (jenis dokumen, tipe kalender, dan sejenisnya) tulis di **migration**, bukan seeder.

## Jangan nyalakan seed di STB

`RUN_SEED` di `.env.docker` tetap `false`.

`knex seed:run` menjalankan semua seeder. `01_mock_family_data` dan `02_events_memoriam_data` menghapus data lalu mengisi ulang data demo. Menyalakan `RUN_SEED=true` di STB menghapus data keluarga yang sudah dipakai.

`SKIP_MIGRATE` tetap `false`, kecuali schema memang sudah di-import dari dump SQL dan kamu sengaja tidak ingin Knex jalan.

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

# baca semua yang belum naik
ls deploy/releases/pending
# buka tiap file .md di situ
```

Kalau ada bagian **Env** yang bukan "Tidak ada":

```bash
# tambah key baru ke .env.docker
# jangan ubah RUN_SEED (tetap false) dan SKIP_MIGRATE (tetap false)
nano .env.docker
```

Lalu build dan nyalakan ulang. Migration jalan di dalam entrypoint sebelum proses API start.

```bash
docker compose --env-file .env.docker up -d --build
docker compose logs -f api
```

Tunggu log sampai ada `starting server`. `Ctrl+C` hanya berhenti mengikuti log, container tetap jalan. Lalu jalankan perintah di bagian **Cek setelah naik**, minimal:

```bash
curl -fsS http://localhost:3000/api/v1/health
```

Harapan: `{"status":"ok"}`.

Kalau health gagal, jangan pindahkan file ke `shipped/`. Lihat log:

```bash
docker compose logs --tail=200 api
```

## Setelah STB sehat (di laptop)

Pindahkan catatan fitur yang baru naik, dari laptop (bukan dari STB), lalu push. Pull berikutnya di STB hanya menggeser file markdown; tidak perlu build ulang hanya karena pindah folder.

```bash
git pull
git mv deploy/releases/pending/YYYY-MM-DD-nama-fitur.md deploy/releases/shipped/
git commit -m "Mark YYYY-MM-DD-nama-fitur shipped on STB."
git push
```

Kalau beberapa fitur naik dalam satu `compose up`, pindahkan semua file `pending/` yang ikut naik itu.

## Urutan singkat

1. Laptop: tulis catatan di `pending/`, commit, push.
2. STB: `ssh` → `git pull` → baca `pending/` → edit `.env.docker` kalau diminta → `docker compose --env-file .env.docker up -d --build`.
3. STB: health check (dan cek lain di catatan).
4. Laptop: `git mv` ke `shipped/`, commit, push.
