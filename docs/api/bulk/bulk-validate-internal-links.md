---
title: "Validate Internal Links"
slug: bulk/validate-internal-links
section: Bulk
method: POST
path: /api/bulk/validate-internal-links
auth: open
order: 80
---

POST `/api/bulk/validate-internal-links`.

Runs a bulk bulk operation from a JSON request body. Streams progress as NDJSON instead of a single JSON object.

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
curl -X POST "https://neodigital.ca/api/bulk/validate-internal-links" \
  -H "Content-Type: application/json" \
  -d '{}'
```

```javascript
const res = await fetch(`/api/bulk/validate-internal-links`, {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({}),
});
const data = await res.json();
```


## Notes

Returns `application/x-ndjson`. Read line-delimited JSON objects from the response body.
