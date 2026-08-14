---
title: Agent run recipes
slug: agent-runs/recipes
section: Agent runs
order: 10
---

<!-- manual -->

Recipes map to existing client harnesses. Registration happens in the SPA (`registerAgentRunHarness`).

| `recipeKey` | Title | Harness |
| --- | --- | --- |
| `overview_pages_meta_batch` | Pages bucket meta batch | Overview AI all-meta harness (pages sitemap) |
| `content_optimizer_bulk` | Content optimization batch | Content Optimizer bulk or task `clientRunContract` |

Task executions with `executionKind: content_optimizer` dispatch `content_optimizer_bulk` with `plan.clientRunContract` from `POST /api/teams/{id}/tasks/tasks/{taskId}/execute`.

Meta-only task runs (`content_optimizer_meta`) may complete on the server during preflight; the agent run is marked done without a client harness.
