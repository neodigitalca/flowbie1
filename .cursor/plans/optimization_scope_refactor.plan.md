---
name: ""
overview: ""
todos: []
isProject: false
---

---

name: Bulk extra text only
overview: "Bulk & multi-URL" only writes the extra text ACF field. No meta, no other ACF, no main content.
todos:

- id: ui-bulk-only-extra-text
content: Bulk panel - only extra text UI (no Content / Featured Image / full-page)
- id: engine-bulk-extra-text
content: Bulk runs - extra-text path only; no blueprint, main content, or featured image
- id: write-only-extra-text-field
content: WordPress / ACF - update ONLY extra_text (or site key); do NOT touch meta or any other ACF
- id: other-surfaces-unchanged
content: Other optimizers (single-URL) keep full behavior - not this card

---

# Bulk and multi-URL: extra text only (strict)

## Product rules (all required)

1. The **"Bulk & multi-URL content runs"** block is **only** for filling/updating the **complementary extra text** ACF field (`seo_extra_text` / `extra_text` - whatever the site uses for that one block).
2. **No** main post body, **no** featured image, **no** Content/Featured toggles in this UI.
3. **Do not update meta** (Rank Math, meta description, Yoast, REST excerpt, or any “SEO meta” path).
4. **Do not update other ACF fields** (keyword focus, FAQ, date modifier, images, or merge-the-whole-ACF-via-OpenRouter with unrelated keys). The write path for this feature must be **only** the extra-text field, using a direct or narrowly scoped update - not the full “apply all local SEO ACF” merge.

## UI

- [OverviewBulkContentRunsCollapsible](src/components/overview/OverviewBulkContentRunsCollapsible.tsx): replace full [ContentOptimizationControls](src/components/integrations/wordpress/ContentOptimizationControls.tsx) + accordion with a **dedicated** “Extra text (bulk)” panel: URL pickers + run button + optional settings only for generation (e.g. keyword source), **not** a mirror of the full single-run optimizer.

## Engine

- Fixed scope from this entry: `optimizeExtraText: true`, everything else off; flag on `PendingOptimization` e.g. `extraTextFieldOnly: true` so [continue-optimization](src/hooks/content-optimization/continue-optimization.ts) and downstream code can branch.  
- Skip: blueprint for main content, main-body link passes, featured image, `optimizeMetaFields`, and any uploader path that **writes** meta or bulk ACF.  
- [wordpress-uploader](src/lib/content-generation/wordpress-uploader.ts) / ACF: today a single `getACFFromOpenRouter` merge can touch many fields - in **this mode**, call a **minimal** code path: write **only** the extra text column(s) and **never** pass `metaDescription`, `keyword`, `faq`, `date`, etc. in the `updates` object. If needed, add a small helper `updateAcfExtraTextOnly` or gate existing logic with the flag above.  
- [content-generation-upload](src/lib/content-generation-upload.ts): when `extraTextFieldOnly` (or equivalent), do not run post-upload meta optimizer or ACF origin/update steps that touch other fields.

## Success criteria

- After a bulk run, inspecting the post: **only** the extra text field content changed; **meta and all other ACF** match what they were before the run (or only change if WordPress/REST does something unavoidable - ideally not).

## What stays out of scope

- Single-URL and other tabs keep current full optimization unless you later ask to narrow them the same way.

