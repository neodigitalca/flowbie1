---
title: "Config Status"
slug: gmb/config-status
section: Google Business Profile
method: GET
path: /api/gmb/config-status
auth: open
order: 210
---

GET `/api/gmb/config-status`.

Reads config status from the Google Business Profile API.

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
curl -X GET "https://neodigital.ca/api/gmb/config-status" \
  -H "Content-Type: application/json" \
```

```javascript
const res = await fetch(`/api/gmb/config-status`, {
  method: "GET",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
});
const data = await res.json();
```
