---
title: "GET dataforseo/serp-dump/{filename}"
slug: dataforseo/serp-dump/filename
section: DataForSEO
method: GET
path: /api/dataforseo/serp-dump/{filename}
auth: open
order: 130
---

GET `/api/dataforseo/serp-dump/{filename}`.

Fetches a single serp dump item from the DataForSEO API.

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
curl -X GET "https://flowbie.ca/api/dataforseo/serp-dump/{filename}" \
  -H "Content-Type: application/json" \
```

```javascript
const res = await fetch(`/api/dataforseo/serp-dump/{filename}`, {
  method: "GET",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
});
const data = await res.json();
```
