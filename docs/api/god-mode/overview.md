---
title: God Mode overview
slug: god-mode/overview
section: God Mode
order: 0
---

<!-- manual -->

**God Mode** is the logged-in backend mode of NEO Pulse Chat on WordPress sites. Visitors use the public RAG chat; logged-in editors switch to God Mode to run the **Backend Assist** pipeline: analytics, SEO research, post edits, Agent Hub blocks, and multi-step workflows.

God Mode is implemented in the **neo-pulse-wp** WordPress plugin, not in the Node `/api/*` router documented elsewhere in this reference.

## Visitor vs God Mode

| Mode | Code | Who | Pipeline |
| --- | --- | --- | --- |
| Visitor | `admin_mode: visitor` | Everyone | Public RAG chat |
| God Mode | `admin_mode: backend` | Logged-in users | Backend Assist |

The chat widget toolbar shows **Visitor** and **God Mode** toggle buttons when `canBackendMode` is true (`is_user_logged_in()`). In wp-admin, God Mode is the default.

Mode is persisted in `sessionStorage` under `neo_pulse_chat_admin_mode`.

## Ask / Plan / Build

Inside God Mode, a composer pill cycles three submodes:

| Submode | Behavior |
| --- | --- |
| **Ask** | Read-only. Write tools are blocked with a card that offers to switch to Build. |
| **Plan** | Write tools show a plan preview; nothing is executed. |
| **Build** | Full tool execution. |

Submode is sent as `admin_submode` (`ask`, `plan`, or `build`) on each stream request. See [Ask / Plan / Build](ask-plan-build).

## Architecture

```
NEO Pulse Chat widget (frontend)
  admin_mode=backend + admin_submode
    → POST admin-ajax.php?action=neo_pulse_chat_stream
      → Neo_Pulse_Wp_Chat_Super_Admin
        → Neo_Pulse_Wp_Backend_Assist_Submode
          → Classify → Plan → Execute → Card
            → 25+ registered tools
```

## Access

| Requirement | Scope |
| --- | --- |
| Logged in | God Mode toggle visible |
| `edit_posts` | Backend Assist REST, writes, site inventory |
| `manage_options` | Chat insights, GSC quick wins starter |
| `edit_post` | Per-post edits |

OpenRouter API key must be configured for LLM classification and copy generation.

## Source code (neo-pulse-wp)

| Area | Path |
| --- | --- |
| Chat widget | `wordpress-plugins/neo-pulse-wp/assets/frontend/neo-pulse-chat-widget.js` |
| Stream entry | `wordpress-plugins/neo-pulse-wp/includes/class-neo-pulse-wp-chat-super-admin.php` |
| Pipeline | `wordpress-plugins/neo-pulse-wp/includes/backend-assist/` |
| Tool registry | `wordpress-plugins/neo-pulse-wp/includes/backend-assist/class-neo-pulse-wp-backend-assist-registry.php` |

## Related pages

- [Feature index](feature-index) — exhaustive capability checklist
- [Tools reference](tools) — all registered tools
- [Body operations](body-ops) — deterministic WYSIWYG edits
- [Endpoints](endpoints) — REST and streaming paths

## Related surfaces (same pipeline)

- **Backend Assist admin page** — wp-admin standalone UI (`NEO Pulse WP → Backend Assist`)
- **Agent Hub agent tab** — SEO block workflow from the builder
