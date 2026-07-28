---
name: Blog ideas cannibalization
overview: "Ship what's already there: full WP inventory JSON goes untouched into the OpenRouter user message; research model reads it carte blanche and avoids overlapping topics. No code-side trimming of that JSON, no dedupe pipelines."
todos:
  - id: wire-research-model
    content: "use-prompt-bulk-generate.ts: call streamChatCompletion with getResearchModel(wordPressSite?.id) or getResearchModel(); remove BULK_CHECKLIST_MODEL"
    status: pending
  - id: prompt-plain-read-json
    content: "bulk-ideas.ts: one clear system/user line — read the entire SITE_INVENTORY_JSON block; do not propose ideas that compete with any existing title/url/keyword intent. Trim CONTENT_VARIETY when inventory exists if it keeps pushing doomed comparisons."
    status: pending
  - id: ui-sent-badge
    content: "Optional: top-left 'Sent to AI · N URLs' when that full JSON was in the last request (honesty for the user)"
    status: pending
isProject: true
---

# Blog ideas + full inventory JSON (simple)

## What you asked for

The app **already** builds the full site inventory (`JSON.stringify(kbPayload)`). **Do not complicate that.** Keep sending the **entire** JSON in the user message inside `SITE_INVENTORY_JSON` … `END` — **carte blanche for the model to read**. No summarizing it in code, no slicing it, no second service, no post-parse dedupe.

## Code changes (minimal)

1. **Model:** That same request uses **`getResearchModel()`** (per-site when you have `wordPressSite.id`), not a hardcoded checklist model.
2. **Prompt:** Plain instruction: before ideas, the model must use the **whole** inventory JSON as the list of what already exists; new ideas must not cannibalize those URLs/topics (semantic overlap, not string hacks). Tweak existing copy in [`bulk-ideas.ts`](src/lib/prompt-builders/bulk-ideas.ts); do not add new architecture.
3. **UI (optional):** Small top-left note when N URLs were included in the request so it is obvious the full payload went to the AI.

## Explicitly not doing

- Trimming `SITE_INVENTORY_JSON` for tokens
- Fuzzy matching / filtering rows after the model responds
- Extra OpenRouter verification calls unless you later insist

The fix is **send full JSON + right model + direct prompt**.
