import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, Copy, Download, RefreshCw, Share2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BULK_HEADER_TOOL_BTN } from "@/components/keyword-research/bulk/bulk-workspace-header-styles";
import { forgeTableRowStripeClass } from "@/components/manager/pulse-forge/forge-dashboard-styles";
import { fetchAgentRunArtifacts } from "@/lib/agent-runs-api";
import { getAgentRunHostedFiles } from "@/lib/agent-runs/agent-run-hosted-files";
import { clearAgentRunHostedFiles } from "@/lib/agent-runs/agent-run-hosted-files";
import {
  clearWorkflowRuns,
  deleteWorkflowRun,
  fetchWorkflowRuns,
  fetchWorkflowStepOutputs,
  promoteWorkflowOutputToLibrary,
} from "@/lib/workflow/workflow-api";
import type { WorkflowRun, WorkflowStepOutput } from "@/lib/workflow/workflow-types";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

type DownloadableFile = {
  name: string;
  href: string;
  outputKey: string;
  sizeBytes: number | null;
};

function formatRunWhen(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return formatDistanceToNow(parsed, { addSuffix: true }).replace(/^about /, "");
}

function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function runStatusLabel(status: WorkflowRun["status"]): string {
  return status.replace(/_/g, " ");
}

async function fileHrefSize(href: string): Promise<number | null> {
  if (!href.startsWith("blob:") && !href.startsWith("data:")) return null;
  try {
    const blob = await fetch(href).then((response) => response.blob());
    return blob.size;
  } catch {
    return null;
  }
}

async function resolveOutputFiles(
  teamId: number,
  output: WorkflowStepOutput,
): Promise<DownloadableFile[]> {
  const outputKey = output.variableKey;
  const label = output.label || output.variableKey;

  const seedRefs = (output.fileRefs ?? []).filter((file) => file.url);
  if (seedRefs.length > 0) {
    return Promise.all(
      seedRefs.map(async (file) => ({
        name: file.name,
        href: file.url!,
        outputKey,
        sizeBytes: await fileHrefSize(file.url!),
      })),
    );
  }

  const agentRunId = output.agentRunId;
  if (!agentRunId) return [];

  const hosted = getAgentRunHostedFiles(agentRunId);
  if (hosted.length > 0) {
    return Promise.all(
      hosted.map(async (file) => ({
        name: file.name,
        href: file.href,
        outputKey,
        sizeBytes: await fileHrefSize(file.href),
      })),
    );
  }

  const artifacts = await fetchAgentRunArtifacts(teamId, agentRunId);
  return Promise.all(
    artifacts
      .filter((file) => file.url)
      .map(async (file) => ({
        name: file.name || label,
        href: file.url,
        outputKey,
        sizeBytes: await fileHrefSize(file.url),
      })),
  );
}

type WorkflowRagRunRowProps = {
  run: WorkflowRun;
  rowIndex: number;
  expanded: boolean;
  loading: boolean;
  outputs: WorkflowStepOutput[];
  files: DownloadableFile[];
  promotingKey: string | null;
  deletingRun: boolean;
  onToggle: () => void;
  onPromote: (output: WorkflowStepOutput) => void;
  onDeleteRun: () => void;
};

