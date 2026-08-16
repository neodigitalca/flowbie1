---
title: Authentication
slug: getting-started/authentication
section: Getting started
order: 10
---

NEO Pulse uses a **session cookie** for authenticated requests.

## Session cookie

| Property | Value |
| --- | --- |
| Name | `neo_pulse_session` |
| HttpOnly | yes |
| SameSite | Lax |
| Secure | yes when served over HTTPS |

After a successful `POST /api/auth/login` or `POST /api/auth/register`, the server sets this cookie. Include it on subsequent requests.

## Which auth endpoint to use

| Situation | Endpoint |
| --- | --- |
| Fresh install, need tables + owner + agency | `POST /api/auth/setup-admin` |
| Empty user table only (no teams yet) | `POST /api/auth/bootstrap` |
| Normal sign-in | `POST /api/auth/login` |
| Invite link from email | `POST /api/auth/register` with `inviteToken` |
| End session | `POST /api/auth/logout` |
| Who am I? | `GET /api/auth/me` |

**setup-admin** runs DB migrations, creates or updates the owner user, and ensures an owner agency exists. **bootstrap** only creates the first user when the database has zero users. **register** accepts a team invite token and joins the invited agency.

## Browser clients

```javascript
await fetch("/api/auth/login", {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "you@example.com", password: "..." }),
});
```

## Current user

`GET /api/auth/me` returns the logged-in user, team list, and active team permissions. When no session exists, `user` is `null` but the response is still `200`.

## Team context

Many routes under `/api/teams/{teamId}/...` require:

1. A valid session
2. Membership on the team
3. Role permissions for the area (for example communication for chat)

Switch the active team with `POST /api/teams/{teamId}/switch`. The session stores the active team id for later calls.

## Public routes

Login, register, invite accept, bootstrap, and setup-admin do not require an existing session. See the Authentication section in the sidebar for field-level docs on each route.
