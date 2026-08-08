---
title: "Maps Serp Batch"
slug: grid-local/maps-serp-batch
section: Grid Local
method: POST
path: /api/grid-local/maps-serp-batch
auth: open
order: 320
---

POST `/api/grid-local/maps-serp-batch`.

Runs the maps serp batch action in the Grid Local API from a JSON request body.

## Request

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| _(optional)_ | object | no | JSON body shape depends on the action. |

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
curl -X POST "https://flowbie.ca/api/grid-local/maps-serp-batch" \
  -H "Content-Type: application/json" \
  -d '{}'
```

```javascript
const res = await fetch(`/api/grid-local/maps-serp-batch`, {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({}),
});
const data = await res.json();
```
