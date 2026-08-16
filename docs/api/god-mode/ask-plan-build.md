---
title: Ask / Plan / Build
slug: god-mode/ask-plan-build
section: God Mode
order: 10
---

<!-- manual -->

God Mode uses three **submodes** that control whether Backend Assist can write to the site.

## Submodes

| Submode | API value | Write tools | Stream label |
| --- | --- | --- | --- |
| Ask | `ask` | Blocked | Analyzing… |
| Plan | `plan` | Preview only | Planning… |
| Build | `build` | Executed | Working… |

Submode is sent on every God Mode stream request as `admin_submode`.

## Ask (read-only)

When a classified write intent is detected in Ask mode, the server returns a **Read-only mode** card instead of executing the tool. The card includes `submode_switch: build` so the widget can offer a one-click switch.

Read-only tools (analytics, inventory, GSC, get_post, list_seo_blocks, etc.) run normally in Ask mode.

Text commands like "switch to build mode" return a composer guidance card pointing to the submode pill.

## Plan (preview)

Write intents in Plan mode return a **plan** card with a Cursor-style markdown body:

- **Your request** — verbatim user message
- **Goal** — one-sentence outcome
- **Plan** — 50–200 words on approach, tools, and sections affected (no final HTML, meta, or FAQ copy)
- **Tasks** — numbered executable steps (mirrors `card.steps` checklist)
- **Unchanged** — when relevant, what will not be modified
- **Approval** — switch to Build to run

Body ops and multi-step workflows use the same template; `card.steps` remains the checklist in the widget.

Multi-step requests may decompose into a **workflow** plan with numbered steps and a `workflow_id`.

Plan mode does not mutate the site.

## Build (execute)

Build mode runs the full pipeline:

1. Classify intent and tool
2. Prepare params (early reroutes for date modifier, clear meta, SEO research brief, etc.)
3. Execute tool or compound runner
4. Format action card with links, undo, and warnings

Switching to Build after a blocked Ask card can **auto-rerun** the last message (`pendingBuildRerun` in the widget).

## UI controls

| Control | Behavior |
| --- | --- |
| Submode pill | Cycles Ask → Plan → Build on click |
| Shift+Tab | Cycle submodes from composer |
| Submode switch CTA | Card button switches submode and may rerun |
| Greeting subline | Empty-state copy changes per submode |

Submode persists in `sessionStorage` key `neo_pulse_chat_admin_submode`.

## Classifier hints

The classify prompt receives a submode hint:

- **Ask** — classify writes accurately; server blocks execution
- **Plan** — classify writes; execution deferred to plan preview
- **Build** — full execution allowed

Source: `class-neo-pulse-wp-backend-assist-pipeline-classify.php`

## Response card types by submode

| Card type | Ask | Plan | Build |
| --- | --- | --- | --- |
| answer | yes | yes | yes |
| action (read tools) | yes | yes | yes |
| action (write tools) | blocked | preview | yes |
| plan | no | yes | no |
| submode_switch | yes | yes | yes |
