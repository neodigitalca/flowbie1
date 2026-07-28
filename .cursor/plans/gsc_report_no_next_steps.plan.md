---
name: GSC report fewer sections and tone
overview: Remove New customer discovery, Local market visibility, and Content performance from the default GSC report; forbid Other brands or competitor buckets and Next steps blocks; normalize em dashes in output.
todos:
  - id: drop-three-sections
    content: Remove new_search_discovery, local_market_visibility, content_performance from defaultSectionsFromPayload, OUTLINE_SYSTEM, and strip if model returns them
    status: pending
  - id: prompts-ban-next-brands
    content: Ban Priority/Next steps, Other brands rows, competitor buckets in EXEC_RULES and remaining section prompts; remove em dashes from prompt strings
    status: pending
  - id: outline-exec-summary
    content: Tighten OUTLINE_SYSTEM executiveSummary (no tactical lists)
    status: pending
  - id: sanitize-emdash
    content: Replace U+2014 in sanitizeStrategistMarkdownSection + unit test
    status: pending
  - id: tests-update
    content: Update GSC outline/pipeline tests for 5 default sections; sanitize tests
    status: pending
isProject: true
---

# GSC report: drop three sections, no other brands, no next steps

## Problem

The model output includes whole sections the client does not want:

- **New customer discovery: search terms you're now found for** (with thematic tables, duplicate Edmonton rows, **Other brands and specific queries**, etc.)
- **Local market visibility: reaching customers in your area**
- **Content performance: your growing digital footprint** (segment table, Service Area / Blog / Case studies, competitor product names in prose)

Plus **Next Steps:** tactical bullets, and category framing like **Branded / Competitor/Partner** that names other entities.

Those sections are driven by [`defaultSectionsFromPayload`](src/lib/gsc-reporting/gsc-reporting-outline.ts) and the outline JSON rules in [`OUTLINE_SYSTEM`](src/lib/gsc-reporting/gsc-reporting-outline.ts). Removing them from defaults and from the outline schema instructions stops the pipeline from generating them unless we also **filter** parsed outline sections so the model cannot reinsert them.

## Target default report shape (5 sections)

Keep only:

1. `executive_summary` - Executive summary  
2. `search_performance_period` - Search performance (period vs prior)  
3. `key_performance_insights` - Key performance insights for the team  
4. `sap_local_seo` - Service area pages (SAP) and local SEO performance  
5. `growth_metrics` - Growth metrics  

**Remove** from defaults and from allowed outline output:

- `new_search_discovery`  
- `local_market_visibility`  
- `content_performance`  

Keep TypeScript union types in [`gsc-reporting-types.ts`](src/lib/gsc-reporting/gsc-reporting-types.ts) if needed for backward compatibility with stored JSON; at runtime **filter** sections to the allowed set for generation.

## Implementation

### 1. Outline and defaults ([`gsc-reporting-outline.ts`](src/lib/gsc-reporting/gsc-reporting-outline.ts))

- **`defaultSectionsFromPayload`**: Delete the three `GscReportingSectionPlan` entries above.  
- **`OUTLINE_SYSTEM`**: Update the ordered `sections` rules so only the five kinds above appear (renumber instructions; remove h2Title lines for the dropped sections).  
- **`VALID_KINDS` / parse pipeline**: After parsing outline JSON, **filter** `sections` to allowed kinds only (drop unknown or removed kinds) so a creative model cannot add back "New customer discovery" etc.

### 2. Prompts ([`gsc-reporting-section-prompts.ts`](src/lib/gsc-reporting/gsc-reporting-section-prompts.ts))

- **`EXEC_RULES` / exec summary / key insights**: Forbid **Priority Next Steps**, **Next steps**, **Recommended actions**, and standalone **Next Steps:** headings with tactical bullets.  
- **Other brands**: Explicitly forbid headings or table rows such as **Other brands and specific queries**, **Competitor/Partner**, or buckets whose purpose is to group **third-party brand names**. The report covers **this property only**; query strings from CSV may appear as **verbatim examples** in neutral columns, not as a "competitor" category.  
- Remove **em dashes** from prompt strings where present (replace with `-` or commas).  
- **`getGscReportingSectionSystemPrompt`**: Remove or leave **switch** arms for dropped section kinds (prefer **remove** dead arms to avoid accidental use, or keep behind a guard that never runs).  
- **`QUERY_THEMATIC_LAYOUT`**: Only used by removed sections; delete if unused, or keep in file with a comment if retained for a future optional section.

### 3. Sanitizer ([`competitor-report-markdown-sanitize.ts`](src/lib/competitor-research/competitor-report-markdown-sanitize.ts))

- Replace Unicode em dash `\u2014` in strategist markdown (used by [`gsc-reporting-pipeline.ts`](src/lib/gsc-reporting/gsc-reporting-pipeline.ts)).  
- Do **not** change CSV placeholders in [`gsc-reporting-fetch.ts`](src/lib/gsc-reporting/gsc-reporting-fetch.ts) unless product requires it.

### 4. Tests

- Any test that asserts **8** default sections → **5**.  
- Sanitizer test for em dash.  
- Optional: outline parse test that dropped kinds are stripped.

### 5. Optional ([`gsc-manual-ai-aggregate.ts`](src/lib/gsc-manual-ai-aggregate.ts))

- If `executiveSummary` is shown to users from the same JSON path, add the same **no next steps / no competitor-brand buckets** line to that prompt.

## Files to touch (summary)

| File | Change |
|------|--------|
| [`gsc-reporting-outline.ts`](src/lib/gsc-reporting/gsc-reporting-outline.ts) | Defaults + OUTLINE_SYSTEM + filter parsed sections |
| [`gsc-reporting-section-prompts.ts`](src/lib/gsc-reporting/gsc-reporting-section-prompts.ts) | Bans, em dash cleanup, remove dead section prompts if desired |
| [`competitor-report-markdown-sanitize.ts`](src/lib/competitor-research/competitor-report-markdown-sanitize.ts) | Em dash normalization |
| Tests under `gsc-reporting` / `competitor-report-markdown-sanitize` | Counts and sanitizer |

## Dependency

Pipeline code that iterates `outline.sections` should automatically respect fewer sections once defaults and outline filtering are correct; grep for hard-coded section counts or kind lists.
