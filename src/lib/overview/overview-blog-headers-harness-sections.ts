import type { BulkHarnessSectionPayload } from "@/lib/bulk-auto-generate";
import type { HarnessSectionListItem } from "@/lib/bulk/harness-sections-reducer";
import type { BlogHeadersH2Action, BlogHeadersPlanResult } from "@/lib/overview/overview-blog-headers-agent";
import type { BlogHeadersGscPicks } from "@/lib/overview/overview-blog-headers-gsc";
import { headerTextEqual } from "@/lib/overview/overview-blog-headers-plan-filter";

export const HEADERS_HARNESS_SECTION_TITLES = [
  "GSC Keywords",
  "Analyze",
  "Plan H2s",
  "Apply H2s",
  "Verify",
] as const;

export const HEADERS_STEP_GSC = 0;
export const HEADERS_STEP_ANALYZE = 1;
export const HEADERS_STEP_PLAN = 2;
export const HEADERS_STEP_APPLY = 3;
export const HEADERS_STEP_VERIFY = 4;

export type HeadersChangeCounts = {
  optimized: number;
  added: number;
  unchanged: number;
};

export function countHeadersPlanChanges(
  plan: BlogHeadersPlanResult,
  existingH2s: string[],
): HeadersChangeCounts {
  const optimizedIndices = new Set(
    plan.h2Actions
      .filter(
        (a) =>
          a.action === "optimize" &&
          !headerTextEqual(existingH2s[a.index] ?? "", a.proposedText),
      )
      .map((a) => a.index),
  );
  const added = plan.h2Actions.filter((a) => a.action === "add").length;
  const optimized = optimizedIndices.size;
  const unchanged = existingH2s.filter((_, i) => !optimizedIndices.has(i)).length;
  return { optimized, added, unchanged };
}

export function buildWaitingHeadersHarnessSections(): HarnessSectionListItem[] {
  return HEADERS_HARNESS_SECTION_TITLES.map((title, sectionIndex) => ({
    sectionIndex,
    title,
    status: "waiting" as const,
  }));
}

export function makeHeadersHarnessStartPayload(
  rowIndex: number,
  sectionIndex: number,
): BulkHarnessSectionPayload {
  return {
    rowIndex,
    sectionIndex,
    totalSections: HEADERS_HARNESS_SECTION_TITLES.length,
    title: HEADERS_HARNESS_SECTION_TITLES[sectionIndex] ?? "Step",
    phase: "start",
  };
}

export function makeHeadersHarnessDonePayload(
  rowIndex: number,
  sectionIndex: number,
  markdownSlice: string,
): BulkHarnessSectionPayload {
  return {
    rowIndex,
    sectionIndex,
    totalSections: HEADERS_HARNESS_SECTION_TITLES.length,
    title: HEADERS_HARNESS_SECTION_TITLES[sectionIndex] ?? "Step",
    phase: "done",
    markdownSlice,
  };
}

export function formatHeadersAnalyzeMarkdown(
  existingH2s: string[],
  missingLeadingH2?: boolean,
): string {
  if (!existingH2s.length) {
    return "EXISTING H2s: none in body HTML.";
  }
  const lines = [`EXISTING H2s (${existingH2s.length} in WordPress body):`, ""];
  for (let i = 0; i < existingH2s.length; i += 1) {
    lines.push(`  ${i + 1}. ${existingH2s[i]}`);
  }
  if (missingLeadingH2) {
    lines.push("", "No H2 before the first paragraph. Plan will add leadingH2.");
  }
  return lines.join("\n");
}

export function formatHeadersPlanMarkdown(
  plan: BlogHeadersPlanResult,
  existingH2s: string[],
  gscPicks?: BlogHeadersGscPicks,
): string {
  const counts = countHeadersPlanChanges(plan, existingH2s);
  if (!plan.h2Actions.length) {
    return [
      "PLAN: OpenRouter returned no optimize actions.",
      `Expected ${existingH2s.length} rewrites (one per existing H2). Re-run Headers.`,
    ].join("\n");
  }

  const optimizes = plan.h2Actions
    .filter(
      (a) =>
        a.action === "optimize" &&
        !headerTextEqual(existingH2s[a.index] ?? "", a.proposedText),
    )
    .sort((a, b) => a.index - b.index);
  const adds = plan.h2Actions
    .filter((a) => a.action === "add")
    .sort((a, b) => a.index - b.index);
  const optimizedIndices = new Set(optimizes.map((a) => a.index));

  const lines: string[] = [];
  if (gscPicks?.headingKeywords.length) {
    lines.push(
      `GSC KEYWORDS USED FOR PLANNING: ${gscPicks.headingKeywords.slice(0, 8).join(" | ")}`,
      "",
    );
  }
  lines.push(
    `PLAN SUMMARY: ${counts.optimized} OPTIMIZE | ${counts.added} ADD | ${counts.unchanged} KEEP`,
    "",
  );

  if (plan.leadingH2?.trim()) {
    lines.push("LEADING H2 (insert before first paragraph):");
    lines.push(`  NEW: ${plan.leadingH2.trim()}`);
    lines.push("");
  }

  if (optimizes.length) {
    lines.push("OPTIMIZE (rewrite existing H2 text only):");
    for (const a of optimizes) {
      const before = existingH2s[a.index] ?? "(missing at index)";
      lines.push(`  H2 #${a.index + 1}`);
      lines.push(`    WAS: ${before}`);
      lines.push(`    NEW: ${a.proposedText}`);
      lines.push("");
    }
  }

  if (adds.length) {
    lines.push("ADD (insert new H2, body copy untouched):");
    for (const a of adds) {
      lines.push(`  NEW at list position ${a.index + 1}: ${a.proposedText}`);
      lines.push("");
    }
  }

  const kept = existingH2s
    .map((text, i) => ({ text, i }))
    .filter(({ i }) => !optimizedIndices.has(i));
  if (kept.length) {
    lines.push("KEEP (no change):");
    for (const { text, i } of kept) {
      lines.push(`  H2 #${i + 1}: ${text}`);
    }
  }

  return lines.join("\n").trimEnd();
}

