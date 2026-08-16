---
title: "Match host keys"
slug: wpengine/matches
section: WP Engine
method: POST
path: /api/wpengine/matches
auth: session
order: 30
---

POST `/api/wpengine/matches`.

Match property hostnames to SFTP catalog rows. Returns host, port, username, and match status. Never returns passwords.

## Request

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `hostKeys` | string[] | yes | Normalized domain keys |
| `preferStaging` | boolean | no | Prefer staging rows when ambiguous |

## Response

| Field | Type | Description |
| --- | --- | --- |
| `ok` | boolean | Success |
| `matches` | object | Map of hostKey → `{ hostKey, catalogKey, host, port, username, isStaging, matchStatus }` |
