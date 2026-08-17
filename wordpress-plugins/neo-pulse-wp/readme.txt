=== NEO Pulse WP ===
Contributors: neo-pulse
Requires at least: 5.8
Tested up to: 6.7
Requires PHP: 7.4
Stable tag: 0.8.1
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Companion plugin: chat, search, SEO tools, and in-editor AI wands for WordPress.

== Description ==

NEO Pulse WP runs standalone on each WordPress site. API keys load from the plugin `.env` file (filled before deploy) or **NEO Pulse WP → Settings**. Includes **NEO Pulse AI wands** on post and entity edit screens, Flow Assist chat, AI search, and SEO tooling.

== Frequently Asked Questions ==

= How do editor AI wands work? =

On **post** and **entity** edit screens, open **NEO Pulse AI** (block sidebar or classic meta box), then **Content Optimizer** (or the meta editor from the snippet card). Use a wand on a field there to **Preview**, then **Apply**. The browser calls your WordPress REST API (`/wp-json/neo-pulse/v1/ai/*`); **OpenRouter runs from PHP** on your server (`wp_remote_post` to openrouter.ai). No NEO Pulse Node hop and no API keys in the browser.

**Requirements:** OpenRouter key in plugin `.env`, wp-config, or **NEO Pulse WP → Settings → Editor AI**. Optional wp-config overrides: `NEO_PULSE_WP_OPENROUTER_API_KEY` / `NEO_PULSE_WP_OPENROUTER_MODEL`.

**Wands (v0.8):** Title, Focus keyword, Meta/excerpt, SEO research, FAQ, Page URL. Apply updates Rank Math meta, core title/excerpt, and custom fields (NEO Pulse Fields or legacy ACF meta); sets `date_modifier` for optimization counting.

= Body optimizer (harness, block editor) =

Requires non-empty **seo_research**, **focus keyword**, and OpenRouter via **wp-config**, plugin **.env**, or **NEO Pulse WP → Settings**.

In the post editor **NEO Pulse AI** sidebar:

1. **Plan sections** — builds checklist + blueprint (OpenRouter on your server).
2. **Run all previews** or preview one section at a time.
3. **Apply** — updates the matching H2 in the block editor and saves the post; counts toward optimization usage.

Progress appears in the sidebar section list, the document **Body harness** panel, and badges on each **H2** block in the canvas.

REST: `POST /neo-pulse/v1/ai/body/plan`, `GET|DELETE /neo-pulse/v1/ai/body/session`, `POST /neo-pulse/v1/ai/body/section/preview`, `POST /neo-pulse/v1/ai/body/section/apply`.

= Does NEO Pulse WP include custom fields? =

Yes. **NEO Pulse Fields** is built into NEO Pulse WP and replaces Advanced Custom Fields for client sites. Under **NEO Pulse WP → Field Groups** you can manage field groups, import/export ACF-compatible JSON, and register post types, taxonomies, and options pages. The plugin provides `get_field()` / `update_field()` and renders fields on edit screens with ACF-compatible markup for NEO Pulse AI wands.

**Import:** **NEO Pulse WP → Fields Tools → Import JSON** (or **Import starter config** for bundled NEO Pulse Page / Post / Our Work groups). Use **Gallery** for one-click site templates: **Window Coverings** (field groups, CPTs, taxonomies, Contact Information options page) and **SMB Starter** (NEO Pulse page/post fields, service areas, our work, taxonomy). Deactivate the separate ACF plugin to avoid conflicts.

= What is the difference between “Search preview” counts and the dashboard metrics strip? =

Under **Search preview** fields, the small live line shows **characters and words** in that field only (editorial preview). The compact **property metrics** strip on the dashboard shows **post bank**, **SAP bank**, **optimization used/cap**, **editorial period**, and **posts/entities in period**—aligned with NEO Pulse Integrations.

= AI wands show HTTP 502 or "Bad gateway" from my own domain =

That response usually comes from your **hosting stack** (reverse proxy or PHP), not from OpenRouter’s JSON API. WordPress is calling OpenRouter with `wp_remote_post` during that request; if **nginx/FastCGI/proxy read timeout** or **PHP max_execution_time** is shorter than that work, the browser can receive **502 HTML** instead of JSON.

**On the server (recommended)**

