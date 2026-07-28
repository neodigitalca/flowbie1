import { UrlOptimizerProgressSteps } from "@/components/research/url-optimizer/UrlOptimizerProgressPanel";
import type { UrlOptimizerRunResult } from "@/lib/url-optimizer/types";
import type { UrlOptimizerProgress } from "@/lib/url-optimizer/types";
import {
  WorkspaceDetailsKvRow,
  WorkspaceDetailsSection,
  WorkspaceDetailsStack,
} from "@/components/shared/WorkspaceDetailsStack";
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

export function UrlOptimizerDetailsPanel({
  running,
  progress,
  siteName,
  fileName,
  rowCount,
  error,
  result,
}: UrlOptimizerDetailsPanelProps) {
  let kvIndex = 0;

  return (
    <WorkspaceDetailsStack>
      <WorkspaceDetailsSection title="Workspace" stripeIndex={0}>
        {siteName ? (
          <WorkspaceDetailsKvRow label="Property" value={siteName} stripeIndex={kvIndex++} />
        ) : null}
        {fileName ? (
          <WorkspaceDetailsKvRow
            label="GSC CSV"
            value={`${fileName} (${rowCount} URL${rowCount !== 1 ? "s" : ""})`}
            stripeIndex={kvIndex++}
          />
        ) : null}
      </WorkspaceDetailsSection>

      <WorkspaceDetailsSection title="Run detail" stripeIndex={1} defaultOpen>
        {running ? (
          <>
            {progress.message?.trim() ? (
              <WorkspaceDetailsKvRow label="Status" value={progress.message.trim()} stripeIndex={0} />
            ) : null}
            <UrlOptimizerProgressSteps progress={progress} embedded />
          </>
        ) : (
          <>
            {error ? <WorkspaceDetailsKvRow label="Error" value={error} stripeIndex={0} /> : null}
            {result ? (
              <>
                <WorkspaceDetailsKvRow label="Total" value={String(result.stats.total)} stripeIndex={1} />
                <WorkspaceDetailsKvRow label="Changed" value={String(result.stats.changed)} stripeIndex={2} />
                <WorkspaceDetailsKvRow label="Unchanged" value={String(result.stats.unchanged)} stripeIndex={3} />
                <WorkspaceDetailsKvRow label="Unresolved" value={String(result.stats.unresolved)} stripeIndex={4} />
                {result.stats.errors > 0 ? (
                  <WorkspaceDetailsKvRow label="Errors" value={String(result.stats.errors)} stripeIndex={5} />
                ) : null}
              </>
            ) : null}
          </>
        )}
      </WorkspaceDetailsSection>
    </WorkspaceDetailsStack>
  );
}
