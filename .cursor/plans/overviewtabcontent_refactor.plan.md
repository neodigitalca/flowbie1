---
name: OverviewTabContent refactor
overview: Split OverviewTabContent.tsx (~3,165 lines) so every module is at most 500 lines, with semantic grouping and explicit file budgets.
todos:
  - id: extract-pure
    content: Extract constants, pure helpers, bulk micro UI, collapsible; delete dead META_* in OverviewTabContent (each output file ≤500 lines)
    status: pending
  - id: split-hooks
    content: Add hooks / handler modules capped at 500 lines each; sub-split any feature that would exceed the cap
    status: pending
  - id: split-jsx
    content: Add panel/section components; if a component exceeds 500 lines, split dialogs vs form vs list
    status: pending
  - id: slim-shell
    content: OverviewTabContent.tsx ≤500 lines; tsc + manual QA
    status: pending
isProject: false
---

# OverviewTabContent refactor - **500 line max per script (hard rule)**

## Rule

- **No file may exceed 500 lines** (imports, types, exports, and blank lines included).
- If a logical unit (e.g. one hook) would exceed 500 lines, **split by sub-feature** (e.g. `use-overview-ai-faq.ts` + `use-overview-ai-title-meta.ts`) until each file is ≤500.
- After each extraction, **measure** (`wc -l` / IDE line count) and split again if over.

## Line counter per script (measured today)

Counts are **full file line count** (`@(Get-Content path).Count` in PowerShell), including blanks - as of plan update.

### Existing files (repo today)


| Lines    | Script                                                                                                                                                      |      |                                                                                                  |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------ |
|          |                                                                                                                                                             | 3164 | [src/components/overview/OverviewTabContent.tsx](src/components/overview/OverviewTabContent.tsx) |
| 904      | [src/components/overview/MetaOptimizerPageRowDetails.tsx](src/components/overview/MetaOptimizerPageRowDetails.tsx)                                          |      |                                                                                                  |
| 27       | [src/components/overview/overview-meta-row-patches.ts](src/components/overview/overview-meta-row-patches.ts)                                                |      |                                                                                                  |
| 38       | [src/components/overview/overview-meta-row-types.ts](src/components/overview/overview-meta-row-types.ts)                                                    |      |                                                                                                  |
| 25       | [src/hooks/overview/use-connected-wordpress-site.ts](src/hooks/overview/use-connected-wordpress-site.ts)                                                    |      |                                                                                                  |
| **1042** | [src/hooks/overview/use-overview-ai-optimize.ts](src/hooks/overview/use-overview-ai-optimize.ts) - **already over 500**; split when touched or as follow-up |      |                                                                                                  |
| 134      | [src/hooks/overview/use-overview-download.ts](src/hooks/overview/use-overview-download.ts)                                                                  |      |                                                                                                  |
| 72       | [src/hooks/overview/use-overview-scrape.ts](src/hooks/overview/use-overview-scrape.ts)                                                                      |      |                                                                                                  |
| 61       | [src/hooks/overview/use-overview-sitemap.ts](src/hooks/overview/use-overview-sitemap.ts)                                                                    |      |                                                                                                  |
| 237      | [src/hooks/overview/use-overview-upload.ts](src/hooks/overview/use-overview-upload.ts)                                                                      |      |                                                                                                  |
| 153      | [src/hooks/overview/use-overview-wordpress-binding.ts](src/hooks/overview/use-overview-wordpress-binding.ts)                                                |      |                                                                                                  |


**Sum of lines above (overview folder + hooks/overview):** 5857 - not all of this moves into new files; much stays imported/called from the shell.

### Planned new scripts (not created yet)


| Lines today   | Max after refactor | Script                                   |
| ------------- | ------------------ | ---------------------------------------- |
| - | ≤120               | `overview-tab-constants.ts`              |
| - | ≤80                | `overview-tab-display.ts`                |
| - | ≤90                | `overview-entity-keyword-assign.ts`      |
| - | ≤100               | `overview-row-helpers.ts`                |
| - | ≤150               | `OverviewBulkMicroProgress.tsx`          |
| - | ≤200               | `OverviewBulkContentRunsCollapsible.tsx` |
| - | ≤500               | `use-overview-sitemap-and-rows.ts`       |
| - | ≤500               | `use-overview-scrape-and-wp.ts`          |
| - | ≤500               | `use-overview-ai-title-meta-url.ts`      |
| - | ≤500               | `use-overview-ai-faq-and-keywords.ts`    |
| - | ≤500               | `use-overview-research-and-audit.ts`     |
| - | ≤500               | `OverviewSitemapBulkForm.tsx`            |
| - | ≤500 each          | `OverviewTabDialogs.tsx` (or split)      |
| - | ≤500               | `OverviewPagesSection.tsx`               |
| 3164 → target | **≤500**           | `OverviewTabContent.tsx` (shell only)    |


## Current size inside the monolith (approximate blocks)


