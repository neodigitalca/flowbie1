---
title: Introduction
slug: getting-started
section: Getting started
order: 0
---

Flowbie exposes a Node-compatible HTTP API at **`/api/*`** on the same origin as the web app (for example `https://flowbie.ca/api/...`).

## Quick start

Use this sequence to connect a script or integration from zero:

1. **First deploy (no users yet)** — `POST /api/auth/setup-admin` with owner email, password, and agency name. Installs DB tables and creates the owner team. See [Setup Admin](../auth/setup-admin) or use `POST /api/auth/bootstrap` when the user table is completely empty.
2. **Sign in** — `POST /api/auth/login` with `{ "email", "password" }`. The server sets the `flowbie_session` cookie.
3. **Verify session** — `GET /api/auth/me` returns the user, team list, active team, and permissions.
4. **Switch agency** — `POST /api/teams/{teamId}/switch` when the user belongs to multiple teams.
5. **Call a namespace** — WordPress, GSC, Teams chat, etc. Pick a section in the sidebar (start with [Authentication overview](../auth/overview) or [Teams overview](../teams/overview)).

Browser clients must send `credentials: "include"` on every `fetch`. Server-side clients must forward or store the session cookie.

## Base URL

| Environment | Base |
| --- | --- |
| Production | `https://flowbie.ca/api` |
| Local dev (Vite proxy) | `/api` (proxied to flowbie.ca) |

All paths in this reference are relative to `/api`. Example: `POST /api/auth/login` means `POST https://flowbie.ca/api/auth/login`.

## Request format

- Send JSON bodies with `Content-Type: application/json`
- Use `credentials: "include"` in browser `fetch` so session cookies are sent
- Empty bodies are allowed for GET requests

## Response format

Most endpoints return JSON with UTF-8 encoding. Shapes vary by namespace; common patterns:

| Field | Description |
| --- | --- |
| `ok` / `success` | Boolean status |
| `error` | Human-readable error on failure |

See [Errors](getting-started/errors) for HTTP status codes and the not-found payload.

## Namespaces

The API is organized by prefix: `auth`, `teams`, `wordpress`, `gsc`, `dataforseo`, and others. Overview pages:

- [Authentication](../auth/overview) — login, session, bootstrap
- [Teams](../teams/overview) — agencies, invites, RBAC
- [WordPress](../wordpress/overview) — site inventory and publishing
- [Integrations](../integrations/overview) — manager cloud settings and properties

Use the sidebar to browse every endpoint by topic.
