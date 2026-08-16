import type { UrlOptimizerRunResult } from "@/lib/url-optimizer/types";
import type { UrlOptimizerProgress } from "@/lib/url-optimizer/types";
import { workspaceDetailsCanOpen } from "@/lib/workspace/workspace-details-can-open";

export type UrlOptimizerDetailsPanelProps = {
  running: boolean;
  progress: UrlOptimizerProgress;
  siteName: string | null;
  fileName: string | null;
  rowCount: number;
  error: string | null;
  result: UrlOptimizerRunResult | null;
};

export function urlOptimizerDetailsCanOpen(
  hasFile: boolean,
  running: boolean,
  hasResult: boolean,
): boolean {
  return workspaceDetailsCanOpen(hasFile, running, hasResult);
}
