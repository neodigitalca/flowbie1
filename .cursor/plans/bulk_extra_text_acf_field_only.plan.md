---
name: Bulk extra text ACF only
overview: The Overview "Bulk & multi-URL" card becomes a dedicated lane that generates and saves only the complementary extra text field - no post body, featured image, meta, or any other ACF.
todos:
  - id: new-ui-card
    content: New slim UI for bulk URLs - label it Extra text only; remove Content, Featured image, and full “what to include”
    status: pending
  - id: scope-flag
    content: Add a clear flag (e.g. extraTextFieldOnly) on the bulk path so the engine never runs full-page steps
    status: pending
  - id: skip-heavy-steps
    content: For that flag - no blueprint, no main-body link work, no featured image, no meta optimizer
    status: pending
  - id: uploader-narrow
    content: WordPress/ACF write path that updates only extra_text/seo_extra_text; no OpenRouter full-ACF merge for meta, FAQ, keyword, date
    status: pending
  - id: copy-and-progress
    content: User-facing text and progress must never claim meta, content, or other fields are changing
    status: pending
  - id: keep-other-flows
    content: Do not change single-URL Content Optimizer or other tabs unless a shared type needs widening
    status: pending
isProject: false
---

# Bulk extra text - ACF field only (new plan)

## Problem

The **Bulk & multi-URL content runs** card reuses the full content optimizer. That runs the wrong work (content, internal links, featured image, meta, and broad ACF merges) even when the user only wants the **complementary extra text** field updated. Users also see misleading toasts and options that do not match intent.

## Goal

Turn this card into a **single-purpose tool**: for each selected URL, **generate and save only** the ACF “extra text” / “SEO extra text” (whatever key pair the site uses for that one block). **Nothing else** on the post or in ACF should change on purpose.

## In scope (must)

1. **UI**
  - Replace the current bulk block’s full `ContentOptimizationControls` + `OptimizationSettingsAccordion` stack with a **dedicated** panel.  
  - It should make obvious that the run is **extra text only** (title, helper copy, primary action).  
  - Remove from this card: **Content**, **Featured image**, and any other full-page or multi-field “what to include” checkboxes.  
  - Keep: multi-URL (or post) selection, **Update** mode if still relevant, and anything needed to pick keyword / ACF context for the extra-text generator (if today that uses keyword from GSC/ACF - keep that as **input to generation** only, not as a field write).
2. **Options and pipeline**
  - For runs started **only** from this card, pass a fixed or merged scope such that:  
    - `optimizeExtraText: true`  
    - `optimizeContent`, `optimizeTitle`, `optimizeMeta`, `optimizeExcerpt`, `optimizeFeaturedImage`, `optimizeExtraImage` (if applicable): **false** for writes - unless product later adds an explicit “also extra image” toggle **only** on this card.
  - Introduce a single **machine-readable** flag (e.g. `extraTextFieldOnly: true` on pending optimization or on batch params) used end-to-end so [continue-optimization](src/hooks/content-optimization/continue-optimization.ts) and [continue-optimization-try-body](src/hooks/content-optimization/continue-optimization-try-body.ts) can **short-circuit** without forcing `optimizeMeta: true` or other overrides.
3. **Work to skip in this mode**
  - Full `generateBlueprintFlow` for main article body (use a **minimal** stub `blueprintResult` if something still needs a shape for upload).  
  - Main HTML “ensure links” / minimum links, Semrush body injects, etc.  
  - Featured image and extra image, unless you later add a separate explicit toggle.  
  - [optimizeMetaFields](src/lib/content-generation/meta-optimizer.ts) and any “meta description generated” toasts.  
  - [updateACFOriginField](src/lib/content-generation/acf-origin-updater.ts) and other ACF “nice to have” updates not named `extra text`.
4. **Write path (critical)**
  - Today [uploadToWordPress](src/lib/content-generation/wordpress-uploader.ts) can merge many ACF keys via `getACFFromOpenRouter` and force-overwrite keyword, FAQ, date, etc. In **extra-text-only** mode:  
  - **Do not** call that broad merge to push meta, FAQ, or keyword.  
  - Implement or reuse a **narrow** path: e.g. REST `acf` or known keys - **only** `extra_text` / `seo_extra_text` (or site-specific key mapping already in [acf-protocol / server](server/wordpress/acf-protocol.js) if used) - with HTML derived from the generated markdown, matching current behavior for that one field.  
  - Ensure no side effect updates **excerpt, title,** or Rank Math / meta fields.
5. **Copy**
  - Progress, toasts, and completion strings must describe **only** extra text (e.g. “Saving complementary section…”) and must **not** mention meta, “neutralized,” or full-page optimization for this card.

## Out of scope (this plan)

- Redesigning the whole Content Optimizer app.  
- Changing **single-URL** or WordPress “Integrations” full optimize flows, except shared types or small refactors required by the new flag.  
- SEM **global** rules - this plan only defines the **Overview bulk card** contract.

## Likely files

- [OverviewBulkContentRunsCollapsible.tsx](src/components/overview/OverviewBulkContentRunsCollapsible.tsx)  
- [ContentOptimizationControls.tsx](src/components/integrations/wordpress/ContentOptimizationControls.tsx) (new prop or new component)  
- [bulk-optimization.ts](src/hooks/content-optimization/bulk-optimization.ts), [handle-optimize-helpers.ts](src/hooks/content-optimization/handle-optimize-helpers.ts)  
- [continue-optimization.ts](src/hooks/content-optimization/continue-optimization.ts), [continue-optimization-try-body.ts](src/hooks/content-optimization/continue-optimization-try-body.ts)  
- [content-generation-upload.ts](src/lib/content-generation-upload.ts)  
- [wordpress-uploader.ts](src/lib/content-generation/wordpress-uploader.ts)  
- [use-optimization-state.ts](src/hooks/content-optimization/use-optimization-state.ts) / `PendingOptimization` type for the new flag

## Success check

After a run from the new bulk card: diff or inspect WordPress/ACF - **only** the extra text field is new/updated; **no** other ACF keys and no meta change attributable to this run. UI shows no irrelevant options and no misleading messages.

## Related old plan

The file [optimization_scope_refactor.plan.md](optimization_scope_refactor.plan.md) is an earlier, overlapping draft; **this** file (`bulk_extra_text_acf_field_only.plan.md`) is the canonical plan to implement.