---
title: "GET teams/{teamId}/tasks/tasks/({id})/files/({id})"
slug: teams/teamId/tasks/tasks/(id)/files/(id)
section: Teams
method: GET
path: /api/teams/{teamId}/tasks/tasks/({id})/files/({id})
auth: session-team
order: 1980
---

GET `/api/teams/{teamId}/tasks/tasks/({id})/files/({id})`.

Fetches a single files item from the Teams API. Requires a signed-in user who belongs to the team id in the path.

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
curl -X GET "https://neodigital.ca/api/teams/{teamId}/tasks/tasks/({id})/files/({id})" \
  -H "Content-Type: application/json" \
```

```javascript
const res = await fetch(`/api/teams/{teamId}/tasks/tasks/({id})/files/({id})`, {
  method: "GET",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
});
const data = await res.json();
```
