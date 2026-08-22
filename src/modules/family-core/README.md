# Family Core (`fc_`)

Dokumen Penting, master jenis dokumen, dan tipe event kalender.

Table prefix: `fc_`

## Routes

Base: `/api/v1/fc` (auth + `X-Module-Unlock` covering `core`)

- `GET /members`
- `GET|POST /document-types`, `PATCH|DELETE /document-types/:id`
- `GET|POST /calendar-event-types`, `PATCH|DELETE /calendar-event-types/:id`
- `GET|POST /documents`, `GET|PATCH|DELETE /documents/:id`
- `GET /documents/reminders`
