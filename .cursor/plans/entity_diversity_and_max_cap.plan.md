# Location entity diversity + obey max + OpenRouter specialist

## 0. OpenRouter research model only (no regex SEO logic)

**Requirement:** Semantic decisions (keywords, entity hints, SAP rows, strategy) must come from the **OpenRouter research model** configured in app settings (`getResearchModel` / per-site research model in [`optimization-settings-storage`](src/lib/optimization-settings-storage.ts)).

**Already true:**

- [`local-analysis-suggest-from-inventory.ts`](src/lib/local-analysis-suggest-from-inventory.ts): `model: getResearchModel(options?.siteId)` on the chat completions request.
- [`LocalAnalysisPanel.tsx`](src/components/sap-generator/LocalAnalysisPanel.tsx) `runAnalysis`: `model: researchModel` where `researchModel = getResearchModel(site.id)` passed into [`fetchLocalSeoStrategyFromGrid`](src/lib/local-seo-strategy-from-grid.ts).

**Do not add** regex-heavy pipelines for keyword/entity extraction, trimming rules, or heuristics that replace model judgment. **Allowed:** minimal JSON extraction (`JSON.parse`, slice to first `{`…`}`) to recover model output - not business rules.

**Implementation note:** Add or strengthen the **system prompt persona** (below) in both flows; no change to model ID wiring unless a bug is found.

---

## 0b. Persona: Local SEO + AI SEO specialist

Update **system** strings so the model explicitly acts as a **local SEO and AI SEO specialist** (service-area pages, geographic relevance, search intent, grid-informed priorities - not generic marketing).

**Files:**

- [`local-analysis-suggest-from-inventory.ts`](src/lib/local-analysis-suggest-from-inventory.ts) - opening line(s) of the `system` template before keyword/entity rules.
- [`local-seo-strategy-from-grid.ts`](src/lib/local-seo-strategy-from-grid.ts) - lead of `systemPrompt` before JSON shape rules.

Keep instructions concise; do not duplicate the entire spec.

---

## 1. Diversify location-based entity types (prompt-only)

**Problem:** Models overuse neighborhood names because examples skew that way.

**Changes:**

- **[`src/lib/local-analysis-suggest-from-inventory.ts`](src/lib/local-analysis-suggest-from-inventory.ts)** - Expand `entityHint` guidance with an explicit **taxonomy** for the first comma segment: borough, ward, suburb, district, postal/FSA where meaningful, industrial or retail corridor, highway strip, waterfront, park, reserve, campus, stadium/airport, named landmark, bridge/intersection, street-level area, hamlet/rural locality, etc. Require **variety across targets** when data allows; not every row a neighborhood.
- **[`src/lib/local-seo-strategy-from-grid.ts`](src/lib/local-seo-strategy-from-grid.ts)** - Mirror the same taxonomy for `sapRows[].entity` first segment; broaden grid bullets to use POIs, corridors, and address-derived names, not only “neighborhoods.” Update `targetsBlock` multi-row note and optional market copy so wording does not imply neighborhoods only.
- **[`src/components/sap-generator/LocalAnalysisPanel.tsx`](src/components/sap-generator/LocalAnalysisPanel.tsx)** (optional) - Entity field placeholder/aria to reflect “local place type, City, Province.”

---

## 2. Generation must obey the max input

**Current behavior:** `totalPagesForSuggest` (number beside the wand) is only used for **Suggest**. **Generate SAP rows** uses the sum of per-row SAP counts and ignores that max.

**Desired behavior:**

- `maxBudget = clamp(floor(totalPagesForSuggest), 1, TOTAL_SAP_CAP)`.
- `total` = sum from `normalizeKeywordTargets`.
- `targetSapCount = Math.min(total, maxBudget)`.
- When `total > maxBudget`: use [`repairSapPageAllocation`](src/lib/local-analysis-suggest-keyword-targets.ts) on normalized targets to sum to `maxBudget`; pass repaired list + `targetSapCount` to `fetchLocalSeoStrategyFromGrid`. Optional toast when scaling applied.
- Add `totalPagesForSuggest` to `runAnalysis` dependencies; import `repairSapPageAllocation` + min/max constants as needed.

---

## 3. Verification

- `npx tsc --noEmit`
- Vitest for inventory suggest if touched
- Manual: max cap + wand still uses research model; generate uses same model id in network tab or logs
