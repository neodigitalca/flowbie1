# Template client migrate (one prompt)

Say **run template-client migrate**. Ask for these first. Do not invent answers.

1. Template site URL (the WordPress staging you are handing over)
2. New client site URL (source of truth)
3. EMCP URL (`https://<template-host>/wp-json/mcp/emcp-tools-server`)
4. SFTP host, user, port (password only in `WPE_SFTP_PASS`)
5. Brand folder on disk (logos, people photos). Empty path means no media upload this run. Do not invent photos.

Then run the chain in this order. Same template design. Client facts and media only.

## Chain

1. Point EMCP. From the repo root, run `template-client-migrate.bat` (or set `TEMPLATE_SITE_URL`, `CLIENT_SITE_URL`, `EMCP_URL`, `WPE_SFTP_HOST`, `WPE_SFTP_USER`, `WPE_SFTP_PORT`, `BRAND_FOLDER` and run `npm run template-client-migrate`). That writes `var/template-client-migrate/<slug>/job.json` (no password) and updates `emcp-neodigital-ca.url` in the user `mcp.json`.
2. Authenticate. `mcp_auth` on `user-emcp-neodigital-ca`. Call `core-get-site-info`. The site URL host must match the template host. If it does not, stop.
3. Dump live leftover identity on the template: ACF option keys and values, Elementor kit colors, team posts, locations, products, old company name, phones, emails, cities, leftover hex. Merge that dump into the job as `leftoverIdentity` and `acfKeys`. Use live field names. Do not assume `ci_*`.
4. Extract. If the job `client` block is empty, re-run the CLI after writing leftover into the job, or call extract again so replace pairs use leftover from plus client to.
5. Brand folder. If the path is set, classify files (`logo_dark`, `logo_white`, `logo_icon`, `person`, `other`). Match `person` to extracted team names only when the file supports it.
6. Upload. For each classified file, `emcp-tools-upload-media` with `filename` and base64 `data`. Write `attachment_id` onto the job. Map logos to live ACF logo fields. Map people to team featured images.
7. Apply identity. With `WPE_SFTP_PASS` set, the CLI uploads a one-shot mu-plugin: live ACF values, longest-first search-replace, kit colors via `update_post_meta` (never Elementor `update_settings` on `init`), same-length `#RRGGBB` replace, Elementor CSS flush.
8. People, locations, products. EMCP create, update, or delete using the job map and attachment IDs. Do not invent people beyond the client site and brand folder.
9. Review. Open the template **homepage** first. Then about, contact, team. Confirm old company, old phone, and old hex are gone. Colors match the client extract.

## Rules

- Password stays in `WPE_SFTP_PASS`. Never write it to `job.json` or commit it.
- Do not commit the brand folder or base64.
- Do not change layout, sections, or theme.
- Homepage is the first browser check.
- If schema parse fails, stop. Do not repair model JSON.
- If the EMCP host is wrong, stop.
