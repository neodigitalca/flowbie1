---
title: "Login"
slug: auth/login
section: Authentication
method: POST
path: /api/auth/login
auth: public
order: 20
---

POST `/api/auth/login`.

Authenticates a user with email and password, sets the flowbie_session cookie, and returns basic profile fields.

## Request

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `username` | string | no | Request body field |
| `email` | string | no | Request body field |
| `password` | string | no | Request body field |

## Response

| Field | Type | Description |
| --- | --- | --- |
| `ok` | varies | See handler response. |
| `user` | varies | See handler response. |
| `username` | varies | See handler response. |
| `email` | varies | See handler response. |
| `displayName` | varies | See handler response. |
| `sessionToken` | varies | See handler response. |

## Errors

| Status | error | Cause |
| --- | --- | --- |
| 401 | `Invalid credentials` | Returned when validation or auth fails. |

## Example

```bash
curl -X POST "https://flowbie.ca/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{}'
```

```javascript
const res = await fetch(`/api/auth/login`, {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({}),
});
const data = await res.json();
```
