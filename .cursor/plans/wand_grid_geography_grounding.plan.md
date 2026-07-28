# Wand: grid-only geography + weakness-weighted pages + keyword variety

## User requirements

### Geography (prior iterations)

- **No Calgary or any real city hardcoded** in the suggest system prompt - remove **all** concrete place-name examples from [`local-analysis-suggest-from-inventory.ts`](src/lib/local-analysis-suggest-from-inventory.ts); use **format-only** rules.
- **Locations only from the grid** - `entityHint` from **`gridPlaceHints`** (CSV pipeline) + **`gridKeywordsWithWeaknessWeight`**; seed URL only for business vertical when needed, not to invent a different metro.

### New: SAP pages vs rank position + keyword variety

- **Page counts should track grid position / weakness:** **worse position (weaker performance) → more SAP pages** for that keyword theme. The pipeline already computes a **weakness score** per keyword via [`weaknessScoreFromKeywordStats`](src/lib/local-dominator-csv.ts) (`avgRank`, `% rank > 10`, tail on max rank) and exposes it as `GridKeywordWeight.weight`. The wand must **allocate `sapPages` across targets in proportion to that weakness** (higher `weight` → more pages), not flat or random.
- **Variety of keywords:** Targets must reflect **multiple distinct grid keywords / competitor themes**, not a single repeated phrase. Pull from **several** high-signal rows in `gridKeywordsWithWeaknessWeight` (especially high `weight`), not only the dominant keyword.

## Root causes

- Prompt uses **Calgary-only examples** → model copies wrong geography.
- **`csvPlaceHints`** never passed to suggest → no file-grounded geo.
- Prompt only **lightly** says “prefer higher sapPages for higher weakness weight” - not strong enough for proportional allocation or multi-keyword coverage.
- Panel only passes `{ keyword, weight }[]`; **optional:** also pass per-keyword **`avgRank`** (or full `KeywordGridStats` slice) in JSON so the model sees “worse rank = more pages” explicitly. If we add state for `byKeyword` stats from [`processParsedLocalDominatorRows`](src/lib/process-local-dominator-upload.ts), we can include `gridKeywordStats` in the user payload without guessing.

## Implementation

### 1. Geography: grid place hints + prompt with zero example cities

- Add `gridPlaceHints` to suggest options; include in user JSON.
- Rewrite system prompt: **no named cities**; strict “geo only from `gridPlaceHintsFromCsv` + grid keyword text.”
- [`LocalAnalysisPanel.tsx`](src/components/sap-generator/LocalAnalysisPanel.tsx): pass **`csvPlaceHints`** on both wand paths.

### 2. Weakness → SAP allocation (explicit)

- In user JSON, include **`gridKeywordsWithWeaknessWeight`** sorted by **`weight` descending** (or keep order but document sort).
- Add rules:
  - **`weight` = weakness (higher = worse average rank / more need).** Allocate **more `sapPages` to targets whose `keyword` aligns with **higher `weight`** rows.
  - **Sum of `sapPages` must still equal `totalSapPages`.** Approximate a **proportional split** by weakness (e.g. keyword themes with top 40% of cumulative weight get a majority of pages - exact wording left to prompt, or optional **post-pass** in code to reweight rows after JSON parse using weights).
- **Optional stronger guarantee:** Persist **`KeywordGridStats[]`** (or `{ keyword, weight, avgRank }[]`) from CSV processing in panel state and pass as `gridKeywordStats` so the model (or a small **deterministic repair** after the model) can map keywords → pages.

### 3. Keyword variety (not one keyword)

- Strengthen **`minDistinctKeywordTargets`** usage: tie minimum distinct keywords to **`min(K, number of grid keywords with non-trivial weight)`** where practical (cap by existing `minDistinctTargetsForBudget`).
- Add explicit instruction: **spread targets across different `keyword` strings from `gridKeywordsWithWeaknessWeight`** - avoid assigning the entire budget to one grid phrase unless the grid only contains one keyword.
- If the grid summary lists **competitor / business names** (from scan markdown or future structured field), optional follow-up: pass **sample business labels** per keyword for entity diversity - **only if** we add minimal structured data from [`LocalDominatorRow`](src/lib/local-dominator-csv.ts) (e.g. top businesses per keyword). Mark as **phase 2** if scope is tight; phase 1 = weakness + distinct grid keywords.

