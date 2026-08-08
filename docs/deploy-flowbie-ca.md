# Deploy to flowbie.ca (agent runbook)

Flowbie One ships to **https://flowbie.ca** as:

| Piece | Local path | Remote path |
|---|---|---|
| React SPA | `dist/` | `/flowbie` |
| WordPress API plugin | `wordpress-plugins/flowbie-app/` | `/wp-content/plugins/flowbie-app` |

The plugin serves `/api/*` on the same domain (auth, teams, manager settings, GSC, etc.).

---

## Prerequisites

1. **SFTP config** at `wordpress-plugins/flowbie-wpengine.config.json` (not committed; copy from `flowbie-wpengine.config.example.json`).
2. Config must include `host`, `username`, and `password` or `passwordPath`.
3. Optional overrides:
   - `flowbieDistRemotePath` (default `/flowbie`)
   - `flowbieAppRemotePath` (default `/wp-content/plugins/flowbie-app`)
4. Override config path: `FLOWBIE_WPENGINE_CONFIG=/path/to/config.json`

Run all commands from **repo root** (`B:\Flowbie One`).

---

## Git backup (required before every deploy)

**Always** commit and push to GitHub before any deploy command. Do not deploy from uncommitted local-only changes.

Backup remote: **https://github.com/neodigitalca/Flowbie1.git**

From repo root:

```bash
git status
git add -A
git commit -m "Deploy: <short summary of what is shipping>"
git push origin main
```

If `origin` is not set to Flowbie1 yet:

```bash
git remote add origin https://github.com/neodigitalca/Flowbie1.git
git push -u origin main
```

Deploy only after the push succeeds. The live build should always match a commit on GitHub.

---

## Full deploy (frontend + plugin)

Use when React UI or PHP backend changed.

```bash
npm run build:flowbie-ca
npm run deploy:flowbie-ca
```

What this does:

- `build:flowbie-ca` → `scripts/build-flowbie-ca.cjs` → Vite production build into `dist/`
- `deploy:flowbie-ca` → `wordpress-plugins/deploy-flowbie-app.js` → SFTP upload of `dist/` and `flowbie-app/`

---

## Plugin-only deploy (faster)

Use when only PHP under `wordpress-plugins/flowbie-app/` changed (auth, teams, API routes).

```bash
node wordpress-plugins/deploy-flowbie-app-plugin-only.js
```

---

## Dist-only deploy

Use when only the React bundle changed and you already uploaded the plugin.

```bash
npm run build:flowbie-ca
node wordpress-plugins/deploy-flowbie-app-dist-only.js
```

---

## After deploy

### 1. Smoke test

```bash
npm run smoke:flowbie-ca
```

Hits live URLs on `https://flowbie.ca` (SPA, manager cloud status, GSC, GMB, etc.).

### 2. WordPress admin (first deploy or new DB tables)

If `/api/*` returns 404 or teams/auth DB tables are missing:

1. Open **WP admin** → Plugins
2. **Deactivate + reactivate** `Flowbie App` (runs `Flowbie_App_Teams_Store::install_tables()` on activation)
3. **Settings → Permalinks → Save** (flush rewrite rules)

### 3. Verify auth / teams API

```bash
curl.exe -s "https://flowbie.ca/api/auth/me"
curl.exe -s -w "\nHTTP:%{http_code}" "https://flowbie.ca/api/teams"
```

Expected without a session:

- `/api/auth/me` → `{"ok":true,"username":null,"user":null}`
- `/api/teams` → `401 Unauthorized`

---

## Live URLs

| Surface | URL |
|---|---|
| App | https://flowbie.ca/flowbie/ |
| Login | https://flowbie.ca/flowbie/login |
| Register | https://flowbie.ca/flowbie/register |
| API base | https://flowbie.ca/api/ |

Invite links use hash form: `https://flowbie.ca/#register?invite=TOKEN` (redirects to `/register`).

---

## Teams / auth backend (for agents)

Server-side code lives in:

```
wordpress-plugins/flowbie-app/includes/auth/
wordpress-plugins/flowbie-app/includes/teams/
wordpress-plugins/flowbie-app/includes/router/class-api-dispatcher.php
```

Key routes:

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/auth/me` | Session user + active team |
| POST | `/api/auth/login` | Email/password login |
| POST | `/api/auth/logout` | Clear session |
| POST | `/api/auth/register` | Accept invite + create account |
| POST | `/api/auth/bootstrap` | First user only (empty DB) |
| POST | `/api/auth/setup-admin` | Install tables + owner (empty DB or `FLOWBIE_APP_SETUP_KEY`) |
| GET/POST | `/api/teams/*` | Teams CRUD, members, invites, workspace |

Data: WP DB tables (`flowbie_users`, `flowbie_teams`, …) + team workspace JSON under uploads `flowbie-data/teams/{id}/`.

Frontend auth gate: `src/lib/auth-disabled.ts` (`AUTH_DISABLED = false` in production).

---

## Other deploy scripts

| Script | Target |
|---|---|
| `npm run deploy:flowbie-plugin` | Legacy `flowbie-wp` plugin only (`deploy-flowbie-sftp.js`) |

Do **not** use `deploy:flowbie-plugin` for the headless Flowbie One app; use `deploy:flowbie-ca` instead.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `dist/ not found` | Run `npm run build:flowbie-ca` first |
| `Missing config` | Create `wordpress-plugins/flowbie-wpengine.config.json` |
| `/api/*` 404 | Reactivate plugin + flush permalinks |
| Login works locally but not on ca | Ensure plugin deployed; check `/api/auth/me` |
| Teams tables missing | Reactivate plugin or `POST /api/auth/setup-admin` (when allowed) |
| SFTP fails | Confirm WP Engine SFTP credentials and port `2222` |

---

## Agent checklist

1. **Git backup:** commit and push to https://github.com/neodigitalca/Flowbie1.git
2. `npm run build:flowbie-ca` (if frontend changed)
3. `npm run deploy:flowbie-ca` (or plugin-only script if PHP-only)
4. `npm run smoke:flowbie-ca`
5. If auth/teams is new: reactivate plugin in WP admin
6. Confirm `/api/auth/me` and critical routes respond
