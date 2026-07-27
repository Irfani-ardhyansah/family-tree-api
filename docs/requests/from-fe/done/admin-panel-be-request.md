# Admin Panel — Request Kontrak API (BE)

Dokumen ini merangkum kebutuhan backend untuk Admin Panel FE (UI sudah ada, data masih mock).  
Auth asumsi: JWT / session existing + flag `isAdmin` atau `role === 'admin'` dari `/auth/me`.

**Base path usulan:** `/api/v1/admin`  
**Akses:** hanya family admin. Non-admin → `403 Forbidden`.

### Scope FE saat ini (v1)

| Fitur | Status FE | Butuh BE sekarang? |
|-------|-----------|--------------------|
| Dashboard | Live (mock) | Ya |
| Status Modul | Live (mock) | Ya |
| Audit Log | Live (mock) | Ya |
| Session Management | Live (mock) | Ya |
| Broadcast | Live (mock) | Ya |
| Pengaturan | Live (mock) | Ya |
| Backup & Export | Live (mock) | Ya |
| **RBAC Modul (by umur)** | **UI disembunyikan** | **Tidak — defer** |

---

## Konvensi umum

### Response envelope (disarankan)

```json
{
  "data": {},
  "meta": { "page": 1, "pageSize": 20, "total": 100 },
  "error": null
}
```

### Error

```json
{
  "data": null,
  "error": {
    "code": "FORBIDDEN",
    "message": "Admin access required"
  }
}
```

| HTTP | Code contoh | Kapan |
|------|-------------|--------|
| 401 | `UNAUTHORIZED` | Token invalid/expired |
| 403 | `FORBIDDEN` | Bukan admin |
| 404 | `NOT_FOUND` | Resource tidak ada |
| 409 | `CONFLICT` | Konflik bisnis |
| 422 | `VALIDATION_ERROR` | Payload tidak valid |

### Module IDs (sinkron FE)

`roots` | `core` | `money` | `household`

---

## 1. Dashboard summary

`GET /admin/dashboard`

**Response `data`:**

```json
{
  "userCount": 42,
  "activeSessionCount": 7,
  "modulesEnabled": 3,
  "modulesTotal": 4,
  "recentLogs": [ /* AuditLogEntry[], max 5–10 */ ]
}
```

---

## 2. Status Modul (on/off global)

### List

`GET /admin/modules/status`

```json
{
  "items": [
    {
      "moduleId": "money",
      "enabled": false,
      "updatedAt": "2026-07-26T10:00:00.000Z",
      "updatedBy": "Admin Irfan"
    }
  ]
}
```

### Toggle

`PATCH /admin/modules/{moduleId}/status`

```json
{ "enabled": false }
```

**Response:** object status terbaru (sama shape item di atas).

**Side-effect wajib:**

- Bump **permission / access version** (atau invalidasi cache akses modul).
- User lain re-fetch permission saat refresh token / next authenticated request (boleh logout paksa hanya jika policy mengharuskan).
- Tulis audit log `toggle_module`.

---

## 3. Audit Log

`GET /admin/audit-logs`

**Query:**

| Param | Tipe | Keterangan |
|-------|------|------------|
| `q` | string | search keyword di summary / user |
| `userId` | string | filter user |
| `moduleId` | string | `roots\|core\|money\|household\|admin\|auth` |
| `action` | string | lihat enum di bawah |
| `from` | ISO date | inclusive |
| `to` | ISO date | inclusive |
| `page` | number | default 1 |
| `pageSize` | number | default 20 |

**Action enum (v1):**

`create` | `update` | `delete` | `login` | `logout` | `toggle_module` | `force_logout` | `broadcast` | `backup` | `settings`

**Item:**

```json
{
  "id": "uuid",
  "timestamp": "2026-07-26T10:00:00.000Z",
  "userId": "uuid",
  "userName": "Admin Irfan",
  "moduleId": "admin",
  "action": "toggle_module",
  "summary": "Money Track dimatikan",
  "before": { "enabled": true },
  "after": { "enabled": false }
}
```

`GET /admin/audit-logs/{id}` — detail lengkap (opsional jika list sudah lengkap).

---

## 4. Session Management

### List sesi aktif

`GET /admin/sessions`

**Query:** `userId` (opsional)

```json
{
  "items": [
    {
      "id": "session-uuid",
      "userId": "uuid",
      "userName": "Budi Santoso",
      "device": "iPhone 15",
      "browser": "Safari iOS",
      "ipAddress": "114.5.x.x",
      "loggedInAt": "2026-07-26T08:00:00.000Z",
      "lastActiveAt": "2026-07-26T12:00:00.000Z",
      "isCurrent": false
    }
  ]
}
```

`isCurrent`: true jika session token request = session tersebut.

### Force logout

`POST /admin/sessions/{sessionId}/revoke`

**Side-effect:**

- Invalidate refresh token / session store
- Audit `force_logout`
- Tolak revoke session sendiri dengan `422` / `409` (`CANNOT_REVOKE_CURRENT_SESSION`) — FE sudah disable tombol untuk sesi sendiri

---

## 5. Broadcast / Notifikasi

### List riwayat

`GET /admin/broadcasts`

### Kirim / jadwalkan

`POST /admin/broadcasts`

