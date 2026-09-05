import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAgentRunsContext } from "@/contexts/agent-runs-context";
import { fetchAgentRun } from "@/lib/agent-runs-api";
import {
  downloadWorkflowRunAgentLogs,
  workflowRunIdFromAgentRun,
} from "@/lib/agent-runs/agent-run-log-download";
import { isAgentRunResumable } from "@/lib/agent-runs/agent-run-checkpoint";
import {
  agentRunBucketKey,
  agentRunClientId,
  AGENT_RUN_UNASSIGNED_CLIENT_ID,
  resolveAgentRunBucketTabSelections,
  type AgentRunBucketGroup,
  type AgentRunBucketKey,
  type AgentRunClientGroup,
} from "@/lib/agent-runs/agent-run-grouping";
import { isAgentRunTerminal } from "@/lib/agent-runs-types";
import { useAgentRunsSiteFilterModel } from "@/hooks/use-agent-runs-site-filter-model";
import { useTeam } from "@/contexts/TeamContext";
import { AgentRunCard } from "./AgentRunCard";
import { AgentRunsBucketTabs } from "./AgentRunsBucketTabs";
import { AgentRunsHeaderSiteFilter } from "./AgentRunsHeaderSiteFilter";

function preferredRunIdInBucket(bucket: AgentRunBucketGroup | undefined): number | null {
  if (!bucket || bucket.runs.length === 0) return null;
  const active = bucket.runs.find((run) => !isAgentRunTerminal(run.status));
  return (active ?? bucket.runs[0]).id;
}

