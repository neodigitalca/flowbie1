---
title: "Templates"
slug: teams/teamId/tasks/templates
section: Teams
method: POST
path: /api/teams/{teamId}/tasks/templates
auth: session-team
order: 2080
---

POST `/api/teams/{teamId}/tasks/templates`.

Bulk replace all team templates. Requires `{ "templates": [...] }`.

## Upsert one template

POST `/api/teams/{teamId}/tasks/templates/upsert`

```json
{
  "template": {
    "keyword": "monthly-seo",
    "name": "Monthly SEO",
    "defaultTasks": [
      { "keyword": "audit", "title": "Monthly SEO Audit", "status": "todo", "clientSiteId": null }
    ]
  }
}
```

## Delete template

DELETE `/api/teams/{teamId}/tasks/templates/{keyword}`

## Save from project

POST `/api/teams/{teamId}/tasks/templates/from-project`

```json
{ "projectId": 12, "name": "Monthly SEO", "keyword": "monthly-seo" }
```

## Create project with template + clients

POST `/api/teams/{teamId}/tasks/projects`

```json
{
  "title": "Monthly Tasks",
  "wordpressSiteId": "site-id",
  "wordpressSites": [{ "id": "site-id", "name": "Advance Blinds" }],
  "defaultTasks": [
    { "keyword": "audit", "title": "Monthly SEO Audit", "clientSiteId": "site-id" }
  ]
}
```

Task titles support `{client}` substitution or append `" — ClientName"` when a client is assigned.

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
curl -X POST "https://neodigital.ca/api/teams/{teamId}/tasks/templates" \
  -H "Content-Type: application/json" \
  -d '{}'
```

```javascript
const res = await fetch(`/api/teams/{teamId}/tasks/templates`, {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({}),
});
const data = await res.json();
```
