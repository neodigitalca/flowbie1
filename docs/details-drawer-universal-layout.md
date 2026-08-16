# Details drawer — universal layout spec

This document describes the **Details drawer** pattern used across Content Optimizer (Opt) and Generator workspace modes: shell chrome, drawer frame, body dimming, tile-parity accordions, and row behavior.

---

## Generator + Opt (2026 migration)

**Content Optimizer** is no longer a standalone mega-menu tab. It lives under **Generator** as the first pill **Opt**.

| Area | Location |
|---|---|
| Opt (single + multi-site) | `Generator` → **Opt** pill → `ContentOptimizerShell` with `generatorChrome` |
| CSV / Prompt / Import bulk | `Generator` → respective pills → `BulkGeneratorDetailsDrawer` |
| PR / Entity / Image | `PressReleaseDetailsDrawer`, `EntityDetailsDrawer`, `ImageDetailsDrawer` |
| Shared tile accordions | `src/components/shared/bulk-details-tile-sections.tsx` |
| Shared list dim class | `WORKSPACE_DETAILS_DIM_OVERLAY_CLASS` in `overview-tab-content-constants.ts` |
| Schedule control | Icon-only calendar in title band (`BulkGeneratorScheduleMenu`) |
| Pill labels | **Opt**, **Import** (not Blog Import) |

Legacy routes (`#content-optimizer`, `#overview`, `#elementor-optimizer`) redirect to `Generator` with section **opt**.

---

## Goal

The Details drawer is **not** a custom one-off panel. It reuses the same surfaces as the main Content Optimizer tile:

- Compact post row grid (`MetaOptimizerPageRowCompact`)
- Headers/Links-style accordion triggers (`META_*` tokens from `MetaOptimizerPageRowDetails`)
- Alternating black/zinc stripes (`contentOptimizerRowStripeClass`)
- Pipeline-only progress (not blueprint H2 micro-sections)

The drawer drops from the **progress band** (band 3 of `UnifiedWorkspaceChrome`) and floats above the page list below.

---

## Architecture (three layers)

```
UnifiedWorkspaceChrome (progress band)
  └── DETAILS_DRAWER_PANEL + DETAILS_DRAWER_SHELL   ← frame + scroll
        └── WorkspaceDetailsStack
              └── Page-specific detailsPanel
                    └── BulkOptimizationPanel displayMode="details-only"   ← Content Optimizer bulk
```

**Layer 1 — Chrome shell** (`UnifiedWorkspaceChrome.tsx`)

- Owns open/close state (`detailsOpen`)
- Renders the **Details** toggle in the progress band (right side)
- Mounts the drawer panel as `absolute left-0 right-0 top-full z-50` under the progress band
- Optional `onDetailsOpenChange(open)` callback for sibling UI (list dimming)

**Layer 2 — Drawer frame** (`bulk-details-drawer-styles.ts`)

- `DETAILS_DRAWER_PANEL`: positioning, max height, glass frame, borders, shadow
- `DETAILS_DRAWER_SHELL`: inner padding/controls normalization (square controls)

**Layer 3 — Drawer content** (page-specific)

- Content Optimizer bulk (Opt): `OverviewContentDetailsPanel` → `ContentOptimizerDetailsDrawer` → `BulkGeneratorDetailsDrawer` for all harness runs and micro bulk actions
- Generator CSV/Prompt/Import: `BulkGeneratorDetailsDrawer` (compact `BlogIdeaRowCompact` rows + `BulkDetailsTileSections`)
- Generator PR / Entity / Image: respective `*DetailsDrawer.tsx` modules using `CONTENT_OPTIMIZER_MULTI_SITE_ROW_STACK_CLASS`
- Shared accordion tiles: `bulk-details-tile-sections.tsx` (`BulkDetailsTileSections`, `BulkDetailsPrepAccordion`)

---

## Setup: wiring a new workspace tab

### 1. Mount `UnifiedWorkspaceChrome` with a details panel

Required props when `progressBand` is `"full"` (default):

| Prop | Purpose |
|---|---|
| `canOpenDetails` | Disable toggle when there is nothing to show |
| `detailsPanelId` | Stable id for `aria-controls` |
| `detailsPanel` | React node (your drawer body) |
| `detailsOpenSignal` | Optional: auto-open when value changes (e.g. harness start) |
| `onDetailsOpenChange` | Optional: notify parent when drawer opens/closes |

