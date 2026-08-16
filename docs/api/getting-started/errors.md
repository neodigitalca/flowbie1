---
title: Errors
slug: getting-started/errors
section: Getting started
order: 20
---

How NEO Pulse reports API failures: HTTP status codes, JSON error bodies, and what to do when a route is missing or validation fails.

## Not found

Unknown routes return **404** with:

```json
{
  "success": false,
  "error": "Not found",
  "path": "/api/unknown/path",
  "method": "GET"
}
```

## Worked example: failed login

Request:

```bash
curl -X POST "https://neodigital.ca/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"wrong@example.com","password":"bad"}'
```

Response **401**:

```json
{
  "ok": false,
  "error": "Invalid credentials"
}
```

Your client should read both `res.status` and the JSON `error` field. Do not treat the call as successful when `ok` is false.

## Auth errors

| Status | Typical cause |
| --- | --- |
| 401 | Invalid login credentials |
| 403 | Missing permission, bootstrap not allowed, setup blocked |

Auth handlers often use `{ "ok": false, "error": "..." }` instead of `success`.

## Validation

**400** responses include an `error` string describing missing or invalid fields.

## Server errors

**500** indicates an internal failure (for example database not installed). Retry after checking plugin activation.

## Client library tip

Always read the response body. Check both HTTP status and `ok` / `success` fields before treating a call as successful.
