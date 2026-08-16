---
title: "Overview"
slug: wpengine/overview
section: WP Engine
method: GET
path: /api/wpengine/
auth: open
order: 0
---

WP Engine SFTP catalog and in-app neo-pulse-wp deploy.

- Catalog sync: CLI `npm run sync:wpengine-catalog` (reads Customer List CSV)
- Match: POST `/api/wpengine/matches`
- Deploy: POST `/api/wpengine/deploy-plugin`

SFTP passwords never leave the server or appear in the browser.