Reference: `OverviewContentHeader` in `src/components/overview/overview-tab/OverviewMetaWorkspaceBar.tsx`.

### 2. Apply drawer frame classes (do not duplicate)

```tsx
import {
  DETAILS_DRAWER_PANEL,
  DETAILS_DRAWER_SHELL,
} from "@/components/integrations/wordpress/bulk-details-drawer-styles";

// Inside UnifiedWorkspaceChrome (already wired):
className={cn(DETAILS_DRAWER_SHELL, DETAILS_DRAWER_PANEL, optionalOverride)}
```

**Important:** `DETAILS_DRAWER_SHELL` must come **before** `DETAILS_DRAWER_PANEL` in `cn()`. An earlier bug put `border-0` on the shell after the panel borders and wiped them out.

### 3. Dim the body list when drawer is open (optional but recommended)

The drawer overlaps the scrollable list. Dim the list **without disabling** it:

```tsx
import { WORKSPACE_DETAILS_DIM_OVERLAY_CLASS } from "@/components/overview/overview-tab/overview-tab-content-constants";

// Body (sibling below header):
<div className={cn(bodyScrollClass, "relative")}>
  {detailsDrawerOpen ? (
    <div className={WORKSPACE_DETAILS_DIM_OVERLAY_CLASS} aria-hidden />
  ) : null}
  {/* main list */}
</div>
```

Reference: `src/components/overview/OverviewTabContent.tsx`, `src/components/keyword-research/BulkBlogGenerationTab.tsx`.

`pointer-events-none` keeps the list scrollable/clickable while visually de-emphasized.

---

## Drawer frame tokens

File: `src/components/integrations/wordpress/bulk-details-drawer-styles.ts`

### `DETAILS_DRAWER_PANEL`

| Concern | Classes |
|---|---|
| Position | `absolute left-0 right-0 top-full z-50` |
| Height | `max-h-[min(60vh,720px)] overflow-y-auto overscroll-y-contain` |
| Glass surface | `bg-zinc-950/88 backdrop-blur-xl backdrop-saturate-150` |
| Frame | `border-x-[6px] border-b-[6px] border-t-0 border-zinc-400` |
| Elevation | `shadow-[0_20px_56px_rgba(0,0,0,0.82)]` |

No top border: the drawer visually continues from the zinc-900 progress band.

### `DETAILS_DRAWER_SHELL`

- `bg-transparent`, square controls via `CONTENT_OPTIMIZER_SQUARE_CONTROLS_CLASS`
- **Do not** add `border-0` here

---

## Content Optimizer bulk drawer body

Files: [`OverviewContentDetailsPanel.tsx`](src/components/overview/overview-tab/OverviewContentDetailsPanel.tsx), [`ContentOptimizerDetailsDrawer.tsx`](src/components/overview/overview-tab/ContentOptimizerDetailsDrawer.tsx), [`overview-bulk-details-bindings.ts`](src/lib/overview/overview-bulk-details-bindings.ts)

Mounted via `ContentOptimizerDetailsDrawer` → `BulkGeneratorDetailsDrawer` with:

- Sitemap page bucket (`BulkSitemapInventoryRunDetail`) from `useOverviewSiteWarmDetails`
- Per-row `MetaOptimizerPageRowCompact` + `BulkDetailsTileSections` sequential pipeline
- All AISEO harness run kinds and micro bulk actions via unified bindings

### DOM structure (top to bottom)

```
CONTENT_OPTIMIZER_MULTI_SITE_ROW_STACK_CLASS
├── [optional] Live message stripe
├── [optional] BulkDetailsPrepAccordion — "Sitemap prep"
├── [optional] OverviewGridPagination
└── for each bulk URL (matched to overview row):
      collapsed → MetaOptimizerPageRowCompact
      expanded  → wrapper stripe
                    ├── MetaOptimizerPageRowCompact (embedded)
                    └── BulkDetailsTileSections
                          ├── Progress (Collapsible)
                          └── Generated files (Collapsible)
```

### Row matching

- Build `overviewRowByUrl` via `normalizePageUrlKey(url)`
- Skip URLs with no matching overview row (no placeholder rows)

### Expand behavior

