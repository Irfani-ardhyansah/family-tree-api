# Backup Export / Import — FE (SQL zip + JSON)

## Status BE

| Fitur | Endpoint | File |
|-------|----------|------|
| Export JSON (modules) | `POST /admin/backups` body `{ moduleIds: [...] }` | `.json` |
| Export **full DB SQL (zip)** | `POST /admin/backups` body `{ "format": "sql" }` | `.sql.zip` |
| Download attachment | `GET /admin/backups/:id/download` | sama dengan hasil export |
| Import | `POST /admin/backups/import` field `file` | `.json` **atau** `.sql.zip` / `.sql.gz` / `.sql` |

List item sekarang punya field **`format`**: `"json" | "sql"`.

Response create (202) / list item contoh SQL:
```json
{
  "data": {
    "id": "bak_…",
    "format": "sql",
    "moduleIds": [],
    "createdAt": "…",
    "status": "running",
    "downloadUrl": null,
    "errorMessage": null
  }
}
```

Setelah `status: "success"`, download lewat endpoint download (bukan buka `downloadUrl` di tab) → file `bak_….sql.zip` (isi 1 file `.sql`).

Import SQL response:
```json
{ "data": { "mode": "sql", "database": "family_tree" } }
```

Import JSON tetap `{ mode: "replace", … }` seperti sebelumnya.

**Peringatan SQL import:** overwrite **seluruh database** (semua family, tokens, money, dll.). User harus confirm keras + siap logout/login ulang.

---

## Perubahan FE (Backup page)

1. Tombol **Export SQL (full DB)** → `POST /admin/backups` `{ format: "sql" }`, poll sampai success, lalu download.
2. Export JSON tetap pakai checkbox `moduleIds`.
3. Download → selalu `GET /admin/backups/:id/download` (blob + save as). Labelkan `.sql.zip` vs `.json` dari `item.format`.
4. Import file `accept=".json,.sql,.sql.gz,.sql.zip,application/json,application/zip"`  
   Confirm berbeda:
   - JSON: ganti data family aktif (roots/core)
   - SQL: **overwrite seluruh DB**
5. Setelah import SQL sukses → force logout / hard reload.

```ts
export async function createSqlBackup() {
  return apiFetch('/admin/backups', {
    method: 'POST',
    body: JSON.stringify({ format: 'sql' }),
  });
}

export async function importBackupFile(file: File) {
  const fd = new FormData();
  fd.append('file', file);
  return apiFormFetch('/admin/backups/import', { method: 'POST', body: fd });
}
```

---

## CLI (file sama dengan GUI)

```bash
# Export (default .sql.zip)
npm run db:dump
npm run db:dump -- ./backups/server.sql.zip

# Restore file hasil GUI atau CLI
npm run db:restore -- ./backups/server.sql.zip
npm run db:restore -- ./path/dari-admin-download.sql.zip
```

Docker image API sudah include `mysql-client` + `zip`/`unzip` supaya dump/restore dari container jalan.
