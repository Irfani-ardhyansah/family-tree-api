# Web Push — Panduan Integrasi FE

BE sudah support Web Push (VAPID). Inbox API tetap sumber kebenaran; push = alert OS saat ada broadcast baru.

**Base:** `/api/v1/push`  
**Dev:** butuh HTTPS **atau** `localhost` (Chrome mengizinkan Push di localhost).

---

## Endpoint BE

| Method | Path | Auth | Keterangan |
|--------|------|------|------------|
| `GET` | `/push/vapid-public-key` | No | `{ publicKey, configured }` |
| `POST` | `/push/subscriptions` | Bearer | Simpan subscription browser |
| `DELETE` | `/push/subscriptions` | Bearer | Hapus subscription |

### Subscribe body

```json
{
  "endpoint": "https://fcm.googleapis.com/fcm/send/...",
  "keys": {
    "p256dh": "...",
    "auth": "..."
  }
}
```

Response `201`: `{ "id": 1, "endpoint": "..." }`

### Unsubscribe body

```json
{ "endpoint": "https://fcm.googleapis.com/fcm/send/..." }
```

---

## Payload yang dikirim BE ke Service Worker

```json
{
  "title": "Gathering Sabtu",
  "body": "Halo keluarga (plain text, HTML di-strip)",
  "data": {
    "url": "/inbox",
    "type": "broadcast",
    "broadcastId": 12
  }
}
```

---

## Checklist FE

1. **Service Worker** di root (mis. `/sw.js`) yang handle `push` + `notificationclick`.
2. Saat user login + opt-in:
   - `Notification.requestPermission()`
   - `GET /push/vapid-public-key` → `applicationServerKey`
   - `registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })`
   - `POST /push/subscriptions` dengan `JSON.stringify(subscription)` shape (`endpoint` + `keys`)
3. Saat logout / disable: `DELETE /push/subscriptions` + `subscription.unsubscribe()`.
4. Di SW `push`: `event.waitUntil(self.registration.showNotification(title, { body, data }))`.
5. Di `notificationclick`: buka `data.url` (default `/inbox`).

### Contoh SW (ringkas)

```js
self.addEventListener('push', (event) => {
  const payload = event.data ? event.data.json() : { title: 'Family Roots', body: '' };
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      data: payload.data ?? { url: '/inbox' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/inbox';
  event.waitUntil(clients.openWindow(url));
});
```

### Convert VAPID public key (Uint8Array)

Pakai helper `urlBase64ToUint8Array` standar Web Push sebelum `subscribe`.

---

## Env BE (sudah di `.env.example`)

```env
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:admin@familyroots.local
```

Generate ulang untuk production:

```bash
npx web-push generate-vapid-keys
```

Jika keys kosong → push **no-op** (inbox tetap jalan, tidak error).

---

## Alur end-to-end test

1. FE: user A enable push (permission + subscribe + POST subscription).
2. Admin kirim broadcast yang target user A (atau `all`).
3. BE: tulis `core_notifications` + kirim Web Push ke subscription user A.
4. OS menampilkan notifikasi; klik → `/inbox`.
5. `GET /notifications` tetap menampilkan item yang sama.

---

## Catatan

- Satu person bisa punya banyak device/subscription (endpoint unik).
- Subscription expired (410/404) otomatis dihapus BE.
- iOS Safari: butuh Add to Home Screen + iOS 16.4+ untuk Web Push.
- Jangan commit VAPID private key ke repo.
