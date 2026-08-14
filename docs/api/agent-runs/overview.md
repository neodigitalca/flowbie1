---
title: Agent runs overview
slug: agent-runs/overview
section: Agent runs
order: 0
---

<!-- manual -->

Running Agents persists automation jobs as team-scoped **AgentRun** records. Dispatch from **Pulse Assist Build** or **Task Manager → Execute with agent**. The left sidebar lists runs and polls until each job reaches a terminal status.

## Dispatch paths

| Source | `source` field | Trigger |
| --- | --- | --- |
| Pulse Assist Build | `pulse_assist` | Build card **Run automation** (`type: automation_dispatch`) |
| Task Manager | `task_manager` | Task detail **Execute with agent** (requires `executionKind` + `executionPayload.targetUrl`) |

Both paths call `POST /api/agent-runs` and share the same client executor.

## Statuses

`queued` → `running` → `done` | `failed` | `cancelled`

Long OpenRouter work runs in the **browser** (client executor). PHP stores run metadata and step logs only.

## Routes

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/agent-runs?teamId=` | List runs (optional `status`, `source`, `task_id`) |
| POST | `/api/agent-runs` | Create run |
| GET | `/api/agent-runs/{id}?teamId=` | Run + steps |
| PATCH | `/api/agent-runs/{id}` | Client progress updates |
| POST | `/api/agent-runs/{id}/cancel` | Cancel queued/running run |

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