function renderSelectedClientContent(args: {
  client: AgentRunClientGroup;
  activeBucket: AgentRunClientGroup["buckets"][number] | undefined;
  expandedRunId: number | null;
  setExpandedRunId: (id: number | null) => void;
  cancelRun: (id: number) => void;
  resumeRun: (id: number) => void;
  stripeIndexRef: { current: number };
}) {
  const {
    client,
    activeBucket,
    expandedRunId,
    setExpandedRunId,
    cancelRun,
    resumeRun,
    stripeIndexRef,
  } = args;

  if (!activeBucket || activeBucket.runs.length === 0) {
    return (
      <p className="px-3 py-4 text-base text-muted-foreground">
        No agent runs in this category.
      </p>
    );
  }

  return (
    <div className="agent-runs-client-group">
      <div className="agent-runs-bucket-group__runs">
        {activeBucket.runs.map((run) => {
          const index = stripeIndexRef.current;
          stripeIndexRef.current += 1;
          const resumable = isAgentRunResumable(run);
          return (
            <AgentRunCard
              key={run.id}
              run={run}
              clientLabel={client.label}
              stripeIndex={index}
              expanded={expandedRunId === run.id}
              resumable={resumable}
              onToggle={() => setExpandedRunId(expandedRunId === run.id ? null : run.id)}
              onCancel={() => void cancelRun(run.id)}
              onResume={resumable ? () => void resumeRun(run.id) : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}

export function AgentRunsPanel() {
  const {
    cancelRun,
    resumeRun,
    refreshRuns,
    runs,
    patchRunInList,
    selectedRunId,
    selectRun,
  } = useAgentRunsContext();
  const { activeTeam } = useTeam();
  const {
    allSiteGroups,
    allSiteIds,
    resolvedSiteFilter,
    selectedClient,
    siteFilterOptions,
    setAgentsSiteFilter,
  } = useAgentRunsSiteFilterModel();
  const [expandedRunId, setExpandedRunId] = useState<number | null>(null);
  const [selectedBucketByClient, setSelectedBucketByClient] = useState<
    Record<string, AgentRunBucketKey>
  >({});
  const followedRunIdRef = useRef<number | null>(null);

  useEffect(() => {
    void refreshRuns();
  }, [refreshRuns]);

  useEffect(() => {
    if (!selectedRunId) {
      followedRunIdRef.current = null;
      return;
    }
    if (followedRunIdRef.current === selectedRunId) return;
    const run = runs.find((item) => item.id === selectedRunId);
    if (!run) return;

    followedRunIdRef.current = selectedRunId;
    setExpandedRunId(selectedRunId);
    const siteId = agentRunClientId(run);
    setAgentsSiteFilter(siteId);
    setSelectedBucketByClient((prev) => {
      const bucketKey = agentRunBucketKey(run);
      if (prev[siteId] === bucketKey) return prev;
      return { ...prev, [siteId]: bucketKey };
    });
  }, [runs, selectedRunId, setAgentsSiteFilter]);

  useEffect(() => {
    if (!expandedRunId || !activeTeam?.id) return;
    const run = runs.find((item) => item.id === expandedRunId);
    if (!run || (run.steps?.length ?? 0) > 0) return;

    let cancelled = false;
    void (async () => {
      const detail = await fetchAgentRun(activeTeam.id, expandedRunId);
      if (cancelled || !detail?.steps?.length) return;
      patchRunInList(expandedRunId, { steps: detail.steps });
    })();

    return () => {
      cancelled = true;
    };
  }, [activeTeam?.id, expandedRunId, patchRunInList, runs]);

  useEffect(() => {
    setSelectedBucketByClient((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const client of allSiteGroups) {
        if (!next[client.siteId]) {
          next[client.siteId] = client.buckets[0]?.key ?? "reporting";
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [allSiteGroups]);

  const resolvedBucketSelections = useMemo(
    () => resolveAgentRunBucketTabSelections(allSiteGroups, selectedBucketByClient),
    [allSiteGroups, selectedBucketByClient],
  );

  const selectBucket = useCallback(
    (siteId: string, bucketKey: AgentRunBucketKey) => {
      setSelectedBucketByClient((prev) => {
        if (prev[siteId] === bucketKey) return prev;
        return { ...prev, [siteId]: bucketKey };
      });
      const client = allSiteGroups.find((group) => group.siteId === siteId);
      const bucket = client?.buckets.find((item) => item.key === bucketKey);
      const runId = preferredRunIdInBucket(bucket);
      followedRunIdRef.current = runId;
      selectRun(runId);
      setExpandedRunId(runId);
    },
    [allSiteGroups, selectRun],
  );

  const handleSiteFilterChange = useCallback(
    (siteId: string) => {
      setAgentsSiteFilter(siteId);
      setExpandedRunId(null);
    },
    [setAgentsSiteFilter],
  );

  const stripeIndexRef = { current: 0 };

  const activeBucketKey = selectedClient
    ? (resolvedBucketSelections[selectedClient.siteId] ??
      selectedClient.buckets[0]?.key ??
      "reporting")
    : undefined;
  const activeBucket = selectedClient
    ? selectedClient.buckets.find((b) => b.key === activeBucketKey)
    : undefined;

  const showPickerBand = Boolean(selectedClient);

  const workflowBatch = useMemo(() => {
    const workflowRunIds = new Map<number, number>();
    for (const run of runs) {
      const workflowRunId = workflowRunIdFromAgentRun(run);
      if (!workflowRunId) continue;
      workflowRunIds.set(workflowRunId, (workflowRunIds.get(workflowRunId) ?? 0) + 1);
    }
    let best: { workflowRunId: number; count: number } | null = null;
    for (const [workflowRunId, count] of workflowRunIds) {
      if (!best || count > best.count) best = { workflowRunId, count };
    }
    return best;
  }, [runs]);

  const showWorkflowLogDownload = Boolean(workflowBatch && workflowBatch.count > 1);

  const alternateClientHint = useMemo(() => {
    if (!selectedClient || selectedClient.runCount > 0) return null;
    const withRuns = allSiteGroups.filter(
      (group) => group.runCount > 0 && group.siteId !== selectedClient.siteId,
    );
    if (withRuns.length === 0) return null;
    const unassigned = withRuns.find((group) => group.siteId === AGENT_RUN_UNASSIGNED_CLIENT_ID);
    if (unassigned) {
      return "Runs may be listed under Unassigned. Check the client filter above.";
    }
    return `Runs exist for ${withRuns[0]?.label ?? "another client"}. Check the client filter above.`;
  }, [allSiteGroups, selectedClient]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="agent-runs-body">
        {allSiteIds.length === 0 ? null : (
          <div className="agent-runs-list">
            <div className="agent-runs-site-picker">
              {showPickerBand && selectedClient && activeBucketKey ? (
                <div className="agent-runs-site-picker-row">
                  <AgentRunsHeaderSiteFilter
                    value={resolvedSiteFilter}
                    options={siteFilterOptions}
                    onChange={handleSiteFilterChange}
                  />
                  <span className="agent-runs-site-picker-row__divider" aria-hidden />
                  <AgentRunsBucketTabs
                    mode="iconRail"
                    buckets={selectedClient.buckets}
                    value={activeBucketKey}
                    onChange={(key) => selectBucket(selectedClient.siteId, key)}
                    className="agent-runs-site-picker-row__tabs"
                  />
                  {showWorkflowLogDownload && workflowBatch ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="agent-runs-site-picker-row__logs h-8 shrink-0 px-2 text-base text-white hover:bg-white/10 hover:text-white"
                      title={`Download all logs (${workflowBatch.count})`}
                      onClick={() => {
                        void downloadWorkflowRunAgentLogs(
                          activeTeam?.id ?? null,
                          workflowBatch.workflowRunId,
                          runs,
                        );
                      }}
                    >
                      <Download className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span className="sr-only">All logs ({workflowBatch.count})</span>
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
            {selectedClient && selectedClient.runCount === 0 && alternateClientHint ? (
              <p className="px-3 py-4 text-base text-muted-foreground">{alternateClientHint}</p>
            ) : null}
            {selectedClient
              ? renderSelectedClientContent({
                  client: selectedClient,
                  activeBucket,
                  expandedRunId,
                  setExpandedRunId,
                  cancelRun,
                  resumeRun,
                  stripeIndexRef,
                })
              : null}
          </div>
        )}
      </div>
    </div>
  );
}
