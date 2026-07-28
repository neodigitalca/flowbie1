import type { UrlOptimizerProgress, UrlOptimizerProgressPhase } from "@/lib/url-optimizer/types";

export type UrlOptimizerStepId = "parse" | "resolve" | "fetch" | "optimize";

export const URL_OPTIMIZER_STEPS: { id: UrlOptimizerStepId; label: string }[] = [
  { id: "parse", label: "Parse GSC CSV" },
  { id: "resolve", label: "Resolve WordPress URLs" },
  { id: "fetch", label: "Fetch post content" },
  { id: "optimize", label: "Optimize URL slugs" },
];

function stepIndex(phase: UrlOptimizerProgressPhase): number {
  if (phase === "parse") return 0;
  if (phase === "resolve") return 1;
  if (phase === "fetch") return 2;
  if (phase === "optimize") return 3;
  if (phase === "done") return URL_OPTIMIZER_STEPS.length;
  return -1;
}

export function urlOptimizerOverallPct(progress: UrlOptimizerProgress): number {
  const { phase, completed, total } = progress;
  if (phase === "done") return 100;
  if (phase === "idle" || phase === "error") return 0;

  const segment = 100 / URL_OPTIMIZER_STEPS.length;
  const idx = stepIndex(phase);
  if (idx < 0) return 0;

  if (phase === "parse") {
    return total > 0 ? segment : Math.max(2, segment * 0.5);
  }

  const base = segment * idx;
  const inner = total > 0 ? Math.min(1, completed / total) : 0;
  return base + inner * segment;
}

export function urlOptimizerPhasePct(progress: UrlOptimizerProgress): number | null {
  const { phase, completed, total } = progress;
  if (phase === "done") return 100;
  if (phase === "parse" && total > 0) return 100;
  if (phase === "resolve" || phase === "fetch" || phase === "optimize") {
    if (total <= 0) return null;
    return Math.round(Math.min(100, (completed / total) * 100));
  }
  return null;
}

export function urlOptimizerPhaseIndeterminate(progress: UrlOptimizerProgress): boolean {
  return progress.phase === "parse" && progress.total <= 0;
}

export function urlOptimizerStepStatus(
  stepId: UrlOptimizerStepId,
  phase: UrlOptimizerProgressPhase,
): "pending" | "active" | "done" {
  if (phase === "done") return "done";
  const current = stepIndex(phase);
  const target = URL_OPTIMIZER_STEPS.findIndex((s) => s.id === stepId);
  if (target < 0 || current < 0) return "pending";
  if (target < current) return "done";
  if (target === current) return "active";
  return "pending";
}

export function urlOptimizerActiveStepSublines(
  stepId: UrlOptimizerStepId,
  progress: UrlOptimizerProgress,
  status: "pending" | "active" | "done",
  phasePct: number | null,
): string[] {
  if (status !== "active") return [];

  const lines: string[] = [];
  if (phasePct != null) {
    lines.push(`${phasePct}% of this step`);
  }

  if (progress.message?.trim()) {
    lines.push(progress.message.trim());
  }

  if (stepId === "parse" && progress.uploadRowCount != null) {
    lines.push(`${progress.uploadRowCount} URLs in CSV`);
    return lines;
  }

  if ((stepId === "resolve" || stepId === "fetch" || stepId === "optimize") && progress.total > 0) {
    lines.push(`${progress.completed} / ${progress.total} URLs`);
  }

  if (stepId === "resolve") {
    lines.push("Matching CSV URLs to WordPress posts");
  } else if (stepId === "fetch") {
    lines.push("Loading title, meta, and body excerpt");
  } else if (stepId === "optimize") {
    lines.push("OpenRouter slug proposals");
    if (progress.detail?.trim()) {
      lines.push(progress.detail.trim());
    }
  }

  return [...new Set(lines)];
}
