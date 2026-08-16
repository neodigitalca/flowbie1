---
title: "Catalog sync"
slug: wpengine/catalog-sync
section: WP Engine
method: POST
path: /api/wpengine/catalog/sync
auth: session
order: 20
---

POST `/api/wpengine/catalog/sync`.

Replaces the server-side SFTP catalog from the Customer List CSV (via `npm run sync:wpengine-catalog`). Passwords are stored server-side only.

## Request

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `rows` | array | yes | `{ site, host, port, username, password, isStaging? }[]` |

## Response

| Field | Type | Description |
| --- | --- | --- |
| `ok` | boolean | Success |
| `count` | number | Rows saved |
| `updatedAt` | string | ISO timestamp |
