---
name: SAP grid Wikipedia no-fallback
overview: Local Strategy and Proposal SAP must read the Local Dominator grid CSV, allocate SAP pages per grid keyword weights, inject Wikipedia via the existing SAP research-model pipeline (fetchLocalSeoStrategyFromGrid + fetchWikipediaClustersForSapEntityHints), and never use deterministic SAP fallbacks anywhere.
todos:
  - id: disable-fallback-global
    content: Default deterministicSapFallback false; remove all buildFullDeterministicFallback usage for SAP schedule paths (fail hard)
    status: pending
  - id: grid-csv-state
    content: LD scan upload + gridSummaryMarkdown + gridKeywordWeights + placeHints in Local Strategy (and Proposal) UI state
    status: pending
  - id: weighted-targets-from-grid
    content: Build LocalKeywordTarget sapPages from gridKeywordWeights (repairSapPageAllocationWeighted) when grid present; merge or override Semrush pool rules
    status: pending
  - id: run-schedule-grid-mode
    content: runLocalStrategySapSchedule passes gridSummaryMarkdown, manualTargetsOnly false, per-keyword entityHints from grid/geo
    status: pending
  - id: research-model-wiki
    content: Keep Wikipedia intros from fetchWikipediaClustersForSapEntityHints inside fetchLocalSeoStrategyFromGrid (research model call); optional per-row enrich for CSV columns
    status: pending
  - id: supplemental-grid-plus-competitor
    content: Append competitor markdown in grid mode (Option A)
    status: pending
  - id: tests
    content: Vitest for grid weights → targets, no fallback path, region/sanitize if still relevant
    status: pending
isProject: false
---

# SAP: grid CSV, weighted pages, Wikipedia via research model, zero deterministic fallback

## User requirements (non-negotiable)

1. **No deterministic SAP fallbacks ever** - do not call `buildFullDeterministicFallback` / `buildDeterministicSapRowsFromKeywordTargets` for product SAP flows. On empty JSON, wrong row count, or invalid shape: **throw**; surface errors in UI. Remove the prior plan line that allowed Local Strategy to keep `deterministicSapFallback: true`.
2. **Read the grid CSV** - Use the Local Dominator scan pipeline (`[parseLocalDominatorCsv](src/lib/local-dominator-csv)` + `[processParsedLocalDominatorRows](src/lib/process-local-dominator-upload.ts)`) so SAP receives real `**gridSummaryMarkdown**`, `**gridKeywordWeights**`, and `**placeHints**`. This is not the competitor “top places” import (`[parseCompetitorGridTopPlaces](src/lib/competitor-research/local-dominator-grid-parse.ts)`), which only enriches Semrush.
3. **Pages per weighted number in grid CSV** - When grid weights exist, drive `**LocalKeywordTarget[]**` (keyword + `**sapPages**`) from `**gridKeywordWeights**` (see `weaknessScoreFromKeywordStats` in process-local-dominator-upload) via `[repairSapPageAllocationWeighted](src/lib/local-analysis-suggest-keyword-targets.ts)` (or equivalent) so higher-weight grid keywords get more SAP rows. Semrush-only weighting applies when **no** grid scan is loaded (document behavior).
4. **Wikipedia entries via SAP + research model** - Wikipedia context for generation stays in the **single SAP OpenRouter call**: `[fetchLocalSeoStrategyFromGrid](src/lib/local-seo-strategy-from-grid.ts)` already pulls `[fetchWikipediaClustersForSapEntityHints](src/lib/wikipedia/sap-wiki-clusters.ts)` into the user prompt before JSON output. Per-row `**lookupEntityHintWikipedia**` (`[enrichSapRowsWithWikipediaLookups](src/lib/wikipedia/enrich-sap-rows-with-wikipedia.ts)`) only adds `**wikipedia_url` / `wikipedia_title**` columns on the exported CSV; it is not a substitute for prompt-time clusters. Distinct `**entityHint**` per target (from grid place hints + geo) increases useful Wikipedia blocks.

## Current gaps


