---
title: "Status"
slug: gmb/status
section: Google Business Profile
method: GET
path: /api/gmb/status
auth: open
order: 290
---

GET `/api/gmb/status`.

Reads status from the Google Business Profile API.

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
curl -X GET "https://flowbie.ca/api/gmb/status" \
  -H "Content-Type: application/json" \
```

```javascript
const res = await fetch(`/api/gmb/status`, {
  method: "GET",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
});
const data = await res.json();
```
