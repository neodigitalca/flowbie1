---
title: "Setup Admin"
slug: auth/setup-admin
section: Authentication
method: POST
path: /api/auth/setup-admin
auth: public
order: 60
---

POST `/api/auth/setup-admin`.

Install tables and create or update owner account + agency team. No existing session is required. On success, returns `email`, `role`, `team`.

## Request

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `email` | string | yes | Request body field |
| `password` | string | yes | Request body field |
| `displayName` | string | no | Request body field |
| `teamName` | string | no | Request body field |
| `jobTitle` | string | no | Request body field |
| `setupKey` | string | no | Request body field |

## Response

| Field | Type | Description |
| --- | --- | --- |
| `ok` | varies | See handler response. |
| `email` | varies | See handler response. |
| `role` | varies | See handler response. |
| `team` | varies | See handler response. |

## Errors

| Status | error | Cause |
| --- | --- | --- |
| 400 | `Missing email or password` | Returned when validation or auth fails. |
| 403 | `Setup not allowed` | Returned when validation or auth fails. |
| 500 | `Could not create user` | Returned when validation or auth fails. |

## Example

```bash
curl -X POST "https://neodigital.ca/api/auth/setup-admin" \
  -H "Content-Type: application/json" \
  -d '{   "email": "you@example.com",   "password": "your-password" }'
```

```javascript
const res = await fetch(`/api/auth/setup-admin`, {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
  "email": "you@example.com",
  "password": "your-password"
}),
});
const data = await res.json();
```
