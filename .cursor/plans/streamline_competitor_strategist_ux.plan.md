---
name: Streamline competitor strategist UX
overview: Progress bar shows each strategist section (CS1, CS2, CS3) as its own step. Remove em dashes from user-facing strings in this flow; shorten notifications to punchy, human-readable lines. Backend may split one micro-step into three emits so the bar advances per section.
todos:
  - id: pipeline-micro-steps-cs
    content: Extend competitor report pipeline so strategist sections map to distinct micro steps (e.g. total 11 - prep 1-5, CS1/CS2/CS3 as 6-8, assemble 9-11). Update REPORT_PIPELINE_MICRO_TOTAL, ReportPipelineMicroStep type, emitReportMicroStep calls in competitor-report-agent.ts, and ProposalResearchTab progress text.
  - id: copy-no-emdash
    content: Replace U+2014 em dashes in Step labels, reportMicroLabel strings, and proposal/competitor tab UI with hyphens, colons, or short phrases (align with copy-no-emdash-notifications rule).
  - id: notify-punchy
    content: Shorten notify.success / notify.warning / notify.error strings in ProposalResearchTab (and CompetitorResearchTab if same flows). One clear idea per toast, no long clauses.
  - id: optional-parallel-strategist
    content: Optional - keep parallel CS1-CS3 for speed; micro steps still emit in completion order so the bar updates as each section finishes (or emit starting CSn before each await).
---

# Competitor strategist progress, copy, and notifications

## Goals (current)

1. **Each strategist section is its own step in the bar** so progress is visible through CS1, CS2, and CS3 (not one long “step 6” while all three run).
2. **No em dashes** in user-facing copy for this flow (use hyphen `-`, colon `:`, or rephrase).
3. **Notifications:** simple, punchy, human-readable (short toasts; avoid stacked clauses).

## Progress bar design

**Problem:** Today [`REPORT_PIPELINE_MICRO_TOTAL = 9`](B:/USE THIS/Flowbie/src/lib/competitor-research/competitor-report-openrouter-limits.ts) and micro step **6** covers **all three** OpenRouter strategist completions ([`competitor-report-agent.ts`](B:/USE THIS/Flowbie/src/lib/competitor-research/competitor-report-agent.ts)), so the bar does not move between CS1, CS2, and CS3.

**Direction:** Raise the total (e.g. **11 steps**) and **emit one micro step per strategist section**:

| Step | Meaning (example label, no em dash in implementation) |
|------|--------------------------------------------------------|
| 1-5 | Unchanged: clustering, wire, keywords appendix, summarize, summary ready |
| 6 | Strategist section 1 (CS1) in progress or complete |
| 7 | Strategist section 2 (CS2) |
| 8 | Strategist section 3 (CS3) |
| 9-11 | Assemble final Markdown, assembled, ready (current 7-9 shifted) |

**Parallelism:** If CS1-CS3 still run in parallel for speed, **emit micro steps when each completion resolves** (order may vary) so the bar advances 6, 7, 8 as results land; labels should name sections (CS1, CS2, CS3). Prefer **per-completion** emits for honest progress over a single pre-batch label.

**Files:** [`competitor-report-openrouter-limits.ts`](B:/USE THIS/Flowbie/src/lib/competitor-research/competitor-report-openrouter-limits.ts), [`competitor-report-agent.ts`](B:/USE THIS/Flowbie/src/lib/competitor-research/competitor-report-agent.ts), [`ProposalResearchTab.tsx`](B:/USE THIS/Flowbie/src/components/research/proposal/ProposalResearchTab.tsx) (`reportProgressPct`, status line). Update any tests that assert step totals.

**Revert prior plan idea:** We are **not** hiding the CS list until all three finish; incremental row updates stay aligned with **per-section bar steps**.

## Em dash removal (this flow)

Audit and fix strings that use ` - ` (U+2014), including:

- [`ProposalResearchTab.tsx`](B:/USE THIS/Flowbie/src/components/research/proposal/ProposalResearchTab.tsx): `Step 1 - `, `Step 3 - `, `Step 4 - `, `Step 2 - `, strategist section labels like `Ascend & Expand - opening`, etc.
- [`competitor-report-agent.ts`](B:/USE THIS/Flowbie/src/lib/competitor-research/competitor-report-agent.ts): all `emitReportMicroStep` labels (e.g. “Clustering keywords (OpenRouter) - semantic groups…”).
- [`CompetitorResearchTab.tsx`](B:/USE THIS/Flowbie/src/components/research/competitor/CompetitorResearchTab.tsx) if it mirrors report progress copy.

Prefer: **"Step 3: Competitor strategist"** style or **"Step 3 - Competitor strategist"** per project convention ([`.cursor/rules/copy-no-emdash-notifications.mdc`](B:/USE THIS/Flowbie/.cursor/rules/copy-no-emdash-notifications.mdc)).

## Notifications

Tighten strings passed to `notify.*` in the proposal generate path (and shared helpers), for example:

- Replace long success messages with short outcomes: **"Analyze done"** OK; avoid multi-part sentences where one short phrase works.
- Warnings: lead with what happened, then fix if needed (one line).
- Errors: state the block and one fix.

Scope the first pass to **proposal / competitor / local blueprint generation** toasts in [`ProposalResearchTab.tsx`](B:/USE THIS/Flowbie/src/components/research/proposal/ProposalResearchTab.tsx); extend to [`CompetitorResearchTab.tsx`](B:/USE THIS/Flowbie/src/components/research/competitor/CompetitorResearchTab.tsx) if the same notifications duplicate.

## Verification

- During Step 3, the progress **denominator** matches the new total (e.g. 11) and the **numerator advances** as CS1, CS2, and CS3 complete.
- Grep for `\u2014` or ` - ` in touched files: none in user-visible strings for this flow.
- Manual run: proposal generation through competitor strategist; toasts read short and clear.

## Out of scope unless requested again

- Merging three strategist prompts into one completion.
- Optional: bounded parallel clustering in `clusterSplitBatched` (performance only).
