import type { CompetitorModuleLineCount } from "@/lib/competitor-research/types";
import { COMPETITOR_MODULE_LINE_COUNTS } from "@/lib/competitor-research/competitor-module-line-counts";

const AGENTIC_FORWARD_LINE =
  "This competitor research flow is fully agentic-forward: tiering, scoring, and strategic narrative are produced by the configured research model; Semrush supplies structured competitor metrics only.";

/**
 * Appends module inventory and line counts to generated reports (and copy/download).
 */
export function formatCompetitorReportAppendix(extraModules?: CompetitorModuleLineCount[]): string {
  const rows = [...COMPETITOR_MODULE_LINE_COUNTS, ...(extraModules ?? [])];
  const lines = rows
    .map((r) => `- ${r.path}: **${r.lines}** lines`)
    .join("\n");
  return [
    "## Module inventory (agentic-forward stack)",
    "",
    AGENTIC_FORWARD_LINE,
    "",
    "### Script line counts",
    "",
    lines,
    "",
  ].join("\n");
}
