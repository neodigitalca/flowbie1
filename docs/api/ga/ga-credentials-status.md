---
title: "Credentials Status"
slug: ga/credentials-status
section: Google Analytics
method: GET
path: /api/ga/credentials-status
auth: open
order: 150
---

GET `/api/ga/credentials-status`.

Reads credentials status from the Google Analytics API.

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
curl -X GET "https://neodigital.ca/api/ga/credentials-status" \
  -H "Content-Type: application/json" \
```

```javascript
const res = await fetch(`/api/ga/credentials-status`, {
  method: "GET",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
});
const data = await res.json();
```
