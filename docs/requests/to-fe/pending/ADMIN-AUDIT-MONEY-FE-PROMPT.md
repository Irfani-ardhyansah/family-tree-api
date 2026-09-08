# Admin Audit Logs — include Money Track

## Perubahan BE

`GET /admin/audit-logs` sekarang **menggabungkan**:

| Source | Tabel | `moduleId` |
|--------|-------|------------|
| `admin` | `core_admin_audit_logs` | roots / core / admin / auth / … |
| `money` | `mt_audit_logs` (workspace family aktif) | selalu `"money"` |

Filter `moduleId=money` → hanya log Money Track.  
Tanpa `moduleId` → semua (admin + money), diurut `timestamp` desc.

### Item shape (tambahan)

```json
{
  "id": 55,
  "source": "money",
  "timestamp": "…",
  "userId": 1,
  "userName": "Irfan",
  "moduleId": "money",
  "action": "update",
  "summary": "Ubah pengeluaran Makan Rp 85.000 → Rp 90.000",
  "before": { … },
  "after": { … },
  "entityType": "transaction",
  "entityId": "55"
}
```

- `source`: `"admin"` | `"money"` (baru; FE lama boleh ignore)
- `entityType` / `entityId`: terisi hanya jika `source=money`

### Detail

Karena ID bisa bentrok antar tabel:

- `GET /admin/audit-logs/55?source=money`
- atau `GET /admin/audit-logs/money:55`

Tanpa `source` / prefix → dianggap log **admin** (backward compatible).

### FE saran

1. Tampilkan badge modul dari `moduleId` (filter Money Track sudah ada di enum).
2. Saat buka detail dari list, kirim `source` dari item (atau pakai `money:${id}`).
3. Opsional: deep-link Money Track `/money/audit?entityType=&entityId=` dari baris `source=money`.