* Raise **proxy / FastCGI read timeout** so it exceeds the worst-case AI call.
* Raise **PHP max_execution_time** (and PHP-FPM `request_terminate_timeout` if used) for admin requests.
* Confirm the server can make **outbound HTTPS** to **https://openrouter.ai**.

**In WordPress (optional filters)**

* `neo_pulse_wp_openrouter_timeout` - Seconds for OpenRouter `wp_remote_post` (default falls back to `neo_pulse_wp_enhance_remote_timeout`, then **180**; clamped **10–300**).
* `neo_pulse_wp_enhance_remote_timeout` - Used as the default for OpenRouter when `neo_pulse_wp_openrouter_timeout` is not set.
* `neo_pulse_wp_enhance_time_limit` - Seconds for `set_time_limit()` at the start of AI handlers. Default **300**. Pass **0** to skip `set_time_limit`.

= Can I use NEO Pulse WP with Cursor or Claude via MCP? =

Yes. Install the **neo-pulse-wp-mcp** stdio package (see `docs/neo-pulse-wp-mcp.md` in the NEO Pulse repo). It calls `POST /wp-json/neo-pulse/v1/tools/execute` on your site using a WordPress Application Password. OpenRouter keys remain on the server.

= Speed module (Autoptimize replacement) =

Under **NEO Pulse WP → Speed**, minify/cache for CSS, JS, and HTML is **enabled by default** on install. Designed for **WP Engine** (page cache stays on the host; this module only optimizes assets). Chat, voice, and overseer scripts stay excluded from minify/defer. Turn Speed off in that screen if needed. Deactivate **Autoptimize** (or other CSS/JS optimizers) to avoid double-processing. MCP tools: `wp_speed_status`, `wp_speed_flush`.

= Speed → Images (file size and WebP) =

Use **Speed → Images** for compression and WebP sidecars (original uploads are kept). Alt text and titles stay under **Image SEO**. Disable competing optimizers (ShortPixel, Smush, EWWW, Imagify) when this tab is enabled. Bulk optimize runs in REST batches to avoid timeouts on WP Engine. MCP: `wp_speed_image_status`, `wp_speed_image_batch` (requires `confirm: true`), `wp_speed_image_flush_meta` (requires `confirm: true`).

== Changelog ==

= 0.9.23 =
* **Super Import** (General menu): unified Flo Sheet JSON workbook, third-party plugin crawlers (ACF, Rank Math, HFCM/WPCode, Autoptimize), batched apply into NEO Pulse Fields/Redirects/Script Manager/Speed, dynamic macro/micro progress UI, REST + MCP `wp_super_migrate_*` tools.

= 0.9.22 =
* **Speed** module: minify/aggregate CSS and JS, HTML minify, disk cache under `wp-content/cache/neo-pulse-speed/`, admin settings, optional Autoptimize settings import, MCP `wp_speed_status` / `wp_speed_flush`.
* **Speed → Images**: JPEG/PNG compression, WebP sidecars, upload auto-optimize, bulk batch REST, separate from Image SEO; MCP `wp_speed_image_*` tools.

= 0.9.21 =
* Admin Tool Library page: searchable dictionary of all MCP/agent tools with parameters and examples.

= 0.9.34 =
* WP-native secrets: plugin `.env` loaded at boot; `npm run embed:neo-pulse-wp-secrets` before customer deploy.
* Removed Supabase pairing and cloud credential sync.

= 0.9.20 =
* MCP tools API: `POST /neo-pulse/v1/tools/list` and `/tools/execute` with 58 agent tools, audit log, and idempotency keys.
* Redirects REST CRUD for agents.
* Agent site index (`wp_site_index`) with focus keyword and seo_research fields.

= 0.8.1 =
* OpenRouter key auto-loaded from Supabase (`neo-pulse_user_wordpress_properties`) via secure RPC.
* NEO Pulse Integrations API key save syncs OpenRouter credentials to Supabase for WordPress plugin wands.

= 0.8.0 =
* Editor AI wands: block sidebar, classic meta box, inline field buttons (preview → apply).
* OpenRouter from PHP only; key pulled from NEO Pulse/Supabase (optional wp-config override).
* REST routes: GET `/neo-pulse/v1/ai/status`, POST `/ai/preview`, POST `/ai/apply`.
* Gated by Site ID connection, optimization package, post type, and period cap on Apply.
