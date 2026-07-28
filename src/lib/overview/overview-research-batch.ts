import pLimit from "p-limit";
import type { BulkHarnessSectionPayload } from "@/lib/bulk-auto-generate";
import { BACKEND_API_BASE } from "@/lib/wordpress-api/connection";
import type { OverviewRow } from "@/components/overview/overview-meta-row-types";
import type { WordPressSite } from "@/components/integrations/types";
import { OVERVIEW_RESEARCH_ROW_CONCURRENCY_MAX } from "@/lib/overview/overview-research-batch-constants";
import type { ResearchHarnessDoneSummary } from "@/lib/overview/overview-research-harness-sections";
import {
  exportOverviewGscForPageUrls,
  runOverviewResearchForRow,
  type OverviewResearchRowInput,
} from "@/lib/overview/overview-research-row";

export type OverviewResearchEligibleRow = {
  index: number;
  row: OverviewRow;
};

export type OverviewResearchBatchDeps = {
  site: WordPressSite | undefined;
  gscQuickWinsFile: string | null;
  serpDumpUrl: (filename: string) => string;
  portfolioBlockedHostsForSemrush: string[];
  skipGsc?: boolean;
  silent?: boolean;
};

export type OverviewResearchBatchPhase = "serp" | "done";

export type OverviewResearchBatchProgress = {
  completedInBatch: number;
  batchSize: number;
  batchIndex: number;
  batchCount: number;
  totalCompleted: number;
  total: number;
  phase: OverviewResearchBatchPhase;
};

export type OverviewResearchRowResult = {
  index: number;
  patch: Partial<OverviewRow> | null;
  failed: boolean;
  harnessSummaries?: ResearchHarnessDoneSummary;
};

function classifyPatch(patch: Partial<OverviewRow> | null): {
  briefUpdated: boolean;
  serpOnly: boolean;
  failed: boolean;
} {
  if (!patch) return { briefUpdated: false, serpOnly: false, failed: true };
  const briefLen = String(patch.seoResearch ?? "").trim().length;
  if (briefLen > 0) return { briefUpdated: true, serpOnly: false, failed: false };
  if (patch.researchFileName) return { briefUpdated: false, serpOnly: true, failed: false };
  return { briefUpdated: false, serpOnly: false, failed: true };
}

export type OverviewResearchBatchProgressCtx = {
  batchIndex: number;
  batchCount: number;
  total: number;
  completedOffset: number;
};

export type OverviewResearchBatchCallbacks = {
  onProgress?: (p: OverviewResearchBatchProgress) => void;
  /** Fired before sources run for this page (mark row active). */
  onPageStart?: (index: number, row: OverviewRow) => void;
  onPageComplete?: (r: OverviewResearchRowResult) => void;
  onHarnessSection?: (index: number, payload: BulkHarnessSectionPayload) => void;
  onBatchGscExportStart?: (urlCount: number) => void;
  onBatchGscExportDone?: (filename: string | null) => void;
};

export async function runOverviewResearchBatch(
  eligible: OverviewResearchEligibleRow[],
  deps: OverviewResearchBatchDeps,
  progressCtx: OverviewResearchBatchProgressCtx,
  callbacks?: OverviewResearchBatchCallbacks,
): Promise<{
  results: OverviewResearchRowResult[];
  stats: { briefUpdated: number; serpOnly: number; failed: number };
}> {
  const { onProgress, onPageStart, onPageComplete, onHarnessSection, onBatchGscExportStart, onBatchGscExportDone } =
    callbacks ?? {};
  const results: OverviewResearchRowResult[] = [];
  let briefUpdated = 0;
  let serpOnly = 0;
  let failed = 0;

  if (!eligible.length) {
    return { results, stats: { briefUpdated, serpOnly, failed } };
  }

  const skipGsc = deps.skipGsc === true;
  const batchSize = eligible.length;
  const { batchIndex, batchCount, total, completedOffset } = progressCtx;
  let completedInBatch = 0;
  let phase: OverviewResearchBatchPhase = "serp";

  const emitProgress = () => {
    onProgress?.({
      completedInBatch,
      batchSize,
      batchIndex,
      batchCount,
      totalCompleted: completedOffset + completedInBatch,
      total,
      phase,
    });
  };

  emitProgress();

  const siteGsc = deps.gscQuickWinsFile ?? null;
  let resolvedBatchGsc: string | null = siteGsc;
  const needsBatchGscExport =
    !skipGsc && !siteGsc && deps.site?.siteUrl && BACKEND_API_BASE;
  if (needsBatchGscExport) {
    const urls = eligible.map((e) => e.row.url?.trim() ?? "").filter(Boolean);
    onBatchGscExportStart?.(urls.length);
    resolvedBatchGsc = await exportOverviewGscForPageUrls(deps.site!.siteUrl, urls);
    onBatchGscExportDone?.(resolvedBatchGsc);
  }

  const concurrency = Math.min(eligible.length, OVERVIEW_RESEARCH_ROW_CONCURRENCY_MAX);
  const limit = pLimit(Math.max(1, concurrency));

  await Promise.all(
    eligible.map(({ index, row }) =>
      limit(async () => {
        let rowResult: OverviewResearchRowResult = {
          index,
          patch: null,
          failed: true,
        };
        onPageStart?.(index, row);
        try {
          const rowInput: OverviewResearchRowInput = {
            row,
            rowIndex: index,
            site: deps.site,
            gscQuickWinsFile: deps.gscQuickWinsFile,
            gscCsvForBatch: resolvedBatchGsc,
            batchResearchMode: true,
            serpDumpUrl: deps.serpDumpUrl,
            portfolioBlockedHostsForSemrush: deps.portfolioBlockedHostsForSemrush,
            skipGsc,
            silent: deps.silent ?? true,
            onHarnessSection: onHarnessSection
              ? (payload) => onHarnessSection(index, payload)
              : undefined,
          };
          const { patch, harnessSummaries } = await runOverviewResearchForRow(rowInput);
          const c = classifyPatch(patch);
          rowResult = { index, patch, failed: c.failed, harnessSummaries };
          results.push(rowResult);
        } catch {
          rowResult = { index, patch: null, failed: true };
          results.push(rowResult);
        } finally {
          completedInBatch += 1;
          onPageComplete?.(rowResult);
          emitProgress();
        }
      }),
    ),
  );

  for (const r of results) {
    const c = classifyPatch(r.patch);
    if (c.briefUpdated) briefUpdated += 1;
    else if (c.serpOnly) serpOnly += 1;
    else failed += 1;
  }

  phase = "done";
  emitProgress();
  return { results, stats: { briefUpdated, serpOnly, failed } };
}