function formatAppliedActionLine(action: BlogHeadersH2Action, before: string[]): string {
  if (action.action === "add") {
    return `ADDED → "${action.proposedText}" (new H2 at position ${action.index + 1})`;
  }
  const was = before[action.index] ?? "(missing)";
  if (was === action.proposedText) {
    return `OPTIMIZE #${action.index + 1} (unchanged text): "${was}"`;
  }
  return `OPTIMIZED #${action.index + 1}\n    WAS: ${was}\n    NOW: ${action.proposedText}`;
}

export function formatHeadersApplyMarkdown(
  before: string[],
  after: string[],
  plan: BlogHeadersPlanResult,
  replacements?: Array<{ was: string; now: string; ok: boolean }>,
): string {
  const counts = countHeadersPlanChanges(plan, before);
  const lines: string[] = [
    `APPLIED: ${counts.optimized} optimized | ${counts.added} added | ${counts.unchanged} kept`,
    `H2 count: ${before.length} → ${after.length}`,
    "",
  ];

  if (replacements?.length) {
    lines.push("FIND-REPLACE IN HTML (WAS → NOW):");
    for (const r of replacements) {
      if (!r.was && r.now) {
        lines.push(`  ✓ ADDED: "${r.now}"`);
        continue;
      }
      lines.push(`  ${r.ok ? "✓" : "✗"} "${r.was}" → "${r.now}"`);
    }
    lines.push("");
  } else if (plan.h2Actions.length) {
    lines.push("CHANGES EXECUTED:");
    const ordered = [...plan.h2Actions].sort((a, b) => {
      if (a.action !== b.action) return a.action === "optimize" ? -1 : 1;
      return a.index - b.index;
    });
    for (const action of ordered) {
      lines.push(`  • ${formatAppliedActionLine(action, before)}`);
    }
    lines.push("");
  } else {
    lines.push("No plan actions. All headings unchanged.");
    lines.push("");
  }

  lines.push("FINAL H2 ORDER (as saved to CSV postContent):");
  if (!after.length) {
    lines.push("  (none)");
  } else {
    for (let i = 0; i < after.length; i += 1) {
      const tag = tagFinalH2Line(after[i]!, i, before, after, plan);
      lines.push(`  ${i + 1}. [${tag}] ${after[i]}`);
    }
  }

  return lines.join("\n");
}

function tagFinalH2Line(
  text: string,
  index: number,
  before: string[],
  after: string[],
  plan: BlogHeadersPlanResult,
): string {
  const adds = plan.h2Actions.filter((a) => a.action === "add");
  for (const a of adds) {
    if (a.proposedText === text) return "ADDED";
  }
  const optimizes = plan.h2Actions.filter((a) => a.action === "optimize");
  for (const a of optimizes) {
    if (a.proposedText === text) return "OPTIMIZED";
  }
  if (index < before.length && before[index] === text) return "KEPT";
  if (before.includes(text)) return "KEPT";
  return after.length > before.length ? "ADDED" : "KEPT";
}

export function formatHeadersVerifyMarkdown(
  before: string[],
  after: string[],
  plan: BlogHeadersPlanResult,
  ok: boolean,
  reason?: string,
): string {
  const counts = countHeadersPlanChanges(plan, before);
  if (!ok) {
    return [
      "VERIFY: FAILED",
      reason ?? "Unknown error",
      "",
      `Planned: ${counts.optimized} optimize, ${counts.added} add, ${counts.unchanged} keep`,
    ].join("\n");
  }
  return [
    "VERIFY: PASSED",
    "Non-H2 body HTML is byte-identical (only H2 tags changed).",
    "",
    `Optimized: ${counts.optimized}`,
    `Added: ${counts.added}`,
    `Kept: ${counts.unchanged}`,
    `Final H2 count: ${after.length} (started with ${before.length})`,
  ].join("\n");
}