| Issue                                   | Cause                                                                                                                                                                                                                                                                                          |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `..., Edmonton, US`                     | `[parseMarketLabelForFallback](src/lib/local-seo-strategy-from-grid.ts)` defaults `region: "US"` for single-segment markets; deterministic rows use `${seg}, ${city}, ${region}`. **Eliminating deterministic fallback** removes the worst path; still fix parser/sanitize for any model slip. |
| No grid in SAP                          | `[runLocalStrategySapSchedule](src/lib/local-strategy-research/local-strategy-sap-schedule-from-grid.ts)` passes `gridSummaryMarkdown: ""`, `manualTargetsOnly: true`.                                                                                                                         |
| Weights not from grid                   | `[buildLocalStrategySapKeywordTargets](src/lib/local-strategy-research/local-strategy-sap-schedule-from-grid.ts)` uses Semrush/GSC pool only.                                                                                                                                                  |
| Local Strategy CSV without wiki columns | [LocalStrategyResearchTab](src/components/research/local/LocalStrategyResearchTab.tsx) does not call `**enrichSapRowsWithWikipediaLookups**` after SAP (Proposal may already).                                                                                                                 |


## Implementation phases

### Phase A - Disable deterministic SAP fallback globally

- Set `**deterministicSapFallback**` default to `**false**` in `[runLocalStrategySapSchedule](src/lib/local-strategy-research/local-strategy-sap-schedule-from-grid.ts)` **or** pass `false` explicitly from every caller ([LocalStrategyResearchTab](src/components/research/local/LocalStrategyResearchTab.tsx), [ProposalResearchTab](src/components/research/proposal/ProposalResearchTab.tsx), any other).
- Ensure `[fetchLocalSeoStrategyFromGrid](src/lib/local-seo-strategy-from-grid.ts)` is never invoked with fallback `true` for these flows.
- **Product impact:** blueprint / entity CSV may fail instead of downloading garbage rows - intentional.

### Phase B - Grid CSV state (Local Strategy + Proposal)

- Add state and upload UX for **LD scan** CSV: `gridSummaryMarkdown`, `gridKeywordWeights`, `placeHints` (same shapes as `[LocalAnalysisPanel](src/components/sap-generator/LocalAnalysisPanel.tsx)` / `[processParsedLocalDominatorRows](src/lib/process-local-dominator-upload.ts)`).
- Clear on workspace change.

### Phase C - Weighted targets from grid

- Extend `[buildLocalStrategySapKeywordTargets](src/lib/local-strategy-research/local-strategy-sap-schedule-from-grid.ts)` (or parallel builder) to accept optional `**gridKeywordWeights**`: build phrase + weight list, cap distinct keywords, run `**repairSapPageAllocationWeighted**` to `**targetTotal**`, producing per-keyword `**sapPages**` aligned with grid weakness scores.
- When grid present, **prefer grid-driven targets**; when absent, keep current Semrush/GSC pool behavior.

### Phase D - `runLocalStrategySapSchedule` grid mode

- New params: `gridSummaryMarkdown`, `gridPlaceHints`, `gridKeywordWeights` (types from process-local-dominator-upload).
- If `gridSummaryMarkdown?.trim()`: `manualTargetsOnly: false`, pass markdown; merge **Option A**: append `[buildLocalStrategyCompetitorGridSummaryMarkdown](src/lib/local-strategy-research/local-strategy-sap-schedule-from-grid.ts)` after grid block in `[fetchLocalSeoStrategyFromGrid](src/lib/local-seo-strategy-from-grid.ts)` so competitor evidence is not dropped in grid mode.
- Assign **per-target `entityHint**` from rotated `placeHints` + `geoLabel` so `**fetchWikipediaClustersForSapEntityHints**` returns multiple clusters (research-model prompt).

### Phase E - CSV Wikipedia columns

- After successful SAP, `**await enrichSapRowsWithWikipediaLookups(sapRows, { siteId })**` in **Local Strategy** downloads (match Proposal).

### Phase F - Region / US bug (parallel)

- Fix `[parseMarketLabelForFallback](src/lib/local-seo-strategy-from-grid.ts)` / `[buildDeterministicSapRowsFromKeywordTargets](src/lib/local-seo-strategy-from-grid.ts)` if any code path remains for tests or **remove deterministic rows entirely**; add **sanitize** correction when market hint is Canadian and third segment is `US`.

### Phase G - Tests

- Grid weights → `LocalKeywordTarget` totals and distribution.
- No fallback: mock `fetchLocalSeoStrategyFromGrid` failure → throws, no deterministic CSV.
- Optional: sanitize `US` → `AB` when hint implies Canada.

## Success criteria

- SAP schedule paths **never** return `usedFallback: true` from deterministic substitution (remove or unreachable).
- With LD grid CSV loaded, `**fetchLocalSeoStrategyFromGrid**` runs in **grid** mode with `**gridSummaryMarkdown**` and keyword targets weighted by **grid CSV**.
- Wikipedia intros in the **research model** SAP prompt scale with distinct **entityHint**s; exported CSV includes wiki URL/title columns where lookup succeeds.

