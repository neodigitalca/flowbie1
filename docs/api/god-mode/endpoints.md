---
title: Endpoints
slug: god-mode/endpoints
section: God Mode
order: 40
---

<!-- manual -->

God Mode traffic uses WordPress REST and admin-ajax on the **site origin** (not the Flowbie Node `/api/*` base URL).

## Primary chat stream

| Property | Value |
| --- | --- |
| URL | `POST /wp-admin/admin-ajax.php?action=flowbie_chat_stream` |
| Auth | WordPress logged-in session + nonce |
| Format | NDJSON stream |

### Request body (JSON)

| Field | Required | Description |
| --- | --- | --- |
| `admin_mode` | yes | `backend` for God Mode |
| `admin_submode` | yes | `ask`, `plan`, or `build` |
| `target_scope` | no | `page` (default) or `site`. Site skips auto current-page binding. |
| `message` | yes | User message |
| `history` | no | Conversation turns |
| `post_id` | no | Current post context |
| `page_url` | no | Current page URL |
| `page_title` | no | Current page title |
| `page_context_key` | no | RAG context key |

Stream events include `ack`, `searching`, `thinking`, and `done` with a card payload.

Handler: `Flowbie_Wp_Chat::ajax_chat_stream()` → `Flowbie_Wp_Chat_Super_Admin::stream_pipeline()`

## Backend Assist REST

Namespace: `flowbie/v1`. Permission: `edit_posts`. OpenRouter key required for `POST /backend-assist`.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/flowbie/v1/backend-assist` | Run pipeline (message + history) |
| POST | `/flowbie/v1/backend-assist/step` | Execute workflow step |
| GET | `/flowbie/v1/backend-assist/workflow/{workflow_id}/status` | Workflow status |
| POST | `/flowbie/v1/backend-assist/undo` | Undo card action (restore revision) |
| GET | `/flowbie/v1/backend-assist/sessions` | List saved sessions |
| POST | `/flowbie/v1/backend-assist/sessions` | Save session |
| DELETE | `/flowbie/v1/backend-assist/sessions` | Clear sessions |
| GET | `/flowbie/v1/backend-assist/sessions/{id}` | Get session |
| DELETE | `/flowbie/v1/backend-assist/sessions/{id}` | Delete session |

Registered in `class-flowbie-wp-backend-assist-rest.php`.

Build mode POST body accepts the same context fields as the stream: `target_scope` (`page` | `site`), `post_id`, `page_url`, `page_title`, and `page_context_key`. Site scope omits auto current-page binding in builder context.

## Site inventory

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/flowbie/v1/chat/site-inventory` | Warm cache, return count |
| GET | `/flowbie/v1/chat/site-inventory?format=csv&include_drafts=1` | CSV export (God Mode toolbar) |

## Widget config URLs

Localized in `flowbieChatConfig`:

| Key | Use |
| --- | --- |
| `backendAssistUrl` | Direct REST pipeline |
| `backendAssistUndoUrl` | Card undo |
| `siteInventoryUrl` | Inventory warm |
| `siteInventoryCsvUrl` | CSV download |

## MCP wrappers

Exposed via flowbie-wp MCP tools registry:

| MCP tool | Proxies |
| --- | --- |
| `wp_assist_chat` | `POST /flowbie/v1/backend-assist` |
| `wp_assist_workflow_status` | Workflow status GET |
| `wp_assist_workflow_step` | Workflow step POST |

Source: `class-flowbie-wp-tools-handlers.php`

## Card payload fields (stream done)

| Field | Description |
| --- | --- |
| `type` | answer, action, plan, prompt, error |
| `title` | Card headline |
| `body` | Markdown body |
| `links` | Edit, view, undo links |
| `submode_switch` | Suggested submode (`build`, `plan`, `ask`) |
| `relatedTopics` | Follow-up chip labels |
| `steps` | Workflow step list |
| `confidence` | high, medium, low |
