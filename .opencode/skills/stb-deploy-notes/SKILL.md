---
name: STB Deploy Notes
description: Use whenever you change this backend (new feature, endpoint, migration, env, or seed) — always add a STB deploy note under deploy/releases/pending in the same change. Also use when asked about shipping BE changes to STB.
---

# STB Deploy Notes

Repo ini adalah backend `family-tree-api` (server STB). Ritual lengkap: `deploy/README.md`. Template: `deploy/releases/_template.md`. Aturan Cursor: `.cursor/rules/stb-deploy-notes.mdc`.

## Aturan utama

**Setiap** perubahan yang mengubah apa yang dijalankan STB **wajib** disertai catatan deploy baru di `deploy/releases/pending/YYYY-MM-DD-nama-fitur.md` (tanggal hari ini), dibuat **bareng kode fiturnya**.

Yang mengubah runtime STB:
- perilaku API (endpoint baru/berubah, shape response),
- migration database,
- env (mis. `SECONDARY_UNLOCK_TTL`),
- seed / data awal.

## Kapan skip

- docs-only (mis. `docs/reference/*`, `docs/requests/*`),
- prompt/spec FE di `docs/requests/from-fe/...`,
- refactor tanpa efek runtime/schema.

## Isi catatan — 4 bagian, jangan dikurangi

Salin dari `deploy/releases/_template.md`. Tulis `Tidak ada.` bila bagian tidak berlaku.

1. **Env** — key baru + alasan. Tambahkan juga ke `.env.example` dan `.env.docker.example`. Kalau key **sudah ada** tapi nilainya berubah, tulis langkah manual mengubah `.env.docker` di STB (file itu tidak ikut git). Jangan tulis nilai rahasia.
2. **Migration** — nama file di `src/database/migrations/`. Di STB jalan otomatis saat container start (`SKIP_MIGRATE` tetap `false`).
3. **Data awal** — hampir selalu `Tidak ada.` Nilai tetap (modul/status/kind) = konstanta TypeScript + migration ENUM, **bukan** seeder. Jangan set `RUN_SEED=true`.
4. **Cek setelah naik** — `curl` di dalam bash fence, **satu perintah per fence**. `scripts/deploy.sh` menjalankan tiap curl; HTTP 404 & 5xx = gagal. Minimal cek health, plus endpoint fitur (harapan `401` = route hidup).

## Jangan

- **Jangan** `git mv` ke `shipped/` sendiri — `scripts/deploy.sh` yang memindahkan setelah semua curl lolos.
- Jangan taruh catatan deploy di `docs/requests/`.
- Satu file per fitur.

## Saat menyelesaikan perubahan

Langkah rutin:
1. Implement kode + (kalau ada) migration:

   ```bash
   npm run migrate:make nama_migrasi
   ```

2. Buat catatan pending dengan isi 4 bagian di atas (jangan pindah ke `shipped/`).
3. `npm run build` + `npm test`; kalau ada migration baru, `npm run migrate` di lokal untuk verifikasi.
4. Di ringkasan jawaban, sebutkan: file catatan `pending/` yang dibuat, migration baru, dan env yang perlu diubah manual di STB.
