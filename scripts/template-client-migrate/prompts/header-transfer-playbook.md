# Header transfer (staging chrome to Blind Magic)

Transfer the published Elementor header from blindswebsitet onto blindmagic.com post 101. Keep the new chrome. Bind Blind Magic facts and Blind Magic menu 39.

## Bind targets

- Destination header: `elementor_library` post `101` (`Navigation`)
- WP menu: term `39` (`navigation`)
- Email: `hello@blindmagic.com`
- Primary phone (one chrome slot): `(780) 484-2390`
- Sale bar: Blind Magic Promotions URL
- Logo: attachment ID from the Blind Magic 101 backup image widget

## Chain

1. Point EMCP at `https://blindswebsitet.wpenginepowered.com/wp-json/mcp/emcp-tools-server`. `mcp_auth`. `core-get-site-info` host must be `blindswebsitet.wpenginepowered.com`. Stop if not.
2. Find the published header (`_elementor_template_type=header`). Confirm it matches the custom-drapery chrome.
3. Export that header. Save `var/template-client-migrate/blindswebsitet.wpenginepowered.com/header-source.json`.
4. Point EMCP at `https://blindmagic.com/wp-json/mcp/emcp-tools-server`. `mcp_auth`. Host must be `blindmagic.com`. Stop if not.
5. Export Blind Magic `101` to `var/template-client-migrate/blindmagic.com/header-backup.json` before any write.
6. Rebind the source JSON with `header-json-rebind.mjs` (menu 39, Blind Magic logo, Promotions URL, strip DRC and staging hosts). From the repo root, `transfer-header.bat` prompts for those values and runs `npm run transfer-header`.
7. Write the rebound tree onto post `101`. Prefer a full `_elementor_data` replace. If EMCP import only appends, use the SFTP one-shot `update_post_meta`. Never Elementor `update_settings` on `init`.
8. Flush Elementor CSS. Delete post 101 `_elementor_element_cache`, `_elementor_css`, `_elementor_page_assets`, and `_elementor_controls_usage` so jet-mega-menu mounts.
9. Browser: Blind Magic homepage first, then an inner page. No DRC phone, no `info@drcentre.ca`, no blindswebsitet URLs in the header.

## Do not

- Copy staging mega-menu page links
- Invent a second phone bar for Sherwood Park
- Change page layouts or add sections
- Commit header JSON dumps or SFTP passwords
