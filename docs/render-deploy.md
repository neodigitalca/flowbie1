# Render deploy runbook

Flowbie One uses **Render** for the React UI (static site) and the **Local Dominator Puppeteer worker** (Docker web service). WordPress + `neo-pulse-app` stay on **WP Engine** at `https://neodigital.ca`.

## Architecture

| Layer | Host | URL |
|-------|------|-----|
| React UI (demo) | Render static | `https://flowbie-demo-static.onrender.com` |
| React UI (prod) | Render static | `https://app.neodigital.ca` |
| WP API | WP Engine | `https://neodigital.ca/api/mcp` |
| LD worker (demo) | Render Docker | `https://flowbie-demo-worker.onrender.com` |
| LD worker (prod) | Render Docker | `https://ld.neodigital.ca` |

## Cursor Render MCP

User-level config: `~/.cursor/mcp.json` (see [`.cursor/mcp.json.example`](../.cursor/mcp.json.example)).

After adding the server, reload Cursor MCP and run:

1. `list_workspaces`
2. Set workspace: `Set my Render workspace to <name>`
3. `list_services`

## Repo scripts

| Command | Purpose |
|---------|---------|
| `npm run build:render-static` | Production Vite build for Render (`RENDER_PROFILE=demo\|prod`) |
| `npm run start:ld-worker` | Standalone Local Dominator job API (port `PORT` or `10000`) |

Build env (set in Render static service):

- `RENDER_PROFILE` — `demo` or `prod`
- `VITE_MCP_API_BASE` — `https://neodigital.ca/api/mcp`
- `VITE_BASE_PATH` — `/`
- `VITE_OPENROUTER_API_KEY` — build-time secret (sync: false in Render)

Worker env (set in Render Docker service):

- `LOCAL_DOMINATOR_EMAIL` / `LOCAL_DOMINATOR_PASSWORD`
- `LD_WORKER_AUTH_TOKEN` — shared secret; must match WP Engine
- `PORT` — set automatically by Render

## WP Engine (neo-pulse-app)

After prod worker is live, set in `neo-pulse-app-secrets.php` or environment:

```php
define( 'NEO_PULSE_APP_LOCAL_DOMINATOR_WORKER_URL', 'https://ld.neodigital.ca' );
define( 'NEO_PULSE_APP_LOCAL_DOMINATOR_WORKER_AUTH', '<same as LD_WORKER_AUTH_TOKEN>' );
```

Redeploy plugin:

```powershell
npm run deploy:neodigital-app
```

CORS: API responses allow `*.onrender.com` and `*.neodigital.ca` origins automatically.

## Blueprint

[`render.yaml`](../render.yaml) defines four services. Apply from Render Dashboard → **Blueprints** → connect `neodigitalca/flowbie1`.

Or provision via API:

```powershell
node scripts/render-provision.mjs
```

## DNS (production)

In your DNS provider for `neodigital.ca`:

| Record | Type | Target |
|--------|------|--------|
| `app` | CNAME | Render target for `flowbie-prod-static` |
| `ld` | CNAME | Render target for `flowbie-prod-worker` |

Enable custom domains in each Render service, then verify HTTPS.

## Demo validation

1. Open demo static URL.
2. Sign in; confirm API calls go to `neodigital.ca` (Network tab).
3. Run Local Dominator grid export from a workflow or task.
4. Check worker logs in Render dashboard or via MCP.

## Rollback

- **Static:** Redeploy previous commit from Render service → Deploys.
- **Worker:** Same; ensure `LD_WORKER_AUTH_TOKEN` unchanged.
- **WP Engine UI:** Keep SFTP deploy to `neodigital.ca/app/` as fallback until Render prod is verified.

## Local dev (unchanged)

```powershell
npm run dev
```

Uses local WP proxy; Render is additive.