```json
{
  "title": "Gathering Sabtu",
  "body": "<p>HTML sederhana / sanitized</p>",
  "target": "all",
  "targetUserIds": [],
  "scheduledAt": null
}
```

- `target`: `all` | `selected`
- jika `selected` → `targetUserIds` wajib non-empty
- `scheduledAt`: ISO datetime atau `null` (kirim langsung)

**Response item:**

```json
{
  "id": "uuid",
  "title": "Gathering Sabtu",
  "body": "<p>...</p>",
  "target": "all",
  "targetUserIds": [],
  "targetLabel": "Semua anggota",
  "scheduledAt": null,
  "sentAt": "2026-07-26T10:00:00.000Z",
  "status": "sent",
  "createdAt": "2026-07-26T10:00:00.000Z"
}
```

`status`: `sent` | `scheduled` | `failed`

**Catatan:** delivery channel (in-app / push / email) bebas BE; FE hanya butuh status + riwayat.

Helper list user untuk multi-select:

`GET /admin/users?for=broadcast` → `{ id, name }[]`  
(atau reuse endpoint person list existing dengan scope family)

---

## 6. App Config / Settings

`GET /admin/settings`

`PUT /admin/settings`

```json
{
  "familyName": "Keluarga Ardhyansah",
  "timezone": "Asia/Jakarta",
  "currency": "IDR",
  "logoUrl": "https://cdn.example.com/logo.png"
}
```

Upload logo (opsional terpisah):

`POST /admin/settings/logo` — `multipart/form-data` field `file`  
→ `{ "logoUrl": "..." }`

Audit action: `settings`.

---

## 7. Backup & Export

### List riwayat

`GET /admin/backups`

```json
{
  "items": [
    {
      "id": "uuid",
      "moduleIds": ["roots", "money"],
      "createdAt": "2026-07-20T10:00:00.000Z",
      "status": "success",
      "downloadUrl": "https://...",
      "errorMessage": null
    }
  ]
}
```

`status`: `success` | `failed` | `running`

### Trigger

`POST /admin/backups`

```json
{ "moduleIds": ["roots", "money"] }
```

- Proses boleh async: return job `status: running`, FE poll `GET /admin/backups/{id}` (atau list).
- `downloadUrl` signed URL berwaktu.
- Audit `backup`.

---

## Prioritas implementasi BE (v1)

1. **Authz admin** di semua `/admin/*`
2. **Module status** + permission version bump
3. **Audit log** (write path dulu, read + filter kemudian)
4. **Sessions revoke**
5. **Broadcast**
6. **Settings**
7. **Backup** (boleh paling belakangan; job queue)

---

## Out of scope v1

- **RBAC Modul by umur** — UI FE disembunyikan; kontrak ada di lampiran bawah, kerjakan di iterasi berikutnya
- CRUD persons dari Admin Panel (sudah ada di Family Roots)
- Maintenance mode
- Role matrix lebih dari `admin | member`

---

## Mapping ke FE mock (v1)

Layer FE saat ini: `src/modules/admin/api/adminApi.ts` (mock delay).  
Setelah endpoint siap, ganti implementasi fungsi di file itu ke `apiFetch` tanpa mengubah page components.

| FE function | Endpoint usulan |
|-------------|-----------------|
| `fetchAdminDashboard` | `GET /admin/dashboard` |
| `fetchModuleStatuses` / `toggleModuleStatus` | `GET/PATCH .../modules` |
| `fetchAuditLogs` | `GET /admin/audit-logs` |
| `fetchSessions` / `forceLogoutSession` | `/admin/sessions` |
| `fetchBroadcasts` / `sendBroadcast` | `/admin/broadcasts` |
| `fetchSettings` / `saveSettings` | `/admin/settings` |
| `fetchBackups` / `triggerBackup` | `/admin/backups` |

---

## Lampiran — Defer: RBAC Modul by umur (v2)

> **Jangan dikerjakan di v1.** FE belum expose menu ini. Disimpan agar kontrak tidak hilang.

Satu modul boleh punya **banyak rule** (rentang umur).

### List

`GET /admin/rbac/age-rules`

```json
{
  "items": [
    {
      "id": "uuid",
      "moduleId": "money",
      "minAge": 17,
      "maxAge": null,
      "note": "Akses keuangan usia dewasa",
      "isActive": true,
      "updatedAt": "2026-07-26T10:00:00.000Z"
    }
  ]
}
```

`maxAge: null` = tanpa batas atas.

### Create

`POST /admin/rbac/age-rules`

```json
{
  "moduleId": "money",
  "minAge": 17,
  "maxAge": null,
  "note": "opsional",
  "isActive": true
}
```

### Update

`PATCH /admin/rbac/age-rules/{id}`

Field parsial: `moduleId`, `minAge`, `maxAge`, `note`, `isActive`.

### Delete

`DELETE /admin/rbac/age-rules/{id}`

**Validasi BE:**

- `minAge >= 0`
- jika `maxAge != null` maka `minAge <= maxAge`
- (opsional) deteksi overlap rentang aktif pada modul yang sama

**Enforcement (runtime, di luar admin UI):**

- Saat user login / refresh, hitung umur dari DOB → filter modul yang boleh diakses.
- Gabungkan dengan status modul global (`enabled`).

**FE mapping (nanti):** `fetchAgeRules` / `createAgeRule` / `updateAgeRule` / `deleteAgeRule` → `/admin/rbac/age-rules`
