---
name: Grid RAG for suggest
overview: Keyword Suggest currently sends only structured JSON (keyword weights + City, ST hints) to OpenRouter, while `gridPlaceHints` is intentionally regex-limited to "City, Province" from addresses. The uploaded sheet’s real evidence (addresses, full grid) is not passed to the research model, so outputs stay shallow. Fix by feeding the grid markdown and a capped raw CSV excerpt as RAG context, enriching the markdown with address samples, and clarifying prompts so hints are metro anchors - not the only allowed entity shape. Additionally, add a GBP field (company name the user enters); call DataForSEO Google My Business Info first via existing `fetchLocalStrategyGmbDfsRaw`, parse address/coords from the response, and use that to infer storefront location for filtering/suggest context before or alongside grid RAG.
todos:
  - id: enrich-grid-md-addresses
    content: Add address/business samples to buildLocalGridSummary (local-dominator-csv.ts)
    status: pending
  - id: suggest-options-rag
    content: Extend suggestKeywordTargetsFromInventory options + user message with markdown + CSV excerpt
    status: pending
  - id: panel-wire-store
    content: "LocalAnalysisPanel: store capped CSV text, pass markdown+excerpt to suggest"
    status: pending
  - id: prompt-reframe-hints
    content: Reframe gridPlaceHints + entityHint grounding in suggest system prompt
    status: pending
  - id: gbp-field-dfs-resolve
    content: GBP company name field + DataForSEO GMB Info resolve; parse address/lat/lng; infer targetAddress + suggest context
    status: pending
  - id: tests-suggest-rag
    content: Update/extend vitest for new user message sections
    status: pending
isProject: false
---

# Pass uploaded grid as RAG for keyword suggest (fix City, Province only)

(Synced copy - see Cursor plans folder for canonical version.)

## Root cause (why your UI still shows `Edmonton, AB`)

1. **[extractTopPlaceHintsFromRows](src/lib/local-dominator-csv.ts)** only matches **City, ST** via `CITY_ST_IN_ADDRESS` and counts those labels. That is what becomes `csvPlaceHints` / `gridPlaceHintsFromCsv` - **by design it cannot contain streets, parks, or neighborhoods** unless they appear as `Something, AB` in the address line.
2. **[suggestKeywordTargetsFromInventory](src/lib/local-analysis-suggest-from-inventory.ts)** builds the **user** message as **JSON only** (`totalSapPages`, `gridKeywordsWithWeaknessWeight`, `gridPlaceHintsFromCsv`, etc.). It does **not** include [gridSummaryMarkdown](src/components/sap-generator/LocalAnalysisPanel.tsx), even though the panel already has it after upload.
3. **Even `buildLocalGridSummary`** lists “weaker points” with **rank + lat/lng only** - it **never prints the `address` column** on those sample lines, so hyperlocal strings from the sheet never appear in the markdown “RAG” either.

## Implementation plan

### 1. Enrich grid markdown with address evidence

In [src/lib/local-dominator-csv.ts](src/lib/local-dominator-csv.ts) inside `buildLocalGridSummary` (or a small helper used there):

- For each keyword’s “weaker points” sample (or a dedicated section), include **truncated `address`** (and optionally `business`) from each sampled row, deduped or capped.
- Optionally add **“Address samples (from export)”** as a bulleted deduped list from `geoRows`.

### 2. Pass grid scan + optional raw CSV into the suggest API

**SuggestKeywordTargetsFromInventoryOptions** - add optional fields:

- `gridSummaryMarkdown?: string | null`
- `gridCsvRawExcerpt?: string | null` - truncated raw CSV text (cap e.g. 12–24k chars).

**User message:** JSON first, then `--- Grid scan (markdown) ---\n`, then `--- Uploaded grid CSV (excerpt) ---\n`. Apply a single total token budget.

### 3. Wire LocalAnalysisPanel

- Store capped `csvText` on upload; pass `gridSummaryMarkdown` + excerpt into `suggestKeywordTargetsFromInventory`.
- Optionally persist `gridCsvExcerpt` in session.

### 3b. GBP field - company name + DataForSEO first, then infer location

**Goal:** A dedicated **`gbp`** (or `gbpCompanyName`) field for the **business name as on Google Business Profile**. Use **DataForSEO (DFS)** to load business info **first**, then **infer location** from that response.

**Existing building blocks**

- [fetchLocalStrategyGmbDfsRaw](src/lib/local-strategy-research/local-strategy-gmb-fetch.ts) - DataForSEO **Google My Business Info** (live). `location_name` defaults to `"United States"` if omitted - **override** for Canadian/local flows using site or user context.
- Same pattern as [manager-local-analysis-analyze.ts](src/lib/local-strategy-research/manager-local-analysis-analyze.ts) (`bizQ` + `geoLabel`).
- Extend or add **parseGmbDfsAddressAndCoordinates** - extract **formatted address**, **lat/lng**, **title** from `tasks[0].result` (see [hostnameFromMyBusinessInfoResponse](src/lib/competitor-research/competitor-grid-dfs-client.ts)).

**Resolution order for `location_name` (coarse region for disambiguation)**

1. Existing **Find location / radius** label ([radiusLocationLabel](src/components/sap-generator/LocalAnalysisPanel.tsx)) when set.
2. Site primary location (`resolvePrimaryLocationLabel`, `getPrimaryCityStateLabel`, etc.).
3. Optional region hint if name-only search is ambiguous.
4. Sensible default (`Canada` vs `United States`) - avoid always defaulting to US.

**After DFS succeeds**

- Store **`gbpResolvedContext`** in panel state: `{ formattedAddress?, lat?, lng?, title? }` (trimmed; avoid huge raw JSON in `localStorage`).
- **Grid pipeline:** pass **`targetAddress`** into [processLocalDominatorCsvText](src/lib/process-local-dominator-upload.ts) from DFS formatted address when appropriate (or **“Use GBP address for filter”**).
- **Suggest:** optional `gbpBusinessContextFromDataForSeo` on `SuggestKeywordTargetsFromInventoryOptions` - short markdown summary in the user message alongside grid RAG.

**Ordering:** On **Suggest keywords**, if `gbp` is non-empty, **await DFS first**, then suggest. On failure, warn and continue with grid-only.

**Note:** [business_listings_search](server/dataforseo-routes.js) needs `location_coordinate`; **GMB Info** fits “company name + region → one record”. Optional later: Business Listings with DFS-derived `lat,lng,radius_km`.

### 4. Prompt adjustments

In [local-analysis-suggest-from-inventory.ts](src/lib/local-analysis-suggest-from-inventory.ts): reframe `gridPlaceHintsFromCsv` as metro anchors; ground `entityHint` in grid markdown + CSV + GBP context when present.

### 5. Wikipedia

Optional follow-up; UI wiki lookup remains post-hint.

### 6. Tests

- Suggest tests: markdown, CSV excerpt, GBP context in user message.
- `buildLocalGridSummary` address samples.
- GMB DFS parse helper fixtures.

### 7. Non-goals

- No change to deterministic SAP fallback row shape unless requested later.
- Keep JSON + attachments, not raw-only CSV.
