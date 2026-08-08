---
title: "Authorize"
slug: gmb/authorize
section: Google Business Profile
method: GET
path: /api/gmb/authorize
auth: open
order: 190
---

GET `/api/gmb/authorize`.

Reads authorize from the Google Business Profile API.

## Request

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| _(none)_ | — | — | No JSON body for GET requests. |

## Response

| Field | Type | Description |
| --- | --- | --- |
| `success` / `ok` | boolean | Operation status when present |
| `error` | string | Error message on failure |

## Errors

| Status | error | Cause |
| --- | --- | --- |
| 4xx/5xx | varies | See HTTP status and `error` field in body. |

## Example

```bash
curl -X GET "https://flowbie.ca/api/gmb/authorize" \
  -H "Content-Type: application/json" \
```

```javascript
const res = await fetch(`/api/gmb/authorize`, {
  method: "GET",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
});
const data = await res.json();
```
