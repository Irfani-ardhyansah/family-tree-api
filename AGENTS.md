# Project instructions — family-tree-api (BE / STB)

## Wajib: catatan deploy STB untuk setiap perubahan BE

Setiap perubahan yang mengubah **apa yang dijalankan STB** — perilaku API (endpoint
baru/berubah, shape response), migration, env, atau seed/data awal — **wajib**
disertai catatan deploy baru:

```
deploy/releases/pending/YYYY-MM-DD-nama-fitur.md
```

Salin dari `deploy/releases/_template.md`, isi 4 bagiannya (Env, Migration, Data
awal, Cek setelah naik), dan commit **bareng kode fiturnya**. Satu file per fitur.

- Jangan pindahkan sendiri ke `shipped/`. `scripts/deploy.sh` yang memindahkan
  setelah semua `curl` di "Cek setelah naik" lolos.
- Satu perintah per fence; HTTP 404/5xx dianggap gagal.
- Key env baru juga ditambahkan ke `.env.example` dan `.env.docker.example`.
  Kalau key sudah ada tapi nilainya berubah, tulis langkah manual mengubah
  `.env.docker` di STB.
- Lewati untuk docs-only, prompt FE di `docs/requests/`, dan refactor tanpa efek
  runtime/schema.

Ritual lengkap: `deploy/README.md`. Skill: `stb-deploy-notes`.

## Verifikasi sebelum selesai

- `npm run build` (tsc) dan `npm test` harus lolos.
- Kalau menambah migration: `npm run migrate` di lokal untuk verifikasi.
