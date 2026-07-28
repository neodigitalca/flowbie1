import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BulkOptimizationState } from "@/hooks/content-optimization/use-optimization-state";
import {
  META_BULK_MICRO_LABELS,
  META_BULK_MICRO_ORDER,
  type MetaBulkActionKey,
  type BulkProgressSlice,
  type MetaPipelineStepUi,
} from "@/components/overview/overview-tab-constants";
import { pickActiveBulkProgressSlice } from "@/lib/overview/overview-bulk-inline-status";
import { WorkspaceDetailsPipelineStepRow } from "@/components/shared/WorkspaceDetailsPipelineSteps";
export type MetaBulkMicroSnapshot = {
  label: string;
  completed: number;
  total: number;
  statusMessage?: string;
  /** Harness batch fill % for neon bar (optional). */
  progressPct?: number;
};

/** Hide inline row when it repeats the header (e.g. default BULK_INLINE_STATUS copy). */
function shouldShowBulkInlineStatus(headerLabel: string, statusMessage?: string): boolean {
  const status = statusMessage?.trim();
  if (!status) return false;
  return status.toLowerCase() !== headerLabel.trim().toLowerCase();
}

function countBatchProcessed(batchState: BulkOptimizationState): { completed: number; total: number } {
  // WP upload: one tick per max-25 parallel batch, not per post.
  if (batchState.runKind === "wpUpload" && batchState.batchPipelineSteps?.length) {
    const total = batchState.batchPipelineSteps.length;
    const completed = batchState.batchPipelineSteps.filter((s) => s.status === "done").length;
    return { completed: Math.min(completed, total), total };
  }
  const urls = batchState.urls || [];
  const total = urls.length;
  let completed = 0;
  for (const u of urls) {
    const st = batchState.urlStatuses?.[u];
    if (st === "completed" || st === "skipped" || st === "error") {
      completed += 1;
    }
  }
  return { completed: Math.min(completed, total), total };
}

function batchRunLabel(batchState: BulkOptimizationState, siteName?: string): string {
  const siteSuffix = siteName?.trim() ? ` - ${siteName.trim()}` : "";
  switch (batchState.runKind) {
    case "research":
      return `Research${siteSuffix}`;
    case "aiAllMeta":
      return `AI All Meta${siteSuffix}`;
    case "wpUpload":
      return `WordPress upload${siteSuffix}`;
    case "extraText":
      return `AI Extra Text${siteSuffix}`;
    case "aiFaq":
      return `AI FAQs${siteSuffix}`;
    case "aiHeaders":
      return `Headers${siteSuffix}`;
    case "contentCleanup":
      return `Clean Up${siteSuffix}`;
    case "aiLinks":
      return `Links${siteSuffix}`;
    case "aiOverview":
      return `Overview${siteSuffix}`;
    case "aiInContentImage":
      return `In Content Image${siteSuffix}`;
    default:
      return siteName?.trim() ? `Content Optimizer - ${siteName.trim()}` : META_BULK_MICRO_LABELS.optimizeAll;
  }
}

function defaultBatchStatusMessage(batchState: BulkOptimizationState): string {
  switch (batchState.runKind) {
    case "research":
      return "Researching";
    case "aiAllMeta":
      return "Processing pages";
    case "wpUpload":
      return "Uploading to WordPress";
    case "extraText":
      return "Generating extra text";
    case "aiFaq":
      return "Processing FAQ pairs";
    case "aiHeaders":
      return "Processing H2 headers";
    case "contentCleanup":
      return "Cleaning post HTML";
    case "aiLinks":
      return "Processing internal links";
    case "aiOverview":
      return "Prepending Overview";
    case "aiInContentImage":
      return "Generating in-content image";
    default:
      return "Optimizing page content";
  }
}

