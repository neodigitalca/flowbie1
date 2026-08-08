---
title: Building a client library
slug: getting-started/client-library
section: Getting started
order: 40
---

This guide helps you wrap the Flowbie API in a reusable client (TypeScript, Python, etc.).

## FlowbieClient (TypeScript)

```typescript
const BASE = "https://flowbie.ca/api";

export class FlowbieClient {
  constructor(private base = BASE) {}

  private async request<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
    const { json, headers, ...rest } = init;
    const res = await fetch(`${this.base}${path.startsWith("/") ? path : `/${path}`}`, {
      ...rest,
      credentials: "include",
      headers: { "Content-Type": "application/json", ...headers },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
    const data = (await res.json().catch(() => ({}))) as T & { error?: string; ok?: boolean };
    if (!res.ok || data.ok === false) {
      throw new Error(data.error ?? res.statusText);
    }
    return data;
  }

  login(email: string, password: string) {
    return this.request<{ ok: boolean }>("/auth/login", {
      method: "POST",
      json: { email, password },
    });
  }

  me() {
    return this.request<{
      ok: boolean;
      user: { id: number; email: string; displayName: string } | null;
      teams: { id: number; name: string; slug: string }[];
      activeTeam: unknown;
    }>("/auth/me");
  }

  switchTeam(teamId: number) {
    return this.request<{ ok: boolean }>(`/teams/${teamId}/switch`, { method: "POST", json: {} });
  }
}
```

## Session flow

1. `POST /auth/login` with `{ email, password }`
2. Store cookies (browser: automatic; Node: use a cookie jar such as `tough-cookie` with `fetch-cookie`)
3. `GET /auth/me` to read teams and permissions
4. `POST /teams/{teamId}/switch` when you need a different active agency
5. Pass `{teamId}` in paths under `/teams/{teamId}/...`

## Typing endpoints

Each article in this reference lists method, path, auth, request fields, and errors. Generate types from frontmatter or maintain a hand-written `routes.ts` map.

## Open vs session routes

Product routes (`gsc`, `wordpress`, `dataforseo`, etc.) are **open** on the server: credentials live in Flowbie server config, not in your client headers. Team routes require the session cookie.

## Markdown source

All articles live under `docs/api/` in the Flowbie One repository. Regenerate endpoint scaffolds with `npm run docs:api:generate`.
