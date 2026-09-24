# fc-document-file-delete

Tanggal: 2026-09-24

Hapus scan dokumen penting yang sudah tersimpan (bukan hanya media pending).

## Env

Tidak ada.

## Migration

Tidak ada.

## Data awal

Tidak ada.

## Cek setelah naik

```bash
curl -fsS http://localhost:3000/api/v1/health
curl -sS -o /dev/null -w "%{http_code}" -X DELETE http://localhost:3000/api/v1/fc/documents/1/files/1
```
