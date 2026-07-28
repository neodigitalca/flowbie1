# ACF origin hyperlocal + no duplicate location strings

## Goals

1. **ACF `origin`**: Prefer the hyperlocal phrase from each SAP **title** (e.g. text after ` in `) so Origin matches the real service area, not a broad Wikipedia/metro string. Keep Wikipedia / keyword-target **parent** logic unchanged for hints and lookups.
2. **No duplicate or redundant locations (new)**: The model and pipeline must **never** emit redundant place strings such as **`Woodstock, Woodstock, GA`** or **`Acworth, Acworth, GA`**. Same segment must not appear twice in one label. Avoid **repeating identical `entity_hint` rows** in a batch when the grid/target rules require distinct places (enforce existing distinctness + normalization).

## Problem summary

- **Keyword target / wiki column** can show **duplicated city tokens** when the model or snap step concatenates Wikipedia-style titles.
- **Bulk ACF** may set `origin` from `entity` when that string is already malformed.
- **Single-post upload** uses AI-only origin extraction and can collapse or mis-select vs the title.

## Direction

### A. Title-derived ACF origin (unchanged intent)

- Add `extractOriginFromSapTitle(title)` (with tests).
- Set optional `CSVRow.origin` on Local Analysis SAP rows when the title carries a clear `… in <place>` tail.
- **Bulk**: resolve ACF origin as `row.origin` → title extract → `entity`.
- **content-generation-upload**: pass `preferredOrigin` into the ACF origin updater; when present and geographic, **prefer it over** a second AI pass that might drop specificity.

### B. No redundant location segments (new)

**Rules to encode:**

- **Single label**: After comma-splitting normalized segments, **collapse consecutive duplicates** and **collapse case-insensitive duplicates** of the same place (e.g. `Woodstock` + `Woodstock` → one `Woodstock` before `GA`).
- **Prompts**: In [`local-analysis-suggest-from-inventory.ts`](src/lib/local-analysis-suggest-from-inventory.ts) and [`local-seo-strategy-from-grid.ts`](src/lib/local-seo-strategy-from-grid.ts) (entity / entityHint blocks), add explicit **forbidden**: *never repeat the same place name twice in one `entityHint` or `entity` string; never `City, City, Region`.*
- **Post-processing**: One shared normalizer, e.g. `dedupeLocationLabelSegments(label: string): string`, applied:
  - After suggest returns seed `entityHint` (before UI / CSV).
  - On each SAP row `entity` (and optionally `title` tails) before export or bulk, so fixes apply even when the model slips.
- **Wikipedia snap** ([`snapAllEntityHintsToWikipediaPoolTitles`](src/lib/wikipedia/extract-wikipedia-pool-titles.ts)): run **dedupe pass on output** so snapped titles do not get double-appended with the same locality.

**Row-level duplication**: Keep relying on **distinct seed `entityHint`** rules where applicable; add a final **batch dedupe** pass that warns or re-snaps only if two **seeds** end with identical normalized labels after dedupe (optional follow-up if still flaky).

## Files to touch (expected)

- New: `src/lib/sap-origin-from-title.ts` + tests  
- New: `src/lib/location-label-dedupe.ts` (or fold into one module) + tests for `Woodstock, Woodstock, GA` → `Woodstock, GA`  
- Update: [`src/lib/local-analysis-suggest-from-inventory.ts`](src/lib/local-analysis-suggest-from-inventory.ts) (prompt + call dedupe on returned hints)  
- Update: [`src/lib/local-seo-strategy-from-grid.ts`](src/lib/local-seo-strategy-from-grid.ts) (prompt + post-process `sapRows` entities if centralized here)  
- Update: [`src/components/sap-generator/LocalAnalysisPanel.tsx`](src/components/sap-generator/LocalAnalysisPanel.tsx) (optional: dedupe on display / when setting targets)  
- Update: [`src/lib/bulk-auto-generate.ts`](src/lib/bulk-auto-generate.ts) (ACF origin order + optional dedupe on `entity` before origin)  
- Update: [`acf-origin-updater.ts`](src/lib/content-generation/acf-origin-updater.ts), [`wordpress-acf-origin.ts`](src/lib/wordpress-acf-origin.ts), [`entity.ts`](src/lib/content-optimization/entity.ts), [`content-generation-upload.ts`](src/lib/content-generation-upload.ts) (preferred origin path)

## Out of scope

- Replacing Wikipedia fetch keys entirely; dedupe is **display + export + ACF safety**, not removing parent articles from the pool.

## Todos

- [ ] Add `extractOriginFromSapTitle` + unit tests  
- [ ] Add `dedupeLocationLabelSegments` + tests (Woodstock / Acworth cases)  
- [ ] Wire dedupe into suggest + SAP row pipeline; tighten prompts  
- [ ] Set `CSVRow.origin` from title in Local Analysis; bulk + single-upload ACF order  
- [ ] Pass `preferredOrigin` through ACF updater for single-post flow  
