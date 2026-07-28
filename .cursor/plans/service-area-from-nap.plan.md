# Service area: silent NAP on connect + simple UI (plan iteration)

## Problem

The **Generate Origins** dialog shows **Primary area** / **Sample locations** from [`readPreviousEntities`](src/lib/entity/read-previous.ts) → [`extractLocationFromUrls`](src/components/integrations/entity-generation/generation/urlLocationExtractor.ts). That code guesses locations from **URL path segments** (treats the last `-` token as a “state,” joins words with commas). For real sites (e.g. marketing slugs like `hunter-douglas-dealer-jupiter-florida`, `...-light`), this produces nonsense like **“Light”** and **“Hunter, Douglas, Dealer…”**.

That data was never meant as human-facing “main service area.”

## User intent (this iteration)

1. **Do not** drive the UI from sitemap slug parsing.
2. **Background, silent** when the user **connects** the site: populate **NAP / locations** the same way the product already understands “real” location data.
3. **Stay simple**: the distance UI should **only reflect stored NAP info** - not auto-fetch slug lists in the dialog.
4. **Primary location only** - **no** “sample locations,” **no** bullet lists of places. One line: the **single primary service area** (e.g. default entry in `site.locations` with `isDefault`, else first location; else a single best line from `napInfo.address` if that is all we have). Never show multiple sample origins in this block.

## What already exists

- [`extractNAPFromSite`](src/lib/nap-extractor.ts) scrapes contact / location pages and uses AI to fill [`NAPInfo`](src/components/integrations/types.ts) + `locations[]` (city, state, address, etc.).
- [`extractNAPAndSaveToKB`](src/lib/knowledge-graph-auto-trigger.ts) saves `napInfo` and `locations` onto the site in storage and adds a KB file - but it is **toast-heavy** (loading, success, errors) and is only used from **manual** flows (e.g. [`WordPressFeature`](src/components/integrations/WordPressFeature.tsx) / card actions), **not** on successful connection in [`use-wordpress-sites.ts`](src/hooks/use-wordpress-sites.ts) [`handleTestConnection`](src/hooks/use-wordpress-sites.ts).

## Target behavior

```mermaid
flowchart LR
  connect[Test connection success]
  bg[Silent NAP job]
  siteStore[Update site.napInfo + locations in storage]
  dialog[Entity dialog reads site only]

  connect --> bg
  bg --> siteStore
  siteStore --> dialog
```

1. **On successful WordPress connection** (`handleTestConnection` → `result.success`): kick off a **non-blocking** background task (no blocking spinner on the connect button beyond the existing test).
2. **Silent mode** for that task:
   - **No** `toast.loading` / `toast.success` / `toast.error` for NAP (optional: `console.log` / `console.warn` only on failure).
   - Reuse `extractNAPFromSite` + merge result into the site via `getStoredSites` / `saveSites` (same persistence shape as today: `napInfo`, `locations`).
   - **Optional simplification**: skip KB file creation and global KB events in the silent path so connect stays quiet and side effects stay minimal; or keep KB sync if product requires parity - **decision: prefer minimal** unless something else breaks.
3. **Entity dialog** ([`EntityGenerationDialog.tsx`](src/components/integrations/entity-generation/ui/EntityGenerationDialog.tsx)):
   - **Remove** the `useEffect` that calls `readPreviousEntities` for display.
   - **“Distance measured from”** block: **one label, one value** - **Primary location:** [single string]. Resolve it as: `locations.find(isDefault)` or `locations[0]` → format `city, state` (and optional zip if desired, keep minimal); if no `locations`, use **one** line from `napInfo` (e.g. `address` trimmed) if present. **Do not** render “Sample locations” or any list. If nothing yet: “Primary location: - ” or “Will appear after background NAP scan” (no slug-derived text).
4. **Radius pipeline** ([`geocodeServiceAreaOrigin`](src/lib/entity/radius-filter.ts) / orchestrator): pass **only that same primary location string** (plus site name / URL as needed). **Do not** pass `existingEntities` / sample lists into the geocode prompt.

## Files to touch (implementation, when executing)

| Area | File | Change |
|------|------|--------|
| Silent NAP | [`knowledge-graph-auto-trigger.ts`](src/lib/knowledge-graph-auto-trigger.ts) or new small helper | Extract “save NAP to site without toasts” (or `extractNAPAndSaveToKB(site, { silent: true })`). |
| Connect hook | [`use-wordpress-sites.ts`](src/hooks/use-wordpress-sites.ts) | After successful test, `void` fire silent NAP for that `site` (use latest credentials from state if needed). |
| Dialog | [`EntityGenerationDialog.tsx`](src/components/integrations/entity-generation/ui/EntityGenerationDialog.tsx) | Drop `readPreviousEntities` preview; show **primary location** line only (helper: `getPrimaryLocationLabel(site)`). |
| Radius prompt | [`radius-filter.ts`](src/lib/entity/radius-filter.ts) + [`orchestrator.ts`](src/lib/entity/orchestrator.ts) as needed | Single primary location string for geocode context; remove entity list from prompt. |

## Out of scope (unless requested later)

- Rewriting `extractLocationFromUrls` heuristics for other features (still used internally elsewhere).
- Replacing `extractNAPFromSite` with a different scraper; user asked to **use NAP** as-is.

## Verification

- Connect a site: no NAP toasts; after job completes, site object has `locations` / `napInfo` when extraction succeeds.
- Open Generate Origins: **one** primary location line (NAP-backed), **no** sample locations list, never slug word-salad.
- Radius filter still resolves origin using NAP-backed context.
