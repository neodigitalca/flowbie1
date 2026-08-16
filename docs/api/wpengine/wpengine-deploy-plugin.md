---
title: "Deploy neo-pulse-wp"
slug: wpengine/deploy-plugin
section: WP Engine
method: POST
path: /api/wpengine/deploy-plugin
auth: session
order: 40
---

POST `/api/wpengine/deploy-plugin`.

Upload staged neo-pulse-wp from server storage to a client site via SFTP.

## Request

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `hostKey` | string | yes | Catalog domain key (e.g. `blindmagic.com`) |
| `environment` | string | no | `production` (default) or `staging` |

## Response

| Field | Type | Description |
| --- | --- | --- |
| `ok` | boolean | Deploy succeeded |
| `site` | string | Catalog domain |
| `filesUploaded` | number | Files uploaded |
| `error` | string | Error message on failure |
