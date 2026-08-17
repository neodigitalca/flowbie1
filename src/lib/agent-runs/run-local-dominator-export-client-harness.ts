import type { WordPressSite } from "@/components/integrations/types";
import { getStoredSites } from "@/components/integrations/storage";
import type { AgentRunHarnessContext } from "@/lib/agent-runs/harness-registry";
import type { AgentRun, AgentRunResult } from "@/lib/agent-runs-types";
import {
  decodeLocalDominatorCsvBase64,
  downloadLocalDominatorCsv,
  exportLocalDominatorGrid,
} from "@/lib/local-dominator-export-api";
import type { TaskExecutionClientRunContract } from "@/lib/tasks-types";
import { completeTaskExecution, patchTaskExecutionProgress } from "@/lib/tasks-api";
import {
  effectiveSaveLocalArchive,
  effectiveSaveToDisk,
} from "@/lib/schedule-output-destination";
import {
  buildExecutionCompletePayload,
  localDominatorArchiveFiles,
} from "@/lib/task-execution-archive";

function resolveSite(siteId: string, sites: WordPressSite[]): WordPressSite {
  const fromList = sites.find((s) => s.id === siteId);
  if (fromList) return fromList;
  const stored = getStoredSites().find((s) => s.id === siteId);
  if (stored) return stored;
  throw new Error("WordPress site not found for this research export run.");
}

function contractFields(contract: TaskExecutionClientRunContract | Record<string, unknown>) {
  const businessName = String((contract as TaskExecutionClientRunContract).businessName ?? "").trim();
  const keyword = String((contract as TaskExecutionClientRunContract).keyword ?? "").trim();
  if (!businessName || !keyword) {
    throw new Error("businessName and keyword are required for Local Dominator export.");
  }
  return { businessName, keyword };
}

export async function runLocalDominatorExportClientHarness(
  run: AgentRun,
  site: WordPressSite,
  contract: TaskExecutionClientRunContract,
  executionId: number,
  ctx: AgentRunHarnessContext,
  batchKey: string,
): Promise<AgentRunResult> {
  const { businessName, keyword } = contractFields(contract);

  await ctx.onStep?.("Preflight", "running");
  await patchTaskExecutionProgress(run.teamId, executionId, {
    stepId: "preflight",
    message: "Starting Local Dominator export…",
    progress: 0.05,
  });

  await ctx.onStep?.("Export grid CSV", "running");
  await patchTaskExecutionProgress(run.teamId, executionId, {
    message: `Exporting ${businessName}…`,
    progress: 0.2,
  });

  const response = await exportLocalDominatorGrid({ businessName, keyword });
  if (!response.ok || !response.csvBase64 || !response.fileName) {
    throw new Error(response.error ?? "Local Dominator export failed.");
  }

  const csvContent = decodeLocalDominatorCsvBase64(response.csvBase64);
  const archiveFiles = localDominatorArchiveFiles({
    fileName: response.fileName,
    csvContent,
    businessName,
    keyword,
  });

  const saveToDisk = effectiveSaveToDisk("local_dominator_export", contract);
  const saveLocalArchive = effectiveSaveLocalArchive("local_dominator_export", contract);

  if (saveToDisk && !saveLocalArchive) {
    downloadLocalDominatorCsv(archiveFiles[0]?.fileName ?? response.fileName, csvContent);
  }

  await completeTaskExecution(
    run.teamId,
    executionId,
    buildExecutionCompletePayload({
      ok: true,
      run,
      saveLocalArchive,
      archiveFiles: saveLocalArchive ? archiveFiles : undefined,
      result: {
        businessName,
        keyword,
        fileName: archiveFiles[0]?.fileName ?? response.fileName,
        siteName: site.name,
      },
    }),
  );

  return {
    updated: 1,
    message: `Exported Local Dominator grid for ${businessName}`,
    batchKey,
  };
}

export { resolveSite };