function buildBatchMicroSnapshot(
  batchState: BulkOptimizationState,
  siteName?: string,
  runLabelOverride?: string,
): MetaBulkMicroSnapshot {
  const { completed, total } = countBatchProcessed(batchState);
  const step =
    (typeof batchState.currentStepProgress?.message === "string" &&
      batchState.currentStepProgress.message.trim()) ||
    (typeof batchState.currentStep === "string" && batchState.currentStep.trim()) ||
    defaultBatchStatusMessage(batchState);
  const label = runLabelOverride?.trim() || batchRunLabel(batchState, siteName);
  const rawPct = batchState.currentStepProgress?.progress ?? batchState.currentProgress;
  const pagePct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const harnessPct =
    typeof rawPct === "number" && Number.isFinite(rawPct) ? Math.min(100, Math.max(0, rawPct)) : 0;
  const progressPct = Math.min(100, Math.max(pagePct, harnessPct));
  return {
    label,
    completed,
    total,
    progressPct,
    statusMessage: shouldShowBulkInlineStatus(label, step) ? step : undefined,
  };
}

function isActiveBatchProgress(
  batchState: BulkOptimizationState | null | undefined,
  isBatchContentRunning: boolean,
): batchState is BulkOptimizationState {
  if (!batchState?.urls?.length) return false;
  if (isBatchContentRunning) return true;
  const { completed, total } = countBatchProcessed(batchState);
  return completed < total;
}

export type PickMetaBulkMicroSnapshotOptions = {
  runLabelOverride?: string;
};

export function pickMetaBulkMicroSnapshot(
  bulkActionProgress: Partial<Record<MetaBulkActionKey, BulkProgressSlice>>,
  batchState: BulkOptimizationState | null | undefined,
  isBatchContentRunning: boolean,
  siteName?: string,
  options?: PickMetaBulkMicroSnapshotOptions,
): MetaBulkMicroSnapshot | null {
  const runLabelOverride = options?.runLabelOverride;
  if (isActiveBatchProgress(batchState, isBatchContentRunning)) {
    return buildBatchMicroSnapshot(batchState, siteName, runLabelOverride);
  }
  for (const key of META_BULK_MICRO_ORDER) {
    if (key === "loadSitemap" || key === "inventoryHydrate") continue;
    const slice = bulkActionProgress[key];
    if (slice && slice.total > 0) {
      const label = META_BULK_MICRO_LABELS[key];
      const rawStatus = slice.statusMessage?.trim();
      const completed = Math.min(slice.completed, slice.total);
      return {
        label,
        completed,
        total: slice.total,
        progressPct:
          slice.total > 0 ? Math.min(100, Math.round((completed / slice.total) * 100)) : undefined,
        statusMessage: shouldShowBulkInlineStatus(label, rawStatus) ? rawStatus : undefined,
      };
    }
  }
  if (batchState?.urls?.length) {
    return buildBatchMicroSnapshot(batchState, siteName, runLabelOverride);
  }
  return null;
}

function BulkInlineStatusRow({ message }: { message: string }) {
  return (
    <div
      className="flex min-w-0 items-center gap-2 text-base text-muted-foreground"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" aria-hidden />
      <span className="min-w-0 truncate" title={message}>
        {message}
      </span>
    </div>
  );
}

function PipelineStepRow({ step, index }: { step: MetaPipelineStepUi; index: number }) {
  return <WorkspaceDetailsPipelineStepRow step={step} stripeIndex={index} />;
}

/** Slim bar centered in slot; padding above/below the track. */
export const META_BULK_PROGRESS_SLOT_MIN_H = "h-8";

type HeaderProgressTicker = {
  pagesDone: number;
  pagesTotal: number;
};

