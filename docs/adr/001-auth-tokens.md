# ADR 001 — Auth Tokens (JWT + Refresh)

**Status:** Accepted  
**Date:** 2026-07-19  
**Context:** FamilyRoots auth — login via derived family code, no password.

---

## Decision

Use **JWT access token** + **opaque refresh token** with rotation stored in DB.

| Token | TTL (env) | Storage client |
|---|---|---|
| Access | `ACCESS_TTL` (default 3600s) | Memory / sessionStorage |
| Refresh | `REFRESH_TTL_REMEMBER` (30d) or `REFRESH_TTL_SESSION` (1d) | localStorage if `remember=true`, else sessionStorage |

Algorithm: **HS256** with `JWT_SECRET`.

---

## Access token payload

```json
{
  "sub": 42,
  "familyId": 1,
  "iat": 1710000000,
  "exp": 1710003600
}
```

- `sub` = `persons.id` (integer)
- `familyId` = `persons.family_id`

No login code, email, or role in JWT — fetch via `/auth/me` when needed.

---

## Refresh token

- Random opaque string (32+ bytes, base64url)
- Store **SHA-256 hash** only in `refresh_tokens` table (Part 3 migration)
- On refresh: verify hash, revoke old row, issue new refresh + access (rotation)
- Logout: set `revoked_at`

Planned schema:

```
refresh_tokens
  id            bigint PK
  person_id     int FK
  token_hash    varchar(64) unique
  expires_at    timestamp
  revoked_at    timestamp nullable
  created_at    timestamp
```

---

## Login flow (Part 3)

1. Normalize input code (`trim`, uppercase, no spaces)
2. Validate format → 400 if invalid
3. Find alive person in family where `buildLoginCode(person) === normalized`
4. Not found / deceased → 401 `CODE_NOT_FOUND` (same message)
5. Issue access + refresh; log `auth.login` to `app_logs`

---

## Rate limiting (Part 3)

In-memory or Redis later: max **10 attempts / IP / 15 minutes** on `POST /auth/login`.

---

## Out of scope v1

- Login code column in DB (derived only)
- `login_code_override` for admin
- OAuth / cookie-only session without refresh
