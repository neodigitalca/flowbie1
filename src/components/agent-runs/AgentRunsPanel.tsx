import { useCallback, useEffect, useMemo, useState } from "react";
import { useAgentRunsContext } from "@/contexts/agent-runs-context";
import { useWordPressSites } from "@/hooks/use-wordpress-sites";
import { isAgentRunInterrupted, isAgentRunResumable } from "@/lib/agent-runs/agent-run-checkpoint";
import {
  agentRunBucketFolderKey,
  agentRunClientFolderKey,
  buildAgentRunGroups,
  buildAgentRunSiteNameMap,
  buildAutoExpandedAgentRunFolderKeys,
} from "@/lib/agent-runs/agent-run-grouping";
import { isAgentRunTerminal } from "@/lib/agent-runs-types";
import { AgentRunCard } from "./AgentRunCard";
import { AgentRunsGroupFolder } from "./AgentRunsGroupFolder";

export function AgentRunsPanel() {
  const { runs, cancelRun, resumeRun, selectedRunId, refreshRuns } = useAgentRunsContext();
  const { sites: wpSites } = useWordPressSites();
  const [expandedRunId, setExpandedRunId] = useState<number | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    void refreshRuns();
  }, [refreshRuns]);

  const siteNameById = useMemo(() => buildAgentRunSiteNameMap(wpSites), [wpSites]);

  const activeRuns = useMemo(
    () => runs.filter((r) => !isAgentRunTerminal(r.status)),
    [runs],
  );

  const interruptedRuns = useMemo(
    () => runs.filter((r) => isAgentRunInterrupted(r)),
    [runs],
  );

  const failedRuns = useMemo(
    () => runs.filter((r) => r.status === "failed"),
    [runs],
  );

  const recentDoneRuns = useMemo(() => {
    const cutoff = Date.now() - 30 * 60 * 1000;
    return runs.filter((r) => {
      if (r.status !== "done") return false;
      const ts = Date.parse(r.updatedAt ?? r.createdAt ?? "");
      return Number.isFinite(ts) && ts >= cutoff;
    });
  }, [runs]);

  const visibleRuns = useMemo(
    () => [
      ...activeRuns,
      ...interruptedRuns.filter((r) => !activeRuns.some((a) => a.id === r.id)),
      ...failedRuns.filter(
        (r) =>
          !activeRuns.some((a) => a.id === r.id) &&
          !interruptedRuns.some((i) => i.id === r.id),
      ),
      ...recentDoneRuns.filter(
        (r) =>
          !activeRuns.some((a) => a.id === r.id) &&
          !interruptedRuns.some((i) => i.id === r.id) &&
          !failedRuns.some((f) => f.id === r.id),
      ),
    ],
    [activeRuns, interruptedRuns, failedRuns, recentDoneRuns],
  );

  const autoExpandedKeys = useMemo(
    () => buildAutoExpandedAgentRunFolderKeys(visibleRuns, selectedRunId),
    [visibleRuns, selectedRunId],
  );

  useEffect(() => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      for (const key of autoExpandedKeys) next.add(key);
      return next;
    });
  }, [autoExpandedKeys]);

  const clientGroups = useMemo(
    () => buildAgentRunGroups(visibleRuns, siteNameById),
    [visibleRuns, siteNameById],
  );

  const isFolderOpen = useCallback(
    (key: string) => expandedFolders.has(key),
    [expandedFolders],
  );

  const toggleFolder = useCallback((key: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  let stripeIndex = 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="agent-runs-body">
        {visibleRuns.length === 0 ? (
          <div className="agent-runs-empty">
            No automations running. Start one from Pulse Assist Build or execute a task with an agent.
          </div>
        ) : (
          <div className="agent-runs-list">
            {clientGroups.map((client) => {
              const clientKey = agentRunClientFolderKey(client.siteId);
              const clientOpen = isFolderOpen(clientKey);

              return (
                <div key={clientKey} className="agent-runs-client-group">
                  <AgentRunsGroupFolder
                    label={client.label}
                    count={client.runCount}
                    open={clientOpen}
                    depth={0}
                    onToggle={() => toggleFolder(clientKey)}
                  />
                  {clientOpen ? (
                    <div className="agent-runs-client-group__buckets">
                      {client.buckets.map((bucket) => {
                        const bucketKey = agentRunBucketFolderKey(client.siteId, bucket.key);
                        const bucketOpen = isFolderOpen(bucketKey);

                        return (
                          <div key={bucketKey} className="agent-runs-bucket-group">
                            <AgentRunsGroupFolder
                              label={bucket.label}
                              count={bucket.runs.length}
                              open={bucketOpen}
                              depth={1}
                              onToggle={() => toggleFolder(bucketKey)}
                            />
                            {bucketOpen ? (
                              <div className="agent-runs-bucket-group__runs">
                                {bucket.runs.map((run) => {
                                  const index = stripeIndex;
                                  stripeIndex += 1;
                                  const resumable = isAgentRunResumable(run);
                                  return (
                                    <AgentRunCard
                                      key={run.id}
                                      run={run}
                                      clientLabel={client.label}
                                      stripeIndex={index}
                                      expanded={expandedRunId === run.id}
                                      resumable={resumable}
                                      onToggle={() =>
                                        setExpandedRunId((prev) => (prev === run.id ? null : run.id))
                                      }
                                      onCancel={() => void cancelRun(run.id)}
                                      onResume={
                                        resumable ? () => void resumeRun(run.id) : undefined
                                      }
                                    />
                                  );
                                })}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
