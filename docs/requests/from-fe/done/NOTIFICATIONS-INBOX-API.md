# Notifications Inbox API — Request ke BE

## Konteks

Admin Broadcast v1 sudah menulis ke `core_notifications` (in-app).  
FE Admin bisa **kirim**, tapi user belum bisa **membaca** karena belum ada endpoint notifikasi untuk anggota.

Butuh API inbox agar broadcast muncul di FE (halaman `/inbox` + badge unread).

**Out of scope:** push notification, email, WebSocket realtime (boleh poll / refresh manual di v1).

---

## Endpoints usulan

Base: `/api/v1/notifications`  
Auth: Bearer + opsional `X-Session-Id` (sama seperti endpoint lain).  
Akses: user terautentikasi — **hanya notifikasi milik dirinya** (`person_id` = current user).

### 1. List notifikasi

`GET /api/v1/notifications`

**Query:**

| Param | Tipe | Default | Keterangan |
|-------|------|---------|------------|
| `page` | number | 1 | |
| `pageSize` | number | 20 | max 50 |
| `unreadOnly` | `true`/`false` | false | filter belum dibaca |

**Response `data`:**

```json
{
  "items": [
    {
      "id": 1,
      "title": "Gathering Sabtu",
      "body": "<p>Halo keluarga</p>",
      "type": "broadcast",
      "broadcastId": 12,
      "isRead": false,
      "readAt": null,
      "createdAt": "2026-07-27T10:00:00.000Z"
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 3,
  "unreadCount": 2
}
```

Pagination di dalam `data` (bukan top-level `meta`), konsisten dengan Admin Panel.

### 2. Unread count (untuk badge)

`GET /api/v1/notifications/unread-count`

```json
{ "unreadCount": 2 }
```

Dipanggil dari Launcher / Navbar tanpa load list penuh.

### 3. Tandai satu sebagai dibaca

`PATCH /api/v1/notifications/:id/read`

**Response `data`:** item notifikasi terbaru (`isRead: true`, `readAt` terisi).

Tolak jika bukan milik user → `404 NOT_FOUND` (jangan bocorkan existence).

### 4. Tandai semua dibaca

`POST /api/v1/notifications/read-all`

```json
{ "updated": 2 }
```

---

## Mapping dari `core_notifications` (referensi)

Asumsi kolom yang relevan (sesuaikan nama aktual di BE):

| Kolom | Field FE |
|-------|----------|
| `id` | `id` |
| `person_id` | (filter server-side) |
| `title` | `title` |
| `body` / `content` | `body` (HTML sudah di-sanitize saat broadcast) |
| `broadcast_id` | `broadcastId` |
| `type` / default | `type` (`broadcast` untuk sumber admin broadcast) |
| `read_at` null? | `isRead` / `readAt` |
| `created_at` | `createdAt` |

---

## Prioritas

1. `GET /notifications` + `GET /notifications/unread-count`
2. `PATCH /notifications/:id/read`
3. `POST /notifications/read-all`

Setelah endpoint live, FE `/inbox` langsung bisa consume (sudah disiapkan).

---

## Cara verifikasi cepat (setelah ship)

```bash
# Login sebagai penerima broadcast (bukan hanya admin)
TOKEN=...
SESSION=...

curl -s "http://localhost:3000/api/v1/notifications" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Session-Id: $SESSION" | python3 -m json.tool

curl -s "http://localhost:3000/api/v1/notifications/unread-count" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Session-Id: $SESSION" | python3 -m json.tool
```

Harus muncul row yang sama dengan:

```sql
SELECT id, person_id, title, broadcast_id, created_at
FROM core_notifications
WHERE person_id = <id penerima>
ORDER BY id DESC;
```
