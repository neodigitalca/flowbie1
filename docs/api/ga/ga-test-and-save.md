---
title: "Test And Save"
slug: ga/test-and-save
section: Google Analytics
method: POST
path: /api/ga/test-and-save
auth: open
order: 180
---

POST `/api/ga/test-and-save`.

Runs the test and save action in the Google Analytics API from a JSON request body.

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
curl -X POST "https://neodigital.ca/api/ga/test-and-save" \
  -H "Content-Type: application/json" \
  -d '{}'
```

```javascript
const res = await fetch(`/api/ga/test-and-save`, {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({}),
});
const data = await res.json();
```
