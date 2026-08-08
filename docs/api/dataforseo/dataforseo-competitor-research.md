---
title: "Competitor Research"
slug: dataforseo/competitor-research
section: DataForSEO
method: POST
path: /api/dataforseo/competitor-research
auth: open
order: 90
---

POST `/api/dataforseo/competitor-research`.

Runs the competitor research action in the DataForSEO API from a JSON request body.

## Request

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `siteUrl` | string | no | Request body field |
| `displayLimit` | string | no | Request body field |
| `portfolioBlockedHosts` | string | no | Request body field |
| `enrichmentLimit` | string | no | Request body field |

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
curl -X POST "https://flowbie.ca/api/dataforseo/competitor-research" \
  -H "Content-Type: application/json" \
  -d '{}'
```

```javascript
const res = await fetch(`/api/dataforseo/competitor-research`, {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({}),
});
const data = await res.json();
```
