---
title: Authentication overview
slug: auth/overview
section: Authentication
order: 5
---

The **auth** namespace manages sign-in, sessions, and first-time setup.

## Lifecycle

1. **Setup or bootstrap** — Create the first owner (`setup-admin` or `bootstrap`).
2. **Login or register** — Obtain the `neo_pulse_session` cookie.
3. **Me** — Read user, teams, and permissions.
4. **Logout** — Clear the session.

## Public vs session

| Auth badge | Meaning |
| --- | --- |
| Public | No existing session required |
| Session | Valid `neo_pulse_session` cookie required |

All routes in this section except login, register, bootstrap, and setup-admin require a session.

## Connecting from code

Use `credentials: "include"` in the browser. After login, call `GET /api/auth/me` before any `/api/teams/{teamId}/...` route so you know which team id to pass.

See [Getting started: Authentication](../getting-started/authentication) for the full cookie and team-switch flow.
