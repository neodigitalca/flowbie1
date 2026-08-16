---
title: "Catalog status"
slug: wpengine/catalog-status
section: WP Engine
method: GET
path: /api/wpengine/catalog/status
auth: open
order: 10
---

GET `/api/wpengine/catalog/status`.

Returns SFTP catalog row count, last sync time, and whether neo-pulse-wp is staged on the server for in-app deploy.

## Response

| Field | Type | Description |
| --- | --- | --- |
| `ok` | boolean | Always true when reachable |
| `rowCount` | number | SFTP catalog rows on server |
| `updatedAt` | string \| null | ISO timestamp of last catalog sync |
| `pluginStaged` | boolean | neo-pulse-wp tree present under uploads |