function WorkflowRagRunRow({
  run,
  rowIndex,
  expanded,
  loading,
  outputs,
  files,
  promotingKey,
  deletingRun,
  onToggle,
  onPromote,
  onDeleteRun,
}: WorkflowRagRunRowProps): React.ReactElement {
  const handleRowClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("a, button")) return;
    onToggle();
  };

  const fileCount = files.length;

  return (
    <div className="flex flex-col">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        className={cn(
          "flex h-9 cursor-pointer items-center gap-3 px-3 text-base text-white",
          forgeTableRowStripeClass(rowIndex, { active: expanded }),
        )}
        onClick={handleRowClick}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onToggle();
          }
        }}
      >
        <span className="min-w-0 truncate font-normal">Run #{run.id}</span>
        <span className="shrink-0 capitalize text-muted-foreground">{runStatusLabel(run.status)}</span>
        <span className="shrink-0 text-muted-foreground">
          {fileCount > 0 ? `${fileCount} file${fileCount === 1 ? "" : "s"}` : "No files"}
        </span>
        <span className="ml-auto shrink-0 text-muted-foreground">{formatRunWhen(run.createdAt)}</span>
        <button
          type="button"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center text-muted-foreground hover:bg-zinc-800 hover:text-white disabled:opacity-50"
          aria-label={`Delete run ${run.id}`}
          disabled={deletingRun}
          onClick={(event) => {
            event.stopPropagation();
            onDeleteRun();
          }}
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </button>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")}
          aria-hidden
        />
      </div>

      {expanded ? (
        <div className="flex flex-col">
          {loading ? (
            <p className={cn("px-3 py-2 text-base text-muted-foreground", forgeTableRowStripeClass(rowIndex + 1))}>
              Loading…
            </p>
          ) : null}
          {!loading && files.length === 0 ? (
            <p className={cn("px-3 py-2 text-base text-muted-foreground", forgeTableRowStripeClass(rowIndex + 1))}>
              No files for this run.
            </p>
          ) : null}
          {!loading
            ? files.map((file, fileIndex) => {
                const output = outputs.find((item) => item.variableKey === file.outputKey);
                return (
                  <div
                    key={`${file.name}-${file.href}`}
                    className={cn(
                      "flex h-8 items-center gap-2 px-3 pl-8 text-base text-white",
                      forgeTableRowStripeClass(rowIndex + 1 + fileIndex),
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate font-normal text-white">{file.name}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {formatFileSize(file.sizeBytes)}
                    </span>
                    <a
                      href={file.href}
                      download={file.name}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center text-muted-foreground hover:bg-zinc-800 hover:text-white"
                      aria-label={`Download ${file.name}`}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <Download className="h-4 w-4" aria-hidden />
                    </a>
                    {output ? (
                      <>
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center text-muted-foreground hover:bg-zinc-800 hover:text-white"
                          aria-label={`Copy ${file.outputKey}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            void navigator.clipboard.writeText(`{{${file.outputKey}}}`);
                          }}
                        >
                          <Copy className="h-4 w-4" aria-hidden />
                        </button>
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center text-muted-foreground hover:bg-zinc-800 hover:text-white disabled:opacity-50"
                          aria-label={`Promote ${file.outputKey}`}
                          disabled={promotingKey === file.outputKey}
                          onClick={(event) => {
                            event.stopPropagation();
                            if (output) onPromote(output);
                          }}
                        >
                          <Share2 className="h-4 w-4" aria-hidden />
                        </button>
                      </>
                    ) : null}
                  </div>
                );
              })
            : null}
        </div>
      ) : null}
    </div>
  );
}

export type WorkflowRagSidebarProps = {
  teamId: number;
  workflowId: number;
  activeRunId: number | null;
};

export function WorkflowRagSidebar({
  teamId,
  workflowId,
  activeRunId,
}: WorkflowRagSidebarProps): React.ReactElement {
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set());
  const [outputsByRunId, setOutputsByRunId] = useState<Record<number, WorkflowStepOutput[]>>({});
  const [filesByRunId, setFilesByRunId] = useState<Record<number, DownloadableFile[]>>({});
  const [loadingRunIds, setLoadingRunIds] = useState<Set<number>>(() => new Set());
  const [promotingKey, setPromotingKey] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [deletingRunId, setDeletingRunId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sortedRuns = useMemo(
    () => [...runs].sort((a, b) => b.id - a.id),
    [runs],
  );

  const loadRunOutputs = useCallback(
    async (runId: number) => {
      setLoadingRunIds((prev) => new Set(prev).add(runId));
      const outputs = await fetchWorkflowStepOutputs(teamId, workflowId, runId);
      setOutputsByRunId((prev) => ({ ...prev, [runId]: outputs }));

      const fileLists = await Promise.all(outputs.map((output) => resolveOutputFiles(teamId, output)));
      setFilesByRunId((prev) => ({ ...prev, [runId]: fileLists.flat() }));
      setLoadingRunIds((prev) => {
        const next = new Set(prev);
        next.delete(runId);
        return next;
      });
    },
    [teamId, workflowId],
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setRuns(await fetchWorkflowRuns(teamId, workflowId));
    setRefreshing(false);
  }, [teamId, workflowId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!activeRunId) return;
    const key = String(activeRunId);
    setExpandedKeys((prev) => new Set(prev).add(key));
    void loadRunOutputs(activeRunId);
  }, [activeRunId, loadRunOutputs]);

  const toggleRun = useCallback(
    (runId: number) => {
      const key = String(runId);
      setExpandedKeys((prev) => {
        const next = new Set(prev);
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
          if (!outputsByRunId[runId]) {
            void loadRunOutputs(runId);
          }
        }
        return next;
      });
    },
    [loadRunOutputs, outputsByRunId],
  );

  const handlePromote = useCallback(
    (runId: number, output: WorkflowStepOutput) => {
      setPromotingKey(output.variableKey);
      void promoteWorkflowOutputToLibrary(teamId, output.variableKey, {
        runId,
        outputId: output.id,
        label: output.label,
      }).then(() => {
        setPromotingKey(null);
      });
    },
    [teamId],
  );

  const handleDeleteRun = useCallback(
    async (runId: number) => {
      setDeletingRunId(runId);
      setError(null);
      const outputs = outputsByRunId[runId] ?? (await fetchWorkflowStepOutputs(teamId, workflowId, runId));
      const result = await deleteWorkflowRun(teamId, workflowId, runId);
      if (!result.ok) {
        setError(result.error ?? "Could not delete run.");
        setDeletingRunId(null);
        return;
      }
      for (const output of outputs) {
        if (output.agentRunId) clearAgentRunHostedFiles(output.agentRunId);
      }
      setRuns((prev) => prev.filter((run) => run.id !== runId));
      setExpandedKeys((prev) => {
        const next = new Set(prev);
        next.delete(String(runId));
        return next;
      });
      setOutputsByRunId((prev) => {
        const next = { ...prev };
        delete next[runId];
        return next;
      });
      setFilesByRunId((prev) => {
        const next = { ...prev };
        delete next[runId];
        return next;
      });
      setDeletingRunId(null);
    },
    [outputsByRunId, teamId, workflowId],
  );

  const handleClearArchive = useCallback(async () => {
    if (sortedRuns.length === 0) return;
    setClearing(true);
    setError(null);
    for (const run of sortedRuns) {
      const outputs = outputsByRunId[run.id] ?? (await fetchWorkflowStepOutputs(teamId, workflowId, run.id));
      for (const output of outputs) {
        if (output.agentRunId) clearAgentRunHostedFiles(output.agentRunId);
      }
    }
    const result = await clearWorkflowRuns(teamId, workflowId);
    if (!result.ok) {
      setError(result.error ?? "Could not clear run archive.");
      setClearing(false);
      return;
    }
    setRuns([]);
    setExpandedKeys(new Set());
    setOutputsByRunId({});
    setFilesByRunId({});
    setClearing(false);
  }, [outputsByRunId, sortedRuns, teamId, workflowId]);

  return (
    <div className="flex h-full w-full flex-col bg-black">
      <div className="flex shrink-0 items-center gap-2 border-b border-white/10 px-4 py-3">
        <p className="text-base font-normal text-white">Run archive</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(BULK_HEADER_TOOL_BTN, "ml-auto h-8 gap-1.5 px-2.5 font-normal")}
          disabled={refreshing || clearing || deletingRunId != null}
          onClick={() => void refresh()}
        >
          <RefreshCw className="h-4 w-4 shrink-0" aria-hidden />
          Refresh
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(BULK_HEADER_TOOL_BTN, "h-8 px-2.5 font-normal")}
          disabled={sortedRuns.length === 0 || refreshing || clearing || deletingRunId != null}
          aria-label="Clear run archive"
          title="Clear run archive"
          onClick={() => void handleClearArchive()}
        >
          <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
        </Button>
      </div>

      {error ? <p className="px-4 py-2 text-base text-red-400">{error}</p> : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {sortedRuns.length === 0 ? (
          <p className="px-4 py-6 text-base text-muted-foreground">No workflow runs yet. Press Test to create one.</p>
        ) : (
          <div className="flex flex-col">
            {sortedRuns.map((run, index) => (
              <WorkflowRagRunRow
                key={run.id}
                run={run}
                rowIndex={index}
                expanded={expandedKeys.has(String(run.id))}
                loading={loadingRunIds.has(run.id)}
                outputs={outputsByRunId[run.id] ?? []}
                files={filesByRunId[run.id] ?? []}
                promotingKey={promotingKey}
                deletingRun={deletingRunId === run.id}
                onToggle={() => toggleRun(run.id)}
                onPromote={(output) => handlePromote(run.id, output)}
                onDeleteRun={() => void handleDeleteRun(run.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