| Block                                         | Approx lines |
| --------------------------------------------- | ------------ |
| Whole OverviewTabContent                      | 3164         |
| Main component (state + handlers)             | ~1,930       |
| JSX `return`                                  | ~695         |
| Embedded `OverviewBulkContentRunsCollapsible` | ~142         |
| Top helpers + bulk micro                      | ~200         |


Minimum file count if perfectly packed: **ceil(3164 / 500) ≈ 7**; realistically **12–16 new/changed files** to respect semantics and the cap.

## Target file list (each ≤500 lines)

Budgets are **targets / max**; aim lower where easy.


| #   | Path                                                             | Role                                                                                                            | Max lines |
| --- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | --------- |
| 1   | `src/components/overview/overview-tab-constants.ts`              | `OVERVIEW_MANUAL_SITEMAP_VALUE`, FAQ seed min/max, `MetaBulkActionKey`, bulk micro labels/order                 | ≤120      |
| 2   | `src/lib/overview/overview-tab-display.ts`                       | `metaDisplayTitle`, `formatWpDateLine`, `wpStatusLabel`                                                         | ≤80       |
| 3   | `src/lib/overview/overview-entity-keyword-assign.ts`             | `EntityKeywordDraftSpec`, `applySpecsToRows`                                                                    | ≤90       |
| 4   | `src/lib/overview/overview-row-helpers.ts`                       | `clampBulkAiFaqSeed`, `bulkAiFaqSeedStorageKey`, `applyFaqPlaceholderCountToRows`, `stripHtmlForKeywordContext` | ≤100      |
| 5   | `src/components/overview/OverviewBulkMicroProgress.tsx`          | `pickMetaBulkMicroSnapshot`, `MetaBulkMicroProgress` UI                                                         | ≤150      |
| 6   | `src/components/overview/OverviewBulkContentRunsCollapsible.tsx` | Collapsible + bulk content runs (moved out of OverviewTabContent)                                               | ≤200      |
| 7   | `src/hooks/overview/use-overview-sitemap-and-rows.ts`            | Sitemap state, `handleLoadSitemap`, row CRUD, sort, CSV export that only touches rows                           | ≤500      |
| 8   | `src/hooks/overview/use-overview-scrape-and-wp.ts`               | Scrape row/all, WP upload/download row, binding-assisted flows                                                  | ≤500      |
| 9   | `src/hooks/overview/use-overview-ai-title-meta-url.ts`           | AI title/meta/URL row + bulk handlers for those                                                                 | ≤500      |
| 10  | `src/hooks/overview/use-overview-ai-faq-and-keywords.ts`         | FAQ AI, entity/content keyword handlers, date modifiers, related bulk                                           | ≤500      |
| 11  | `src/hooks/overview/use-overview-research-and-audit.ts`          | DataForSEO research, Semrush audit/analyze, research all, optimize all, AI All Meta                             | ≤500      |
| 12  | `src/components/overview/OverviewSitemapBulkForm.tsx`            | Sitemap + bulk action row UI only (no dialogs)                                                                  | ≤500      |
| 13  | `src/components/overview/OverviewTabDialogs.tsx`                 | FAQ settings + entity keyword dialogs (or split into two files if either >500)                                  | ≤500 each |
| 14  | `src/components/overview/OverviewPagesSection.tsx`               | Pages header, sort, empty state, page row list + `MetaOptimizerPageRowDetails`                                  | ≤500      |
| 15  | `src/components/overview/OverviewTabContent.tsx`                 | **Shell only**: compose hooks, pass props, root layout, error strip                                             | **≤500**  |


**If any of rows 7–11 still exceeds 500 lines after a mechanical move**, split further, for example:

- `use-overview-ai-title-meta-url.ts` → `use-overview-ai-title.ts` + `use-overview-ai-meta-url.ts`
- `use-overview-research-and-audit.ts` → `use-overview-dfs-research.ts` + `use-overview-semrush-audit.ts` + thin orchestrator ≤500 lines that calls both

**If row 12 or 13 exceeds 500**, split dialogs: `OverviewDialogBulkFaqSettings.tsx`, `OverviewDialogEntityKeywords.tsx`.

## Deletions / consolidation

- Remove **unused** duplicate `META_*` style constants from OverviewTabContent (lines ~170–190) - live styles already exist on [MetaOptimizerPageRowDetails.tsx](src/components/overview/MetaOptimizerPageRowDetails.tsx). Optional follow-up: one shared `overview-meta-styles.ts` (also ≤500 lines) imported by both.

## Verification

- `npx tsc --noEmit`
- **Line count gate**: every new/changed file `lines ≤ 500`
- Smoke: load sitemap, scrape one row, one bulk action, one AI action, Pages sort

## Execution order

1. Extract 1–6 (pure + small components) - fastest line-count win, lowest risk.
2. Extract 12–14 (JSX panels) - move markup only; keep props explicit.
3. Carve 7–11 from monolith one hook at a time; **stop and sub-split** whenever a file crosses 500 lines.
4. Shrink 15 to ≤500 lines; wire everything.

