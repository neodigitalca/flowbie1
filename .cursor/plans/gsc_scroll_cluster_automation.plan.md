---
name: GSC scroll, URLs, auto-cluster
overview: Fix non-scrolling GSC tables; match real Search Console deep links (breakdown=query and query filter with ! prefix); run AI query clustering automatically on every import/fetch for all queries files (no tab gate) - remove the Cluster with AI button; remove grey helper lines in raw panel and dedupe cluster error (toast + inline).
todos:
  - id: fix-scroll
    content: Fix ScrollArea / flex so clustered + table GSC panels scroll (explicit height or overflow-auto + min-h-0)
  - id: url-breakdown-query
    content: Align buildGscSearchAnalyticsUrl with GSC (breakdown=query|page; query filter uses ! prefix for contains-style filter per user URL)
  - id: auto-cluster
    content: On every import/fetch, auto-run clustering for all query-parseable files immediately (no active-tab gate); remove Cluster with AI button; per-file abort on content change; loading/error without blocking raw table
  - id: tests
    content: Update gsc-console-ui-url tests for URL shape; smoke-test ReportingTab clustering flow
  - id: ui-no-grey-dedupe-error
    content: Remove grey helper lines in RawGscDataPanel (query-rows/cluster blurb + table row/column counts); dedupe cluster error (notify.toast vs inline - one only)
isProject: false
---

# GSC reporting: scroll, validation URLs, auto AI clustering

## Reference URL (user-provided)

Working shape for **Queries** validation (query dimension, not “page”):

```text
https://search.google.com/search-console/performance/search-analytics
  ?resource_id=https%3A%2F%2Fejhdistribution.com%2F
  &time_granularity=MONTH
  &num_of_days=91
  &start_date=2026-01-10
  &end_date=2026-04-10
  &breakdown=query
  &query=!ejh%20distribution
```

Clarifications:

- **`breakdown=query`** is required so Performance opens on the **Queries** tab / query dimension (not `breakdown=page`).
- **`query=!ejh distribution`**: the **`!` prefix** is part of how GSC encodes the **search/filter string** for the query table (multi-word: space → `%20`). Implementation should build `query=${encodeURIComponent('!' + keywordOrPhrase)}` (or the exact convention GSC uses - verify in-browser once by filtering a query and copying the URL; adjust if Google uses a different operator than `!` for “contains”).
- Do **not** mix `breakdown=page` with query-row links.

Current code in [`src/lib/gsc-reporting/gsc-console-ui-url.ts`](src/lib/gsc-reporting/gsc-console-ui-url.ts) sets `query` without `!` and may omit `breakdown`; update builders and [`src/lib/gsc-reporting/__tests__/gsc-console-ui-url.test.ts`](src/lib/gsc-reporting/__tests__/gsc-console-ui-url.test.ts) accordingly.

---

## Scroll: “not the whole thing” / table not scrollable

Same as prior plan: Radix [`ScrollArea`](src/components/ui/scroll-area.tsx) viewport uses `h-full` while parents often only set `max-h-*`, which breaks overflow in flex layouts.

- In [`ReportingTab.tsx`](src/components/research/reporting/ReportingTab.tsx): give scroll roots a **definite height** (e.g. `h-[min(56vh,32rem)]`) and/or **`min-h-0`** on flex ancestors; or replace with `div` + `overflow-y-auto` for clustered + flat table blocks.

---

## Auto AI clustering (no button)

Today [`ReportingTab.tsx`](src/components/research/reporting/ReportingTab.tsx) requires clicking **“Cluster with AI”** to call `clusterGscQueriesWithOpenRouter` ([`gsc-query-cluster-ai.ts`](src/lib/gsc-reporting/gsc-query-cluster-ai.ts)).

**Desired behavior (non-negotiable):**

- **Always on import / fetch** - as soon as CSVs land in state (file upload **or** GSC API fetch completes), **immediately** start AI clustering for **every** file that parses as a queries export (`parseGscQueriesCsv` ok, rows length &gt; 0). **Do not** gate on “active tab,” “when it makes sense,” or “user opened the Queries tab first.” Import = cluster runs in the background for all qualifying files (parallel per file is acceptable; use abort on `files` change so a new import cancels in-flight runs).
- Same model as today via `getResearchModel(site.id)`.
- **Remove** the “Cluster with AI” button (and reconsider **“Clear clusters”** - either remove or keep only if needed for debugging; default: remove if it implies manual flow).
- **Loading**: show spinner / status in the clustered area while `status === 'loading'`; avoid blocking the **Table** / **Raw** toggles if possible.
- **Trigger once per file per content**: `useEffect` (or a small orchestrator in `ReportingTab` keyed by `files`) keyed on stable **file content** per index so re-renders do not spam OpenRouter. Abort previous run when **that file’s** content changes or the whole `files` array is replaced (reuse `clusterAbortRef` pattern per file index).
- **API key missing**: if no OpenRouter key, skip auto-run and surface the same message as today (toast or inline), without infinite retries.
- **Default view**: optional UX - after success, either **default to Clustered** tab/mode or stay on Table until first success; prefer **opening Clustered when ready** so users see sorted groups without an extra click (confirm in implementation; user asked for no button).

**Pipeline**: `pickClusterMarkdownForPipeline` / report generation should still receive clusters when auto-run completes (same state shape as today).

---

## Raw GSC data panel: remove grey text and double error (user request)

**Grey text to remove** - in [`ReportingTab.tsx`](src/components/research/reporting/ReportingTab.tsx) inside `RawGscDataPanel`:

1. The muted paragraph when `canCluster && parsedQueries.ok` (~lines 456–461): *“N query rows parsed. AI clusters up to … remainder … Totals are Σ clicks …”*
2. The muted line above the flat **Table** view when `showTable` (~lines 525–529): *“N data rows · M columns”* (and the optional “Showing first … rows” truncation suffix).

Delete these blocks entirely (or replace with nothing) so the panel stays clean.

**Double warning** - the same cluster failure message appears twice because:

- `runClusterAi` **catch** calls `notify.error(msg)` (app-level toast), and
- `queriesCluster?.state.status === "error"` renders an inline `<p className="text-destructive">` with the same `message`.

**Fix:** surface the error in **one place only** - e.g. **keep inline destructive text** and **remove `notify.error(msg)`** for this clustering path (or the reverse: toast only, no inline). Default recommendation: **inline only** so the message sits next to the data controls without a duplicate global toast.

---

## Implementation order

1. URL builder + tests (`breakdown`, `!` query prefix, exclusive page links).
2. Scroll fixes in `ReportingTab` for clustered + table regions.
3. Auto-cluster effect + remove manual cluster button; tighten loading/error UX.
4. Remove grey helper copy + dedupe cluster error toast vs inline (`ui-no-grey-dedupe-error`).

---

## Out of scope (unless user asks later)

- Stitched Markdown report: inline GSC links per keyword in generated prose (separate feature).
- User setting to disable auto-cluster (cost control) - add only if requested.
