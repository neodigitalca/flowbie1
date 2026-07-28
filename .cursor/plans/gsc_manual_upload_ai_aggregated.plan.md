---
name: ""
overview: ""
todos: []
isProject: false
---

# Manual GSC upload - AI-only slim output (replaces row-dump approach)

## Problem

Manual Google Search Console exports are **wide** (period comparison columns, many metrics per row) and **deep** (hundreds or thousands of queries). The previous approach stored **full CSV text** in the knowledge base and/or produced **enriched per-row CSVs**, which surfaces as **massive tables** wherever the KB is read or rendered. That is the wrong product shape.

## Scope (strict)

- **In scope:** Files brought in through **manual upload** in the Search Console tile (`GSCReportControls` → `handleManualGscFilesUpload` path). **Nothing else.**
- **Out of scope:** **Do not change** “Fetch GSC Queries” / API-driven flows, dialogs, or server routes unless required for shared utilities.

## Target behavior (single path)

1. User drops one or more **manual** GSC CSVs (any shape: Queries, comparison exports, Pages, Countries, etc.).
2. The app sends the **file contents** (and minimal metadata: filename, property/site label) to **one AI pass** (OpenRouter, same stack as the rest of the product).
3. The model returns **only** a **short, human-readable artifact** in a **fixed format**, for example:
  - **Executive summary** (bullets, max length capped).
  - **Top opportunities** table: **at most N rows** (e.g. 15–25), ranked by a clear rule the prompt states (e.g. impressions × click gap, or best CTR with min impressions).
  - **Clusters**: **at most K** clusters (e.g. 5–8), each with a label, 2–4 example queries, and one aggregate line (not full row lists).
4. That artifact is what gets **stored in the knowledge base** (e.g. one markdown or CSV that is **already slim** - not the original upload).
5. **No** storing the **raw** uploaded CSV in the KB for this flow. **No** generating a **full** row-level export from manual uploads.

## Non-negotiables (“no fallbacks”)

Interpreted as product requirements:

- **No alternate success path.** There is **one** pipeline: **AI in → slim artifact out → KB**.
- **No “if parse fails, store raw.”** If the pipeline cannot produce a valid slim artifact, **do not** append the raw file to the KB. Surface an error and stop.
- **No “if parse succeeds, enrich every row.”** Manual uploads **do not** use the old `parseGscQueriesCsv` + `getKeywordOverview` + `convertQueriesToCSV` **full** enrichment path.
- **No** “keyword metrics for every row” for manual uploads. If the product needs numbers, they appear **only** inside the **bounded** tables the model outputs, or as **aggregates** in prose.

## AI contract (sketch)

- **Input:** Concatenate or chunk large files; cap tokens per request with a documented strategy (e.g. first + last sections + sample rows, or chunked map-reduce with a second merge step - still **AI-only** outputs, no raw passthrough).
- **Output schema:** Strict JSON or markdown template with **hard caps** on:
  - number of rows in any table,
  - number of clusters,
  - total characters.
- **Validation:** If the response is empty, malformed, or exceeds caps, **fail** the request (no KB write).

## Implementation outline


| Step | Action                                                                                                                                                                      |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Remove or bypass manual-upload branches that **write raw CSV** or **full enriched query CSV** to `KB_FILES_STORAGE_KEY`.                                                    |
| 2    | Add `src/lib/gsc-manual-ai-aggregate.ts` (or similar): build prompt, call OpenRouter, validate response, return slim markdown string.                                       |
| 3    | `handleManualGscFilesUpload` (manual only): read files → call aggregate module → **single** `StoredFile` (e.g. `gsc-manual-ai-{site}-{timestamp}.md`) → `kb-files-updated`. |
| 4    | Update `GSCReportControls` copy to describe **AI summary + top/clusters**, not “same as Fetch.”                                                                             |
| 5    | Tests: mock **AI** response; assert **no** raw file write on failure; assert **one** KB file on success with size/content bounds.                                           |


## Deprecated for manual uploads only

- `parseGscQueriesCsv` / `mergeDedupeGscQueriesByMaxImpressions` / per-row `getKeywordOverview` in the **manual** handler - **do not use** for this flow unless repurposed **inside** a preprocessor the AI never bypasses (prefer not to unless needed for token budgeting).

## Success criteria

- After manual upload, the KB contains **one** concise document, not a spreadsheet of every query.
- Comparison exports like the user’s screenshot never appear **verbatim** as the stored artifact.
- Failures are **visible**; they **never** silently fall back to dumping the full sheet.

