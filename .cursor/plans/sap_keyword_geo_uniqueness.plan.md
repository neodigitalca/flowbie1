---
name: SAP keyword geo + uniqueness
overview: Strip every place name out of SAP keywords (even when the model sneaks them in), reject duplicate keyword+location rows, and add tests.
todos:
  - id: keyword-strip
    content: Make keyword cleanup smarter - drop any word that appears in the location string, and strip patterns like “127 Street” so neighborhood/street names cannot stay in the keyword column.
  - id: ceip-short
    content: Optionally shorten known program names in keywords (e.g. Clean Energy Improvement Program → CEIP) using a fixed list - no random abbreviations.
  - id: no-dup-rows
    content: After building the SAP table, error if two rows share the same keyword and the same entity (same location). Allow same keyword on different locations when that mode is intentional.
  - id: tests
    content: Add tests for the new strip behavior and duplicate detection.
  - id: prompts
    content: Add one short note in the AI prompts that the app enforces these rules server-side.
---

# SAP keywords: no places in keywords, no duplicate keyword+location

## What we will do

1. **Stronger keyword column** - Today we remove words that match the location field, but typos and things like “127 Street” can slip through. We will add a second pass that removes any keyword word that appears as a whole word in the location text, plus remove numeric street phrases. That keeps the keyword column service-only.

2. **CEIP-style shortenings** - For a few well-known programs (starting with Clean Energy Improvement Program → CEIP), shorten the keyword text using a small fixed map so you do not need the full program name in the cell.

3. **No duplicate keyword + same location** - After all rows are built, if two rows have the same keyword and the same entity string, we fail with a clear error so you are not stuck with duplicate lines in the sheet. Rows that share a keyword but have different locations stay allowed where the product already works that way.

4. **Tests** - Cover the new stripping and duplicate checks so they do not regress.

5. **Prompt line** - Tell the model in one sentence that the server enforces geography-free keywords and unique pairs, so it aligns with what the code does.

## Out of scope

- Old CSV exports do not change until you regenerate SAP through this pipeline.