function HarnessNeonProgressBar({
  pct,
  indeterminate,
  ariaLabel,
  variant = "default",
  ticker,
}: {
  pct: number;
  indeterminate?: boolean;
  ariaLabel?: string;
  variant?: "default" | "header";
  ticker?: HeaderProgressTicker | null;
}) {
  if (variant === "header") {
    const showTicker = Boolean(ticker && ticker.pagesTotal > 0);
    if (indeterminate) {
      return (
        <div
          className="flowbie-overview-header-progress-track w-full"
          aria-label={ariaLabel}
          aria-busy="true"
        >
          <div className="flowbie-overview-header-progress-indeterminate" aria-hidden />
          {showTicker ? (
            <span className="flowbie-overview-header-progress-ticker" aria-hidden>
              {ticker!.pagesDone} / {ticker!.pagesTotal}
            </span>
          ) : null}
        </div>
      );
    }
    const v = Math.min(100, Math.max(0, pct));
    return (
      <div className="flowbie-overview-header-progress-track w-full">
        <div
          className="flowbie-overview-header-progress-fill"
          style={{ width: `${v}%` }}
          role="progressbar"
          aria-valuenow={v}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={ariaLabel}
        />
        {showTicker ? (
          <span className="flowbie-overview-header-progress-ticker" aria-hidden>
            {ticker!.pagesDone} / {ticker!.pagesTotal}
          </span>
        ) : null}
      </div>
    );
  }

  if (indeterminate) {
    return (
      <div
        className="flowbie-competitor-progress-track h-2 w-full rounded-full"
        aria-label={ariaLabel}
        aria-busy="true"
      >
        <div className="flowbie-competitor-progress-indeterminate" aria-hidden />
      </div>
    );
  }
  const v = Math.min(100, Math.max(0, pct));
  return (
    <div className="flowbie-competitor-progress-track h-2 w-full rounded-full">
      <div
        className="flowbie-competitor-progress-fill h-full rounded-full transition-[width] duration-300 ease-out"
        style={{ width: `${v}%` }}
        role="progressbar"
        aria-valuenow={v}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={ariaLabel}
      />
    </div>
  );
}

function EmbeddedMicroProgressRow({
  title,
  pagesDone,
  pagesTotal,
  pct,
  idle = false,
  progressPct,
}: {
  title?: string;
  pagesDone: number;
  pagesTotal: number;
  pct: number;
  idle?: boolean;
  /** Harness batch step % (0–100); overrides page ratio when set. */
  progressPct?: number;
}) {
  const barAriaLabel = pagesTotal > 0 ? `${pagesDone} of ${pagesTotal} pages` : undefined;
  const allPagesDone = pagesTotal > 0 && pagesDone >= pagesTotal;
  const fillPct = allPagesDone
    ? 100
    : typeof progressPct === "number" && Number.isFinite(progressPct)
      ? progressPct
      : pagesTotal > 0
        ? pct
        : 0;
  const inProgress = !idle && pagesTotal > 0 && pagesDone < pagesTotal;

  const ticker = pagesTotal > 0 ? { pagesDone, pagesTotal } : null;

  return (
    <div
      className={cn("flex w-full items-center", META_BULK_PROGRESS_SLOT_MIN_H)}
      role={idle ? undefined : "status"}
      aria-live={idle ? undefined : "polite"}
      title={title}
      aria-label={barAriaLabel}
    >
      {idle ? (
        <div
          className="flowbie-overview-header-progress-track w-full opacity-40"
          aria-hidden
        />
      ) : (
        <HarnessNeonProgressBar
          variant="header"
          pct={fillPct}
          indeterminate={false}
          ariaLabel={barAriaLabel}
          ticker={ticker}
        />
      )}
    </div>
  );
}