- Only **one** row expanded at a time: `expandedUrls` is a `Set` replaced with `new Set([url])` on toggle
- Default: Progress and Generated files accordions **closed** (`useState(false)`) until user opens them

### Stripe index

- Parent row uses `stripeIndex` from list position
- Nested accordions start at `stripeBaseIndex={stripeIndex + 1}` so black/zinc alternation continues down the stack

---

## Tile-parity accordion pattern

Reuse exported tokens from `MetaOptimizerPageRowDetails.tsx`. Do **not** invent new trigger markup.

### Exported tokens

| Token | Role |
|---|---|
| `META_TRIGGER_FLAT` | Full-width flat trigger button |
| `META_FIELD_END_RAIL` | Right rail container (count + action) |
| `META_FIELD_COUNT` | Blue total count (`text-sky-400`) |
| `META_FIELD_END_RAIL_CELL` | Count cell sizing |
| `META_FIELD_END_RAIL_BTN` | Icon action in rail (download, wand, etc.) |
| `zoneMetaAccordionStack` | Vertical stack wrapper for nested accordions |
| `MetaAccordionStripeRow` | One accordion row on alternating stripe |

### Trigger anatomy (match Headers row)

```
[icon h-4 w-4] [label flex-1 truncate] [META_FIELD_END_RAIL: count (+ optional btn)] [ChevronDown]
```

| Section | Icon | Count | Rail action |
|---|---|---|---|
| Sitemap prep | `MapIcon` (import as `Map as MapIcon` — never shadow `Map` constructor) | `sections.length` | none |
| Progress | `ListTree` | filtered pipeline steps `.length` | none |
| Generated files | `FileDown` | `files.length` | Download all (`META_FIELD_END_RAIL_BTN`, `stopPropagation` on click) |

**Counts are totals**, not done counts. Headers uses `headerList.length`; drawer uses the same rule.

### Progress list content (pipeline only)

Do not show blueprint/agent H2 micro-sections. Filter harness sections to known pipeline titles from `overview-content-prep-harness-sections.ts`:

```ts
const PIPELINE_HARNESS_TITLES = new Set([
  ...CONTENT_PREP_BATCH_SECTION_TITLES,           // Posts sitemap, Pages sitemap
  ...CONTENT_PREP_ENTITY_SAP_BATCH_SECTION_TITLES, // + Entity sitemap
  ...CONTENT_PREP_POST_SECTION_TITLES,           // SERP research brief, Blueprint and content
]);

const pipelineSections = sections.filter((s) => PIPELINE_HARNESS_TITLES.has(s.title));
```

Use `pipelineSections` for both the **end-rail count** and the numbered list inside `CollapsibleContent`.

### Expanded list body pattern

Numbered rows (same rhythm as Headers):

```tsx
<div className="flex min-w-0 items-start gap-2">
  <span className="w-6 shrink-0 tabular-nums text-muted-foreground">{i + 1}</span>
  <span className="min-w-0 flex-1 text-white">{item}</span>
</div>
```

---

## Compact post row in the drawer

File: `src/components/overview/MetaOptimizerPageRowCompact.tsx`

### Grid columns (collapsed and embedded-expanded)

From `CONTENT_OPTIMIZER_PAGE_ROW_GRID_CLASS`:

`title/url (1fr) | keyword (40%) | date (8.5rem) | chevron (2.75rem)`

### Embedded expanded row (drawer-specific)

Main tile hides title/keyword/date when expanded (`CONTENT_OPTIMIZER_PAGE_ROW_EXPANDED_GRID_CLASS` = chevron-only bar).

In the drawer, pass `embedded` so the full grid stays visible:

```tsx
const showTitleGrid = !isExpanded || embedded;
```

```tsx
<MetaOptimizerPageRowCompact
  isExpanded
  embedded
  ...
/>
```

---

## Date column behavior (drawer + grid)

The date cell reads `row.dateModifier` (fallback `row.wpDateGmt`) via `overviewRowDateLabel`.

**On content optimization start**, patch the overview row to today:

- **Bulk:** `use-overview-tab-base.ts` watches `bulkOptimizationState[batchKey].urlStatuses`; when a URL becomes `"optimizing"`, call `patchOverviewRowsDateModifierForUrls(setRows, [url])`
- **Single post:** `MetaOptimizerPageRowDetails` calls `updateRow(index, { dateModifier: overviewDateModifierTodayIso() })` **before** `handleOptimizeContentClick`

