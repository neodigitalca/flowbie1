---
title: "Manual Domain"
slug: dataforseo/competitor-research/manual-domain
section: DataForSEO
method: POST
path: /api/dataforseo/competitor-research/manual-domain
auth: open
order: 100
---

POST `/api/dataforseo/competitor-research/manual-domain`.

Runs the manual domain action in the DataForSEO API from a JSON request body.

## Request

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `domain` | string | yes | Request body field |
| `siteUrl` | string | no | Request body field |

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
curl -X POST "https://flowbie.ca/api/dataforseo/competitor-research/manual-domain" \
  -H "Content-Type: application/json" \
  -d '{   "domain": "..." }'
```

```javascript
const res = await fetch(`/api/dataforseo/competitor-research/manual-domain`, {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
  "domain": "..."
}),
});
const data = await res.json();
```
