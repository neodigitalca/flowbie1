---
title: "Callback"
slug: gmb/callback
section: Google Business Profile
method: GET
path: /api/gmb/callback
auth: open
order: 200
---

GET `/api/gmb/callback`.

Reads callback from the Google Business Profile API.

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
curl -X GET "https://neodigital.ca/api/gmb/callback" \
  -H "Content-Type: application/json" \
```

```javascript
const res = await fetch(`/api/gmb/callback`, {
  method: "GET",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
});
const data = await res.json();
```
