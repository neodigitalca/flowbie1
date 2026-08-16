# Deploy to neodigital.ca (agent runbook)

NEO Pulse One ships to **https://neodigital.ca/app/** as:

| Piece | Local path | Remote path |
|---|---|---|
| React SPA | `dist/` | `/app` |
| WordPress API plugin | `wordpress-plugins/neo-pulse-app/` | `/wp-content/plugins/neo-pulse-app` |

The plugin serves `/api/*` on the same domain (auth, teams, manager settings, GSC, etc.).

---

## Prerequisites

1. **SFTP config** at `wordpress-plugins/neo-pulse-wpengine.config.json` (not committed; copy from `neo-pulse-wpengine.config.example.json`).
2. Config must include `host`, `username`, and `password` or `passwordPath`.
3. Optional overrides:
   - `neoPulseDistRemotePath` (default `./app`)
   - `neoPulseAppRemotePath` (default `./wp-content/plugins/neo-pulse-app`)
4. Production SFTP: `neodigital.sftp.wpengine.com` (see Customer List CSV or `neo-pulse-wpengine.config.json`)
5. Override config path: `NEO_PULSE_WPENGINE_CONFIG=/path/to/config.json`

Run all commands from **repo root** (`B:\NEO Pulse One`).

### One-time hook setup

Enable the repo pre-commit guard (blocks secrets and deploy zips):

```bash
git config core.hooksPath .githooks
```

On Windows you can also run:

```powershell
.\scripts\setup-git-hooks.ps1
```

Manual check anytime: `npm run check:no-secrets` (same rules as the hook).

---

## Credential rotation (after any leak)

If deploy zips or secret files were ever pushed to GitHub, rotate **all** of these before using the new repo:

| Service | What to rotate | Where production values live |
|---|---|---|
| Google Cloud (`neo-pulse-483717`) | GMB OAuth client secret | Server `neo-pulse-app-secrets.php` or wp-config |
| OpenRouter | API key | `neo-pulse-wp/.env` (local deploy only) or wp-config |
| DataForSEO | login + password | same |
| Semrush | API key | same |
| Chekkit | webhook URL | same |
| NEO Pulse app | `NEO_PULSE_APP_SESSION_SECRET`, `NEO_PULSE_APP_SETUP_KEY` | server secrets file |
| GSC | service account JSON (if in `neo-pulse-wp-gsc-config.php`) | server-side config |

Deploy scripts **never upload** secret files to production; server-side credentials stay on the server.

---

## Git backup (required before every deploy)

**Always** commit and push to GitHub before any deploy command. Do not deploy from uncommitted local-only changes.

Backup remote: your private GitHub repo (replace URL below).

From repo root:

```bash
git status
git add src/ wordpress-plugins/neo-pulse-app/ wordpress-plugins/neo-pulse-wp/ docs/ scripts/ package.json package-lock.json
git reset -- wordpress-plugins/.deploy/*.zip wordpress-plugins/*.zip
git commit -m "Deploy: <short summary of what is shipping>"
git push origin main
```

Or, if using `git add -A`, always unstage deploy artifacts before commit:

```bash
git add -A
git reset -- wordpress-plugins/.deploy/*.zip wordpress-plugins/*.zip
git commit -m "Deploy: <short summary of what is shipping>"
git push origin main
```

### Never commit

- Deploy zips: `wordpress-plugins/.deploy/*.zip`, `wordpress-plugins/*.zip`
- Secret files: `*-secrets.php`, `.env`, `neo-pulse-wpengine.config.json`
- Customer SFTP CSV: `wordpress-plugins/Customer List/SFTP Users_Clients List.csv`
- Credential JSON: `*-credentials*.json`

Zips under `.deploy/` are ephemeral SFTP upload artifacts. Build them locally during deploy; do not add them to Git.

Deploy only after the push succeeds. The live build should always match a commit on GitHub.

### New GitHub repo checklist

1. Use a **private** repo unless you have a specific reason to stay public.
2. Enable **Secret scanning** and **Push protection** (Settings → Code security).
3. Run `git config core.hooksPath .githooks` on every machine that commits.

---

## Full deploy (frontend + plugin)

Use when React UI or PHP backend changed.

```bash
npm run build:neodigital-app
npm run deploy:neodigital-app
```

What this does:

- `build:neodigital-app` → `scripts/build-neo-pulse.cjs` with `VITE_BASE_PATH=/app/` → Vite production build into `dist/`
- `deploy:neodigital-app` → `wordpress-plugins/deploy-neo-pulse-app.js` → SFTP upload of `dist/` and `neo-pulse-app/` to `neodigital.ca`

Deploy output ends with:

```
Done: https://neodigital.ca/app/?v=<timestamp digits>
Next: npm run smoke:neo-pulse
Open: https://neodigital.ca/app/?v=<timestamp digits>
```

---

## Test staging (flowbie.ca, optional)

Pre-production test builds only. Dist upload to `flowbie.ca/flowbie/` (no plugin).

```bash
npm run build:flowbie-test
npm run deploy:flowbie-test
```

Output: `https://flowbie.ca/flowbie/?v=<timestamp digits>`

Production always ships to `neodigital.ca`. Do not run `smoke:neo-pulse` against flowbie.ca.

---

## Plugin-only deploy (faster)

Use when only PHP under `wordpress-plugins/neo-pulse-app/` changed (auth, teams, API routes).

```bash
node wordpress-plugins/deploy-neo-pulse-app-plugin-only.js
```

---

## Dist-only deploy

