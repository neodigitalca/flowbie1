---
title: Teams overview
slug: teams/overview
section: Teams
order: 5
---

The **teams** namespace covers agencies (teams), seats, invites, workspace settings, chat, and tasks.

## Concepts

| Term | API surface |
| --- | --- |
| Agency / team | `GET /api/teams`, `POST /api/teams` |
| Active team | Stored in session; switch with `POST /api/teams/{teamId}/switch` |
| Invite | `POST /api/teams/{teamId}/invites`; accept via register + token |
| RBAC | Permissions on `GET /api/auth/me` → `permissions` |

## Typical flow

1. Authenticate (see [Authentication overview](../auth/overview)).
2. List teams with `GET /api/teams`.
3. Switch to the agency you need with `POST /api/teams/{teamId}/switch`.
4. Call nested routes: `/api/teams/{teamId}/chat/...`, `/api/teams/{teamId}/tasks/...`, etc.

Communication features (chat) require the **communication** permission on the active team.
