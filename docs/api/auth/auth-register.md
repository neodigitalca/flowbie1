---
title: "Register"
slug: auth/register
section: Authentication
method: POST
path: /api/auth/register
auth: public
order: 50
---

POST `/api/auth/register`.

Creates a user account from an invite token and signs the user in. No existing session is required.

## Request

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `inviteToken` | string | yes | Request body field |
| `email` | string | yes | Request body field |
| `password` | string | yes | Request body field |
| `displayName` | string | no | Request body field |

## Response

| Field | Type | Description |
| --- | --- | --- |
| `ok` | varies | See handler response. |

## Errors

| Status | error | Cause |
| --- | --- | --- |
| 400 | `Missing required fields` | Returned when validation or auth fails. |
| 400 | `Invalid or expired invite` | Returned when validation or auth fails. |
| 400 | `Email does not match invite` | Returned when validation or auth fails. |

## Example

```bash
curl -X POST "https://flowbie.ca/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{   "inviteToken": "invite-token",   "email": "you@example.com",   "password": "your-password" }'
```

```javascript
const res = await fetch(`/api/auth/register`, {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
  "inviteToken": "invite-token",
  "email": "you@example.com",
  "password": "your-password"
}),
});
const data = await res.json();
```
