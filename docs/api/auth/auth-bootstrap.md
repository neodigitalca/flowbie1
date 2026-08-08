---
title: "Bootstrap"
slug: auth/bootstrap
section: Authentication
method: POST
path: /api/auth/bootstrap
auth: public
order: 10
---

POST `/api/auth/bootstrap`.

First account when no users exist yet. No existing session is required.

## Request

| Field | Type | Required | Description |
| --- | --- | --- | --- |
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
| 403 | `Bootstrap not available` | Returned when validation or auth fails. |
| 400 | `Missing required fields` | Returned when validation or auth fails. |
| 500 | `Could not create user. Reactivate flowbie-app plugin.` | Returned when validation or auth fails. |

## Example

```bash
curl -X POST "https://flowbie.ca/api/auth/bootstrap" \
  -H "Content-Type: application/json" \
  -d '{   "email": "you@example.com",   "password": "your-password" }'
```

```javascript
const res = await fetch(`/api/auth/bootstrap`, {
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
