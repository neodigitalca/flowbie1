import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OptimizationArtifactDownloads } from "@/components/integrations/wordpress/OptimizationArtifactDownloads";
import {
  CONTENT_OPTIMIZER_ACTIVE_ROW_HIGHLIGHT_CLASS,
  CONTENT_OPTIMIZER_ACTIVE_ROW_TEXT_CLASS,
  CONTENT_OPTIMIZER_MULTI_SITE_ROW_STACK_CLASS,
  contentOptimizerRowStripeClass,
} from "@/components/overview/overview-tab/overview-tab-content-constants";
import { WorkspaceDetailsLiveMessage } from "@/components/shared/WorkspaceDetailsStack";
import { agentRunInlineStatus } from "@/lib/agent-runs/agent-run-display";
import { formatAgentRunLogTimeline } from "@/lib/agent-runs/agent-run-log-format";
import {
  agentRunOpenViewLabel,
  agentRunProgressHeading,
  agentRunShowsOpenView,
  agentRunShowsUrlProgress,
  resolveAgentRunRecipeKey,
} from "@/lib/agent-runs/agent-run-navigation";
import { agentRunSiteId } from "@/lib/agent-runs/agent-run-batch-key";
import { downloadAgentRunLog } from "@/lib/agent-runs/agent-run-log-download";
import { useAgentRunOptimizerScope } from "@/contexts/agent-run-optimizer-scope-context";
import { useTeam } from "@/contexts/TeamContext";
import type { AgentRun } from "@/lib/agent-runs-types";
import { isAgentRunTerminal } from "@/lib/agent-runs-types";
import { cn } from "@/lib/utils";
import { useAgentRunLiveSnapshot } from "./use-agent-run-live-snapshot";
import { useAgentRunEnrichedProgressSteps } from "./use-agent-run-enriched-progress-steps";
import { AgentRunProgressLog } from "./AgentRunProgressLog";
import { useAgentRunPostCreatorProof } from "./use-agent-run-post-creator-proof";
import { AgentRunPostCreatorProofPanel } from "./AgentRunPostCreatorProofPanel";

type AgentRunsDetailsDrawerProps = {
  run: AgentRun;
  resumable?: boolean;
  showCancel?: boolean;
  showResume?: boolean;
  onCancel?: () => void;
  onResume?: () => void;
};

