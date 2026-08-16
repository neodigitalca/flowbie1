---
title: Agent runs overview
slug: agent-runs/overview
section: Agent runs
order: 0
---

<!-- manual -->

Running Agents persists automation jobs as team-scoped **AgentRun** records. Dispatch from **Pulse Assist Build** or **Task Manager → Execute with agent**. The **Agents** tab in the right sidebar lists active runs and polls until each job reaches a terminal status.

## Dispatch paths

| Source | `source` field | Trigger |
| --- | --- | --- |
| Pulse Assist Build | `pulse_assist` | Build card **Run automation** (`type: automation_dispatch`) |
| Task Manager | `task_manager` | Task detail **Execute with agent** (requires `executionKind` + `executionPayload.targetUrl`) |

Both paths call `POST /api/agent-runs` and share the same client executor.

Long OpenRouter work runs in the **browser** (client executor) for legacy client-mode runs. **Post creator** task executions use **server mode**: WordPress cron worker (`neo_pulse_app_agent_run_worker`) processes one bounded tick every 2 minutes without an open browser tab.

## Server execution (post creator)

- Task preflight returns `status: running` and `executionMode: server`.
- Agent runs store `plan.executionMode: server`; the browser executor does not acquire a tab lease.
- Worker class `Neo_Pulse_App_Agent_Run_Worker` runs `Neo_Pulse_App_Agent_Run_Harness_Post_Creator` per tick.
- Steps use canonical `stepKey` upserts (one row per logical step).
- Artifacts: `POST/GET /api/agent-runs/{id}/artifacts` (stored under uploads/neo-pulse/agent-runs/{runId}/).
- Log download: JSON export (`run`, `checkpoint`, `steps[]` with artifacts).

## Statuses

`queued` → `running` → `done` | `failed` | `cancelled`

Client-mode runs (GSC reporting, content optimizer bulk) still use the browser executor. Post creator uses server mode by default.

## Agents panel UI

- Shows **active runs only** (`queued`, `running`).
- Expanded drawer mirrors the workspace **Details** drawer: live step message, current post, progress bar, generated file downloads, completed URL artifacts.
- **Clear history** removes terminal runs (`done`, `failed`, `cancelled`) for the team.
- After a page refresh, active runs **resume from the last checkpoint** instead of restarting. The drawer hydrates position, progress bar, and step text from persisted `result.checkpoint`.

## Refresh and resume

Client execution runs in the browser. If the user refreshes while a run is `running`:

1. The executor re-dispatches the orphan run on the next app load.
2. `GET /api/agent-runs/{id}` returns the latest `result.checkpoint` (completed/uploaded URLs, current index, progress).
3. Bulk runs skip URLs already in `checkpoint.uploadedUrls` and continue with the next URL.
4. If the linked task execution is already `completed`, the agent run is closed as `done` without re-running.

## Auto-upload

Content optimizer agent runs upload to WordPress automatically on each successful URL completion (same pipeline as Overview bulk optimize). Completed URLs are recorded in `checkpoint.uploadedUrls` so refresh resume does not double-upload.

## Checkpoint fields (PATCH `result.checkpoint`)

| Field | Purpose |
| --- | --- |
| `completedUrls` | URLs finished in this run |
| `uploadedUrls` | URLs successfully uploaded to WordPress |
| `currentUrl` | URL currently processing |
| `currentIndex` | Zero-based index in the batch |
| `totalCount` | Total URLs in batch |
| `currentUrlProgress` | 0–100 progress within the current URL |
| `lastMessage` | Live step text for the Agents drawer |
| `completedUrlSummaries` | Lightweight `{ url, postTitle }` rows after refresh |

PHP merges incoming `result` and nested `checkpoint` with existing JSON on each PATCH.

## Routes

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/agent-runs?teamId=` | List runs (optional `status`, `source`, `task_id`) |
| POST | `/api/agent-runs` | Create run |
| GET | `/api/agent-runs/{id}?teamId=` | Run + steps |
| PATCH | `/api/agent-runs/{id}` | Client progress updates |
| POST | `/api/agent-runs/{id}/cancel` | Cancel queued/running run |
| DELETE | `/api/agent-runs/{id}?teamId=` | Delete one run (steps cascade) |
| POST | `/api/agent-runs/clear` | Delete terminal runs for team |

## Clear history body

```json
{
  "teamId": 1,
  "statuses": ["done", "failed", "cancelled"]
}
```

`statuses` is optional; defaults to all terminal statuses.

## Create body

```json
{
  "teamId": 1,
  "source": "pulse_assist",
  "recipeKey": "content_optimizer_bulk",
  "title": "Content optimization batch",
  "taskId": null,
  "context": { "siteId": "site-uuid", "managerTab": "content-optimizer" },
  "plan": {}
}
```

## Related

- [Recipes](agent-runs/recipes.md)
- [Task Manager execute](agent-runs/task-manager-execute.md)
