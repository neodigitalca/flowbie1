---
title: "Generate Social Copy"
slug: gmb/generate-social-copy
section: Google Business Profile
method: POST
path: /api/gmb/generate-social-copy
auth: open
order: 220
---

POST `/api/gmb/generate-social-copy`.

Runs the generate social copy action in the Google Business Profile API from a JSON request body.

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
curl -X POST "https://flowbie.ca/api/gmb/generate-social-copy" \
  -H "Content-Type: application/json" \
  -d '{}'
```

```javascript
const res = await fetch(`/api/gmb/generate-social-copy`, {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({}),
});
const data = await res.json();
```
