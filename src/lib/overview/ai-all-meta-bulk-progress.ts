import type { OverviewRow } from "@/components/overview/overview-meta-row-types";
import type { MetaPipelineStepUi } from "@/components/overview/overview-tab-constants";
import { parseFaqEntries } from "@/lib/faq-entries";
import { overviewTitleOptimizationExcluded } from "@/lib/overview/overview-page-bucket";

export function activeRowLabelForOverview(row: OverviewRow): string {
  const title = row.title?.trim();
  if (title) return title.length > 72 ? `${title.slice(0, 69)}…` : title;
  const url = row.url?.trim();
  if (url) {
    try {
      const path = new URL(url).pathname;
      return path.length > 72 ? `${path.slice(0, 69)}…` : path || url;
    } catch {
      return url.length > 72 ? `${url.slice(0, 69)}…` : url;
    }
  }
  return "Untitled";
}

export function buildAiAllMetaPipelineSteps(row: OverviewRow): MetaPipelineStepUi[] {
  const steps: MetaPipelineStepUi[] = [];
  if (!row.seoResearch?.trim()) {
    steps.push({ id: "research", label: "Research", status: "waiting" });
  }
  if (!overviewTitleOptimizationExcluded(row)) {
    steps.push({ id: "title", label: "AI title", status: "waiting" });
  }
  steps.push({ id: "meta", label: "AI meta", status: "waiting" });
  const faq = parseFaqEntries(row.faq);
  for (let i = 0; i < faq.length; i++) {
    steps.push({ id: `faq-${i}-q`, label: `FAQ ${i + 1} question`, status: "waiting" });
    steps.push({ id: `faq-${i}-a`, label: `FAQ ${i + 1} answer`, status: "waiting" });
  }
  return steps;
}

export function countAiAllMetaStepsForRow(row: OverviewRow): number {
  return buildAiAllMetaPipelineSteps(row).length;
}

export function countAiAllMetaStepsForRows(rows: OverviewRow[]): number {
  let n = 0;
  for (const row of rows) n += countAiAllMetaStepsForRow(row);
  return n;
}

export function patchPipelineStepStatus(
  steps: MetaPipelineStepUi[],
  stepId: string,
  status: MetaPipelineStepUi["status"],
): MetaPipelineStepUi[] {
  return steps.map((s) => (s.id === stepId ? { ...s, status } : s));
}