### 4. Wikipedia: why paperclips are not “enabled” (and what “wiki locations” means)

**Temp seed does not block Wikipedia.** [`LocalAnalysisPanel`](src/components/sap-generator/LocalAnalysisPanel.tsx) calls [`lookupEntityHintWikipedia`](src/lib/wikipedia/entity-hint-lookup.ts) with `{ siteId: site.id }` for both keyword-target entity hints and post–Generate SAP rows - synthetic `temp-local-analysis:…` ids are fine; `siteId` is mainly for OpenRouter routing in title-pick steps.

**There is no separate “wiki locations” feed from the grid today.** Links are resolved **only from the free-text `entity` / `entityHint` string** via MediaWiki search + optional OpenRouter. The grid CSV does **not** currently supply Wikipedia URLs into that pipeline.

**When the paperclip stays a placeholder:** [`WikiEntityStatusIcon`](src/components/sap-generator/LocalAnalysisPanel.tsx) shows a **clickable** link only for `lookup.kind === "exact" | "closest"` with a URL. If the model outputs wrong geography (e.g. Calgary from prompt bias), resolution follows that; if [`lookupEntityHintWikipedia`](src/lib/wikipedia/entity-hint-lookup.ts) returns `none` / empty, or the request errors, the icon stays idle or error - **not** because of temp mode.

**User requirement (native only, no extra fallback layers):** Wikipedia stays on the **existing** path: [`lookupEntityHintWikipedia`](src/lib/wikipedia/entity-hint-lookup.ts) from each row’s `entity` / `entityHint`, plus the panel’s **current** debounced target lookups and post–Generate SAP batch (already in [`LocalAnalysisPanel`](src/components/sap-generator/LocalAnalysisPanel.tsx)). **Do not** add second-pass retries, alternate query stacks, or “retry with grid hints” inside lookup.

**What actually fixes paperclips:** **Better entity strings from the wand** - pass **`csvPlaceHints`** and neutral prompts so the model emits place names that match the grid. Then the **native** resolver (MediaWiki + optional OpenRouter inside `entity-hint-lookup`) can attach URLs the same way as everywhere else. Temp vs connected does not change that behavior.

### 5. Tests

- Payload includes `gridPlaceHintsFromCsv` when provided.
- System string has **no** “Calgary” (or grep guard in test).
- Optional: weakness-sorted payload or stats field present when panel supplies it.

## Files

| File | Change |
|------|--------|
| [`src/lib/local-analysis-suggest-from-inventory.ts`](src/lib/local-analysis-suggest-from-inventory.ts) | Options, payload, prompt: geo + weakness-proportional SAP + multi-keyword variety |
| [`src/components/sap-generator/LocalAnalysisPanel.tsx`](src/components/sap-generator/LocalAnalysisPanel.tsx) | Pass `csvPlaceHints`; optionally persist/pass `byKeyword` stats; **no** new wiki layers - keep existing debounced + post-generate wiki calls |
| [`src/lib/wikipedia/entity-hint-lookup.ts`](src/lib/wikipedia/entity-hint-lookup.ts) | **Unchanged** unless a real bug is found; native resolution only |
| [`src/lib/process-local-dominator-upload.ts`](src/lib/process-local-dominator-upload.ts) | Only if we expose stats on `ProcessLocalCsvResult` for the panel |
| [`src/lib/__tests__/local-analysis-suggest-from-inventory.test.ts`](src/lib/__tests__/local-analysis-suggest-from-inventory.test.ts) | Payload + no-Calgary |

## Todos

- [ ] options-payload: `gridPlaceHints` + optional `gridKeywordStats` / sorted weights in JSON
- [ ] prompt-grid-only: zero example cities; geo from grid only
- [ ] prompt-weakness-pages: worse weakness → more sapPages; proportional split
- [ ] prompt-keyword-variety: many distinct keywords from grid weights, not one
- [ ] panel-wire: `csvPlaceHints` + optional stats from upload
- [ ] optional-repair: deterministic sapPages reweight by weakness after model (if prompt alone is insufficient)
- [ ] wiki-via-native-entities: grid-grounded wand output so `entityHint`/`entity` strings work with **unchanged** `lookupEntityHintWikipedia` (temp + connected)
- [ ] test-payload + no-Calgary guard
