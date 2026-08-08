---
title: "Google Images"
slug: dataforseo/google-images
section: DataForSEO
method: POST
path: /api/dataforseo/google-images
auth: open
order: 110
---

POST `/api/dataforseo/google-images`.

Runs the google images action in the DataForSEO API from a JSON request body.

## Request

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `keyword` | string | no | Request body field |

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
curl -X POST "https://flowbie.ca/api/dataforseo/google-images" \
  -H "Content-Type: application/json" \
  -d '{}'
```

```javascript
const res = await fetch(`/api/dataforseo/google-images`, {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({}),
});
const data = await res.json();
```
