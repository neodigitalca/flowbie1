# Site totals MoM CSV + dynamic GSC linking

## Goals

1. **Single Site totals file** - Replace `Site-totals-current-period.csv` and `Site-totals-compare-period.csv` with one **`Site-totals-MoM.csv`**: same four metric rows, columns **Metric**, **Primary**, **Compare**, **% change vs prior** (simple `(primary − compare) / compare × 100` when compare ≠ 0; ` - ` when invalid). Comment lines include both date ranges.

2. **Everything dynamically links to Search Console** - No static URLs; all “open in GSC” behavior must go through [`src/lib/gsc-reporting/gsc-console-ui-url.ts`](src/lib/gsc-reporting/gsc-console-ui-url.ts) (`buildGscSearchAnalyticsUrl`, `normalizeGscResourceIdForUi`, `inclusiveDayCountUtc`) so links match:

   - `resource_id` = normalized property (URL-prefix with trailing slash or `sc-domain:…`)
   - `time_granularity=MONTH`
   - `num_of_days` = inclusive day count between `start_date` and `end_date`
   - `start_date` / `end_date` = the **period that tab belongs to** (primary vs compare)

   Reference shape (from product expectation):  
   `https://search.google.com/search-console/performance/search-analytics?resource_id=…&time_granularity=MONTH&num_of_days=…&start_date=…&end_date=…&…`

3. **Row-relative links** - For any CSV row that represents a **query** or **page URL**, the per-row external control must pass that row’s value into `buildGscSearchAnalyticsUrl` as **`query`** (with `gscSearchAnalyticsQueryParamValue` / leading `!`) or **`pageUrl`**, plus the **correct range** for that file (primary file → primary range; compare file → compare range). This is already the intent of [`ReportingTab.tsx`](src/components/research/reporting/ReportingTab.tsx) `RawGscDataPanel` + `GscValidateInConsoleLink`; implementation work is to **keep** that behavior for all query/page/indexed tabs and **re-validate** after the Site totals file rename.

4. **Site totals MoM (no dimension rows)** - There are no query/page rows. Show **two** explicit links above the table (not one static link):

   - **Primary period** → `buildGscSearchAnalyticsUrl({ siteUrl, range: gscFetchRange })` (no `query` / `pageUrl`)
   - **Compare period** → `buildGscSearchAnalyticsUrl({ siteUrl, range: gscCompareFetchRange })`

   Copy should say both are “monthly / same range as scorecards” where applicable.

5. **Optional audit** - User sample mixed `breakdown=query` with `page=`; our builder uses **either** `breakdown=query` + `query` **or** `breakdown=page` + `page`. If live GSC expects a `!` prefix on **page** URLs in some cases, add a follow-up check against a real GSC-copied URL for page rows only (do not change query behavior without evidence).

6. **Auto AI query clustering on import (no button)** - When GSC seed data loads (**Fetch GSC** completes or **CSV upload** finishes), automatically run the same logic as today’s **Cluster with AI** (`clusterGscQueriesWithOpenRouter` + state into `queryClusterByFile`) for query files (same file-pick rules as `pickClusterMarkdownForPipeline`: prefer the first filename containing `queries` with parseable rows). **Do not require a button** to start clustering; remove or demote the **Cluster with AI** button (optional: keep a discreet “Re-cluster” / “Clear clusters” if still useful). If there is **no OpenRouter API key**, skip auto-clustering and optionally show the existing “Add an OpenRouter API key” style feedback once, not on every render. Abort any in-flight cluster job when a new import replaces `files`.

## Implementation notes

- **Fetch:** [`src/lib/gsc-reporting/gsc-reporting-fetch.ts`](src/lib/gsc-reporting/gsc-reporting-fetch.ts) - add `gscSiteTotalsMomComparisonCsv` (or similar), replace dual site-totals pushes with one `Site-totals-MoM.csv`.
- **UI:** [`ReportingTab.tsx`](src/components/research/reporting/ReportingTab.tsx) - `friendlyGscFileLabel` → single **Site totals** label; adjust `showSiteTotalsGscLink` / header block so the **MoM** file shows **two** dynamic links (primary + compare). Ensure `gscLinkRange` logic does not mis-classify `Site-totals-MoM.csv` (filename must not accidentally trigger “compare tab” routing for row links - site totals has no row links). **Auto-cluster:** after `setFiles` from fetch or `handleFiles`, trigger clustering for the target queries index (see goal 6); default UI to **Clustered** view when auto-run succeeds, or stay on Table if clustering skipped/failed.
- **Tests:** [`src/lib/gsc-reporting/__tests__/gsc-reporting-fetch-totals.test.ts`](src/lib/gsc-reporting/__tests__/gsc-reporting-fetch-totals.test.ts) for MoM CSV; optional test in [`gsc-console-ui-url.test.ts`](src/lib/gsc-reporting/__tests__/gsc-console-ui-url.test.ts) that built URLs include `MONTH`, `start_date`, `end_date`, and `num_of_days` for a sample range.

## Out of scope

- Merging Queries/Pages **tables** into one tab (only Site totals CSV consolidation + linking rules above).

---

## Todos (tracking)

- [ ] MoM Site-totals CSV + fetch wiring
- [ ] Dynamic GSC links (primary/compare + row-relative)
- [ ] Auto AI cluster on import; remove primary Cluster button
- [ ] Tests (CSV + optional URL builder)
