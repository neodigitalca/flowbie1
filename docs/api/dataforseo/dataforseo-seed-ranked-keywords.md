---
title: "Seed Ranked Keywords"
slug: dataforseo/seed-ranked-keywords
section: DataForSEO
method: POST
path: /api/dataforseo/seed-ranked-keywords
auth: open
order: 120
---

POST `/api/dataforseo/seed-ranked-keywords`.

Runs the seed ranked keywords action in the DataForSEO API from a JSON request body.

## Request

| Field | Type | Required | Description |
| --- | --- | --- | --- |
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
curl -X POST "https://neodigital.ca/api/dataforseo/seed-ranked-keywords" \
  -H "Content-Type: application/json" \
  -d '{}'
```

```javascript
const res = await fetch(`/api/dataforseo/seed-ranked-keywords`, {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({}),
});
const data = await res.json();
```