export function AgentRunsDetailsDrawer({
  run,
  resumable = false,
  showCancel = false,
  showResume = false,
  onCancel,
  onResume,
}: AgentRunsDetailsDrawerProps) {
  const live = useAgentRunLiveSnapshot(run);
  const { activeTeam } = useTeam();
  const { openAgentRunOptimizer } = useAgentRunOptimizerScope();
  const runSiteId = agentRunSiteId(run);
  const isRunning = !isAgentRunTerminal(run.status);
  const showResumableError = resumable && Boolean(run.errorMessage?.trim());
  const progressSteps = useAgentRunEnrichedProgressSteps(run, live?.progressLabel ?? null);
  const timelineRows = formatAgentRunLogTimeline(run, progressSteps, live?.progressLabel ?? null);
  const proof = useAgentRunPostCreatorProof(run);
  const recipeKey = resolveAgentRunRecipeKey(run);
  const showsUrlProgress = agentRunShowsUrlProgress(recipeKey);
  const progressHeading = agentRunProgressHeading(recipeKey);
  const openViewLabel = agentRunOpenViewLabel(recipeKey);

  const currentUrl = showsUrlProgress ? (live?.currentUrl ?? null) : null;
  const postTitle = live?.postTitle ?? null;
  const positionLabel = live?.positionLabel ?? null;
  const inlineStatus = live?.progressLabel
    ? agentRunInlineStatus(live.progressLabel)
    : isRunning
      ? "Starting…"
      : "\u00a0";
  const generatedFiles = live?.generatedFiles ?? [];
  const statusTitle = inlineStatus.trim() && inlineStatus !== "\u00a0" ? inlineStatus : undefined;

  let stripeIndex = 0;

  return (
    <div className={CONTENT_OPTIMIZER_MULTI_SITE_ROW_STACK_CLASS}>
      {showResumableError ? (
        <WorkspaceDetailsLiveMessage message={run.errorMessage!.trim()} stripeIndex={stripeIndex++} />
      ) : null}

      {showsUrlProgress ? (
        <div
          className={cn(
            contentOptimizerRowStripeClass(stripeIndex++, { isActiveOptimize: isRunning && Boolean(currentUrl) }),
            isRunning && currentUrl && CONTENT_OPTIMIZER_ACTIVE_ROW_HIGHLIGHT_CLASS,
          )}
        >
          <div className="agent-runs-card__current border-0 px-2.5 py-2 sm:px-3">
            <div className="flex min-h-[1.5rem] min-w-0 items-center gap-2">
              <span className="shrink-0 text-base text-muted-foreground">{progressHeading}</span>
              <span
                className="agent-runs-card__status-line min-w-0 flex-1 text-base text-white"
                title={statusTitle}
              >
                {inlineStatus}
              </span>
              <span className="shrink-0 tabular-nums text-base text-muted-foreground">
                {positionLabel ?? "\u00a0"}
              </span>
            </div>

            <div className="agent-runs-card__current-link min-h-[1.5rem]">
              {currentUrl ? (
                <a
                  href={currentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "text-base font-semibold [overflow-wrap:anywhere] hover:text-cyan-300 hover:underline",
                    isRunning ? CONTENT_OPTIMIZER_ACTIVE_ROW_TEXT_CLASS : "text-zinc-100",
                  )}
                  onClick={(e) => e.stopPropagation()}
                >
                  {postTitle || currentUrl}
                </a>
              ) : (
                <span className="text-base text-muted-foreground">{isRunning ? "Starting…" : "\u00a0"}</span>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {recipeKey === "post_creator" && proof ? (
        <div className={contentOptimizerRowStripeClass(stripeIndex++)}>
          <div className="border-0 px-2.5 py-2 sm:px-3">
            <AgentRunPostCreatorProofPanel
              rows={proof.rows}
              activeRowIndex={proof.activeRowIndex}
              contentBucketFiles={proof.contentBucketFiles}
            />
          </div>
        </div>
      ) : null}

      {recipeKey === "post_creator" && (run.result?.uploadedPosts?.length || run.result?.blockedRows?.length) ? (
        <div className={contentOptimizerRowStripeClass(stripeIndex++)}>
          <div className="space-y-2 border-0 px-2.5 py-2 sm:px-3">
            {run.result?.uploadedPosts?.length ? (
              <div>
                <p className="text-base text-muted-foreground">Uploaded posts</p>
                <ul className="mt-1 space-y-1">
                  {run.result.uploadedPosts.map((post) => (
                    <li key={post.url}>
                      <a
                        href={post.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-base font-semibold text-cyan-300 hover:underline [overflow-wrap:anywhere]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {post.title || post.url}
                      </a>
                      {post.postId != null || post.scheduledFor ? (
                        <span className="ml-2 text-base text-muted-foreground">
                          {post.postId != null ? `ID ${post.postId}` : ""}
                          {post.postId != null && post.scheduledFor ? ", " : ""}
                          {post.scheduledFor ? `scheduled ${post.scheduledFor}` : ""}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {run.result?.blockedRows?.length ? (
              <div>
                <p className="text-base text-muted-foreground">Blocked (cannibalization)</p>
                <ul className="mt-1 space-y-1">
                  {run.result.blockedRows.map((row) => (
                    <li key={`${row.keyword}-${row.reason}`} className="text-base text-zinc-200 [overflow-wrap:anywhere]">
                      {row.keyword}: {row.reason}
                      {row.conflictingUrl ? (
                        <>
                          {" "}
                          <a
                            href={row.conflictingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-cyan-300 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {row.conflictingUrl}
                          </a>
                        </>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className={contentOptimizerRowStripeClass(stripeIndex++)}>
        <div className="border-0 py-1 px-2.5 sm:px-3">
          <AgentRunProgressLog rows={timelineRows} />
        </div>
      </div>

      <div className={contentOptimizerRowStripeClass(stripeIndex++)}>
        <div className="flex min-h-[2.75rem] min-w-0 items-center gap-2 border-0 px-2.5 py-2 sm:px-3">
          {showCancel ? (
            <Button
              type="button"
              variant="secondary"
              className="h-8 w-fit shrink-0 text-base"
              onClick={(e) => {
                e.stopPropagation();
                onCancel?.();
              }}
            >
              Cancel
            </Button>
          ) : showResume ? (
            <Button
              type="button"
              variant="secondary"
              className="h-8 w-fit shrink-0 text-base"
              onClick={(e) => {
                e.stopPropagation();
                onResume?.();
              }}
            >
              Resume
            </Button>
          ) : null}
          {runSiteId && agentRunShowsOpenView(recipeKey) ? (
            <Button
              type="button"
              variant="ghost"
              className="h-8 shrink-0 px-2 text-base text-cyan-300 hover:bg-white/10 hover:text-cyan-200"
              onClick={(e) => {
                e.stopPropagation();
                openAgentRunOptimizer(run);
              }}
            >
              {openViewLabel}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 shrink-0 px-2 text-base text-white hover:bg-white/10 hover:text-white"
            aria-label="Download log (JSON)"
            onClick={(e) => {
              e.stopPropagation();
              void downloadAgentRunLog(run, progressSteps, activeTeam?.id ?? null);
            }}
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
          </Button>
          {generatedFiles.length > 0 ? (
            <div className="ml-auto min-w-0">
              <OptimizationArtifactDownloads files={generatedFiles} variant="details" />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
