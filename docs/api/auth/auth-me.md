---
title: "Me"
slug: auth/me
section: Authentication
method: GET
path: /api/auth/me
auth: session
order: 40
---

GET `/api/auth/me`.

Reads me from the Authentication API. Requires a signed-in user with a valid flowbie_session cookie. On success, returns `username`, `user`, `id`, `email`, and related fields.

## Request

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| _(none)_ | — | — | No JSON body for GET requests. |

## Response

| Field | Type | Description |
| --- | --- | --- |
| `ok` | varies | See handler response. |
| `username` | varies | See handler response. |
| `user` | varies | See handler response. |
| `id` | varies | See handler response. |
| `email` | varies | See handler response. |
| `displayName` | varies | See handler response. |
| `avatarUrl` | varies | See handler response. |
| `teams` | varies | See handler response. |
| `name` | varies | See handler response. |
| `slug` | varies | See handler response. |
| `activeTeam` | varies | See handler response. |
| `permissions` | varies | See handler response. |

## Errors

| Status | error | Cause |
| --- | --- | --- |
| 4xx/5xx | varies | See HTTP status and `error` field in body. |

## Example

```bash
curl -X GET "https://flowbie.ca/api/auth/me" \
  -H "Content-Type: application/json" \
```

```javascript
const res = await fetch(`/api/auth/me`, {
  method: "GET",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
});
const data = await res.json();
```