Use when only the React bundle changed and you already uploaded the plugin.

```bash
npm run build:neo-pulse
node wordpress-plugins/deploy-neo-pulse-app-dist-only.js
```

---

## After deploy to neodigital.ca

### 1. Confirm live build metadata

```bash
curl.exe -s "https://neodigital.ca/app/build-info.json"
```

Expect `version`, `gitSha`, and `builtAt` matching the commit you deployed. The `?v=` query param on the app URL uses digits from `builtAt`.

### 2. Smoke test

```bash
npm run smoke:neo-pulse
```

Hits live URLs on `https://neodigital.ca` (SPA, manager cloud status, GSC, GMB, etc.).

### 3. Manual UI checks

Open the URL from deploy output (`https://neodigital.ca/app/?v=...`) and confirm:

- NEO Pulse branding (not Flowbie)
- Dashboard has Properties, API Keys, Master Rules, AI and Models, Google (no Email Agent)
- API Keys shows OpenRouter and DataForSEO only
- No Communication / Flo inbox nav
- Chat tab loads

### 4. WordPress admin (first deploy or new DB tables)

If `/api/*` returns 404 or teams/auth DB tables are missing:

1. Open **WP admin** → Plugins
2. **Deactivate + reactivate** `NEO Pulse App` (runs `Neo_Pulse_App_Teams_Store::install_tables()` on activation)
3. **Settings → Permalinks → Save** (flush rewrite rules)

### 5. Verify auth / teams API

```bash
curl.exe -s "https://neodigital.ca/api/auth/me"
curl.exe -s -w "\nHTTP:%{http_code}" "https://neodigital.ca/api/teams"
```

Expected without a session:

- `/api/auth/me` → `{"ok":true,"username":null,"user":null}`
- `/api/teams` → `401 Unauthorized`

---

## Live URLs

| Surface | URL |
|---|---|
| App | https://neodigital.ca/app/ |
| App (cache bust) | https://neodigital.ca/app/?v=&lt;build timestamp digits&gt; |
| Login | https://neodigital.ca/app/login |
| Register | https://neodigital.ca/app/register |
| API base | https://neodigital.ca/api/ |

Invite links use hash form: `https://neodigital.ca/#register?invite=TOKEN` (redirects to `/register`).

---

## Teams / auth backend (for agents)

Server-side code lives in:

```
wordpress-plugins/neo-pulse-app/includes/auth/
wordpress-plugins/neo-pulse-app/includes/teams/
wordpress-plugins/neo-pulse-app/includes/router/class-api-dispatcher.php
```

Key routes:

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/auth/me` | Session user + active team |
| POST | `/api/auth/login` | Email/password login |
| POST | `/api/auth/logout` | Clear session |
| POST | `/api/auth/register` | Accept invite + create account |
| POST | `/api/auth/bootstrap` | First user only (empty DB) |
| POST | `/api/auth/setup-admin` | Install tables + owner (empty DB or `NEO_PULSE_APP_SETUP_KEY`) |
| GET/POST | `/api/teams/*` | Teams CRUD, members, invites, workspace |

Data: WP DB tables (`neo-pulse_users`, `neo_pulse_teams`, …) + team workspace JSON under uploads `neo-pulse-data/teams/{id}/`.

Frontend auth gate: `src/lib/auth-disabled.ts` (`AUTH_DISABLED = false` in production).

---

## Other deploy scripts

| Script | Target |
|---|---|
| `npm run deploy:neo-pulse-plugin` | Legacy `neo-pulse-wp` plugin only (`deploy-neo-pulse-sftp.js`) |

Do **not** use `deploy:neo-pulse-plugin` for the headless NEO Pulse One app; use `deploy:neo-pulse` instead.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `dist/ not found` | Run `npm run build:neo-pulse` first |
| `Missing config` | Create `wordpress-plugins/neo-pulse-wpengine.config.json` |
| `/api/*` 404 | Reactivate plugin + flush permalinks |
| Login works locally but not on ca | Ensure plugin deployed; check `/api/auth/me` |
| Teams tables missing | Reactivate plugin or `POST /api/auth/setup-admin` (when allowed) |
| SFTP fails | Confirm WP Engine SFTP credentials and port `2222` |

---

## In-app WP Engine deploy (neo-pulse-wp to clients)

1. After editing `wordpress-plugins/Customer List/SFTP Users_Clients List.csv`, sync catalog to server:
   ```bash
   npm run sync:wpengine-catalog
   ```
   Set `NEO_PULSE_SESSION_TOKEN` to a logged-in session Bearer token if not running against localhost with cookies.

2. Deploy neodigital (stages neo-pulse-wp under `wp-content/uploads/neo-pulse-data/wpengine/plugin/neo-pulse-wp/`):
   ```bash
   npm run build:neodigital-app
   npm run deploy:neodigital-app
   ```

3. In the app: **Dashboard → WP Engine** to sync matches and batch deploy, or open a property profile → **Settings → Hosting** → **Install neo-pulse-wp**.

---

## Agent checklist

1. **Git backup:** commit and push (exclude deploy zips; hooks enabled via `core.hooksPath`)
2. `npm run build:neodigital-app` (if frontend changed)
3. `npm run deploy:neodigital-app` (or plugin-only script if PHP-only)
4. Confirm deploy `Done:` URL and `build-info.json` on live host
5. `npm run smoke:neo-pulse`
6. Manual UI checks (Neo branding, no email module)
7. If auth/teams is new: reactivate plugin in WP admin
8. Confirm `/api/auth/me` and critical routes respond
