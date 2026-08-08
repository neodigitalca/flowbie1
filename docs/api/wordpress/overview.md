---
title: WordPress overview
slug: wordpress/overview
section: WordPress
order: 5
---

The **wordpress** namespace talks to WordPress sites configured in Flowbie Integrations.

## Prerequisites

1. Add the site under **Dashboard → Properties** in the app (or via manager WordPress properties API).
2. Confirm connectivity with `POST /api/wordpress/test-connection` before bulk inventory or publish calls.

## Common tasks

| Task | Starting endpoint |
| --- | --- |
| List posts / pages | `wordpress/get-posts-list`, `wordpress/get-site-post-inventory` |
| Read or update content | `wordpress/get-post-content`, `wordpress/update-post` |
| SEO meta | `wordpress/update-overview-seo-item`, `wordpress/bulk-update-overview-seo` |
| Media | `wordpress/upload-media`, `wordpress/list-media` |

Routes are **open** on the server: Flowbie holds WordPress credentials; your client sends JSON action payloads, not WP application passwords directly.

See [Integrations overview](../integrations/overview) for how properties are stored.
