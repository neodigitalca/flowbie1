---
title: "Save Config"
slug: gmb/save-config
section: Google Business Profile
method: POST
path: /api/gmb/save-config
auth: open
order: 280
---

POST `/api/gmb/save-config`.

Runs the save config action in the Google Business Profile API from a JSON request body.

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
curl -X POST "https://neodigital.ca/api/gmb/save-config" \
  -H "Content-Type: application/json" \
  -d '{}'
```

```javascript
const res = await fetch(`/api/gmb/save-config`, {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({}),
});
const data = await res.json();
```
