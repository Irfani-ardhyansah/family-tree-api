# Prompt FE — Integrasi Persons Import (job + progress)

Salin blok di bawah ke chat AI / ticket FE.

---

## Prompt

```
Kamu mengerjakan integrasi UI Import Persons di FamilyRoots FE.

## Konteks produk
User (admin keluarga) bisa upload CSV/JSON banyak person sekaligus.
Relasi tree dibentuk dengan mengisi ayah/ibu di baris anak:
- fatherTempId / motherTempId (ref ke tempId dalam file)
- spouseTempIds (pasangan)
JANGAN buat kolom/daftar children — anak muncul otomatis dari parent link.
Setelah import sukses, refresh GET /persons?view=tree (pola graph sama FE-API-INTEGRATION.md).

## Kontrak BE (sudah live)
Base: {API_BASE}/api/v1
Auth: Bearer access token
AuthZ: hanya role=admin untuk POST import + GET job. Template boleh semua login.

1) GET /persons/import/template
   → download CSV header (Content-Disposition attachment)

2) POST /persons/import?dryRun=true|false
   - multipart/form-data field `file` (.csv|.json), ATAU JSON body { dryRun, persons: [...] }
   - Response 202:
     {
       data: {
         jobId, status, dryRun, format,
         progress: { percent, processed, total },
         message, errors, result,
         createdAt, startedAt, finishedAt
       }
     }
   - status awal biasanya "queued"

3) GET /persons/import/jobs/:jobId
   - Poll tiap ~1 detik sampai status === "completed" | "failed"
   - Progress UI: progress.percent + message (user tidak perlu tahu detail tahap)
   - failed → tampilkan data.errors[] (row, tempId?, field?, message)
   - completed + dryRun → tampilkan result.preview, tombol Konfirmasi Import
   - completed + !dryRun → result.createdCount + result.idByTempId; lalu invalidate/refetch tree

## Flow UI wajib
1. Halaman/modal Import Persons (gate: hanya admin; hide/disable untuk member)
2. Tombol Download template → GET /import/template (atau static copy dari docs/templates/persons-import-template.csv)
3. Help singkat: "Isi ayah & ibu di baris anak pakai fatherTempId/motherTempId. Jangan isi daftar anak."
4. Link contoh: docs/templates/persons-import-example.csv
5. Dropzone accept .csv,.json
6. Tombol "Cek data" → POST dryRun=true → poll job → preview atau errors
7. Tombol "Import" disabled sampai dry-run completed valid → POST dryRun=false (file/payload sama) → poll dengan progress bar
8. Sukses → toast + redirect/refresh tree view
9. Handle 403 PERSON_IMPORT_FORBIDDEN, 401, file terlalu besar PERSON_IMPORT_TOO_LARGE

## Status job
queued | validating | importing | completed | failed

## Batas
- Max 200 rows
- Max file 2MB
- Atomic: kalau gagal validasi, tidak ada person baru; FE cukup percaya status job

## Types (TypeScript)
type PersonImportJobStatus = 'queued' | 'validating' | 'importing' | 'completed' | 'failed';

type PersonImportJobResponse = {
  jobId: string;
  status: PersonImportJobStatus;
  dryRun: boolean;
  format: 'csv' | 'json';
  progress: { percent: number; processed: number; total: number };
  message: string | null;
  errors: Array<{ row: number; tempId?: string; field?: string; message: string }>;
  result: {
    dryRun: boolean;
    rowCount: number;
    createdCount: number;
    idByTempId: Record<string, number>;
    preview: Array<{
      tempId: string;
      fullName: string;
      gender: 'male' | 'female';
      birthDate: string;
      fatherTempId: string | null;
      motherTempId: string | null;
      spouseTempIds: string[];
      fatherId: number | null;
      motherId: number | null;
      spouseIds: number[];
    }>;
    persons: Array<{
      id: number;
      tempId: string;
      fullName: string;
      fatherId: number | null;
      motherId: number | null;
      spouseIds: number[];
    }>;
  } | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
};

## Helper poll (contoh)
async function waitForImportJob(jobId: string, onProgress: (j: PersonImportJobResponse) => void) {
  for (;;) {
    const job = await api.get(`/persons/import/jobs/${jobId}`); // unwrap .data
    onProgress(job);
    if (job.status === 'completed' || job.status === 'failed') return job;
    await new Promise((r) => setTimeout(r, 1000));
  }
}

## Referensi repo API
- docs/PERSONS-IMPORT-API.md (spek penuh)
- docs/templates/persons-import-*.csv|json
- docs/FE-API-INTEGRATION.md § tree graph

## Acceptance criteria
- [ ] Admin bisa download template, dry-run, lihat error per baris
- [ ] Progress bar bergerak dari poll (percent/message)
- [ ] Commit import menambah nodes/edges di tree tanpa manual create
- [ ] Member tidak bisa akses aksi import (UI + BE 403)
- [ ] Tidak ada kolom children di template/UI copy
```

---

## Catatan singkat untuk PM / QA

| Cek | Expected |
|-----|----------|
| Upload example CSV dry-run | `completed`, preview 8 rows |
| Salah `fatherTempId` | `failed` + error row |
| Commit example | Tree punya kakek–nenek–ayah–ibu–anak |
| Login non-admin | 403 / tombol import hidden |