export function MetaBulkMicroProgress({
  snapshot,
  bulkActionProgress,
  idleMessage = "Idle - run a bulk action to see steps",
  headerLabel = "Progress",
  variant = "default",
  hideIdleTrack = false,
}: {
  snapshot: MetaBulkMicroSnapshot | null;
  bulkActionProgress?: Partial<Record<MetaBulkActionKey, BulkProgressSlice>>;
  idleMessage?: string;
  headerLabel?: string;
  /** Flat layout inside OverviewMetaWorkspaceBar; fixed height, no nested card. */
  variant?: "default" | "embedded";
  /** When true and idle, render no track (keep slot height). */
  hideIdleTrack?: boolean;
}) {
  const embedded = variant === "embedded";

  if (!snapshot) {
    if (embedded) {
      if (hideIdleTrack) {
        return <div className={cn("w-full", META_BULK_PROGRESS_SLOT_MIN_H)} aria-hidden />;
      }
      return (
        <EmbeddedMicroProgressRow
          idle
          title={idleMessage}
          pagesDone={0}
          pagesTotal={0}
          pct={0}
        />
      );
    }
    return (
      <div className="flex min-h-[2.25rem] flex-col justify-center gap-1.5 rounded-lg border border-white/[0.06] bg-zinc-950/45 px-2.5 py-2 shadow-none">
        <span className="text-base font-medium uppercase tracking-wide text-muted-foreground">
          {headerLabel}
        </span>
        <div className="flex h-1 gap-px">
          {Array.from({ length: 12 }).map((_, i) => (
            <span key={i} className="h-full min-w-[2px] flex-1 rounded-sm bg-muted/50" />
          ))}
        </div>
        <span className="text-base text-muted-foreground">{idleMessage}</span>
      </div>
    );
  }

  const pagesDone = Math.min(snapshot.completed, snapshot.total);
  const pagesTotal = snapshot.total;
  const pct = pagesTotal > 0 ? Math.min(100, (pagesDone / pagesTotal) * 100) : 0;
  const active = bulkActionProgress ? pickActiveBulkProgressSlice(bulkActionProgress) : null;
  const pipelineSteps = active?.slice.pipelineSteps ?? [];
  const inlineStatus =
    pipelineSteps.length > 0
      ? undefined
      : shouldShowBulkInlineStatus(snapshot.label, snapshot.statusMessage)
        ? snapshot.statusMessage?.trim()
        : undefined;
  const showHarnessChecklist = !embedded && pipelineSteps.length > 0;

  const barAriaLabel =
    pagesTotal > 0 ? `${pagesDone} of ${pagesTotal} pages` : undefined;
  const embeddedTitleFull = [snapshot.label, inlineStatus].filter(Boolean).join(" · ");

  if (embedded) {
    return (
      <EmbeddedMicroProgressRow
        title={embeddedTitleFull || undefined}
        pagesDone={pagesDone}
        pagesTotal={pagesTotal}
        pct={pct}
        progressPct={snapshot.progressPct}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col justify-center gap-1.5",
        "min-h-[2.25rem] gap-1.5 rounded-lg border border-white/[0.06] bg-zinc-950/50 px-2.5 py-2 shadow-none",
      )}
    >
      <div className="flex min-h-0 items-center justify-between gap-2">
        <span
          className="flex min-w-0 items-center gap-2 text-base font-medium leading-tight text-foreground"
          title={inlineStatus ? snapshot.label : embeddedTitleFull}
        >
          {!inlineStatus && pagesTotal > 0 && pagesDone < pagesTotal ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" aria-hidden />
          ) : null}
          <span className="min-w-0 truncate">{snapshot.label}</span>
        </span>
        <span
          className="shrink-0 text-base tabular-nums text-muted-foreground"
          aria-label={barAriaLabel}
        >
          {pagesTotal > 0 ? `${pagesDone} / ${pagesTotal}` : ""}
        </span>
      </div>

      {inlineStatus ? <BulkInlineStatusRow message={inlineStatus} /> : null}

      <HarnessNeonProgressBar
        pct={snapshot.progressPct ?? pct}
        indeterminate={false}
        ariaLabel={barAriaLabel}
      />

      {showHarnessChecklist ? (
        <ul className="max-h-40 space-y-1 overflow-y-auto">
          {pipelineSteps.map((step, index) => (
            <PipelineStepRow key={step.id} step={step} index={index} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}