Helper: `patchOverviewRowsDateModifierForUrls` in `src/lib/overview/overview-bulk-seo-payload.ts`  
ISO format: `YYYY-MM-DD` from `overviewDateModifierTodayIso()`.

---

## Files touched (reference implementation)

| File | Responsibility |
|---|---|
| `src/components/shared/UnifiedWorkspaceChrome.tsx` | Details toggle, drawer mount, `onDetailsOpenChange` |
| `src/components/integrations/wordpress/bulk-details-drawer-styles.ts` | Frame tokens |
| `src/components/overview/OverviewTabContent.tsx` | List dim overlay |
| `src/components/overview/overview-tab/OverviewMetaWorkspaceBar.tsx` | Passes `detailsPanel`, `onDetailsOpenChange` |
| `src/components/overview/overview-tab/OverviewContentDetailsPanel.tsx` | Chooses bulk vs single panel |
| `src/components/overview/overview-tab/ContentOptimizerDetailsDrawer.tsx` | Opt universal drawer wrapper |
| `src/lib/overview/overview-bulk-details-bindings.ts` | Pipeline titles + props for all AISEO runs |
| `src/hooks/overview/use-overview-site-warm-details.ts` | Sitemap inventory + GSC hosted links |
| `src/components/shared/bulk-details-tile-sections.tsx` | Shared Generated files + Sitemap prep accordions |
| `src/components/keyword-research/bulk/BulkGeneratorDetailsDrawer.tsx` | Generator CSV/Prompt/Import drawer body |
| `src/components/integrations/wordpress/BulkOptimizationPanel.tsx` | Opt `details-only` layout |
| `src/components/overview/MetaOptimizerPageRowCompact.tsx` | Row grid + `embedded` expanded behavior |
| `src/components/overview/MetaOptimizerPageRowDetails.tsx` | Exported `META_*` tile tokens |
| `src/components/overview/overview-tab/overview-tab-content-constants.ts` | Grid/stripe class constants |
| `src/hooks/overview/use-overview-tab-base.ts` | Date-on-optimizing-start sync |
| `src/lib/overview/overview-content-prep-harness-sections.ts` | Pipeline title allowlist |

---

## Checklist: universal drawer on a new tab

1. [ ] Page uses `UnifiedWorkspaceChrome` with `detailsPanel` (not a custom dropdown)
2. [ ] Drawer frame uses `DETAILS_DRAWER_SHELL` + `DETAILS_DRAWER_PANEL` only
3. [ ] Body list dims via `onDetailsOpenChange` + non-blocking overlay (if list sits below chrome)
4. [ ] Accordion triggers use `META_TRIGGER_FLAT` + `META_FIELD_END_RAIL` + icons + **total** counts
5. [ ] Nested sections use `MetaAccordionStripeRow` + `zoneMetaAccordionStack` + continuing `stripeIndex`
6. [ ] Row component matches main grid (`MetaOptimizerPageRowCompact` or same grid classes)
7. [ ] Expanded drawer rows keep title/keyword/date visible (`embedded` pattern)
8. [ ] Progress lists filter to pipeline titles only (if harness-driven)
9. [ ] Download actions live in end rail, not floating inside collapsible body
10. [ ] No fixed-height placeholder panes, no duplicate status bands inside drawer
11. [ ] Typography minimum 1rem; no sub-1rem UI copy

---

## Anti-patterns (do not reintroduce)

- Custom drawer bands (`DetailsAccordionBody`, `detailsActiveSlot`, duplicate pipeline/status rows)
- `doneCount` in end rail (use total list length)
- Listing all blueprint H2 sections under Progress
- Chevron-only expanded row header inside the drawer
- Importing Lucide `Map` without alias (shadows native `Map` → runtime `is not a constructor`)
- `border-0` on `DETAILS_DRAWER_SHELL` after panel border classes
- Disabling the list under the drawer (dim only, `pointer-events-none` on overlay)

---

## Related workspace rules

- `.cursor/rules/universal-workspace-header.mdc` — three-band chrome; Details lives in progress band
- `.cursor/rules/typography-min-1rem.mdc` — all drawer copy at 1rem minimum
