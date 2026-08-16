---
title: "Process Schedule Queue"
slug: gmb/process-schedule-queue
section: Google Business Profile
method: POST
path: /api/gmb/process-schedule-queue
auth: open
order: 260
---

POST `/api/gmb/process-schedule-queue`.

Runs the process schedule queue action in the Google Business Profile API from a JSON request body.

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
curl -X POST "https://neodigital.ca/api/gmb/process-schedule-queue" \
  -H "Content-Type: application/json" \
  -d '{}'
```

```javascript
const res = await fetch(`/api/gmb/process-schedule-queue`, {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({}),
});
const data = await res.json();
```
