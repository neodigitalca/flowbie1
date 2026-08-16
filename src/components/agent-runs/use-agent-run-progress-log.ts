import { useEffect, useMemo, useRef, useState } from "react";
import { splitProgressLabel } from "@/lib/agent-runs/agent-run-display";
import type { AgentRun, AgentRunStep } from "@/lib/agent-runs-types";

export { splitProgressLabel };

function seedFromRunSteps(run: AgentRun): AgentRunStep[] {
  return [...(run.steps ?? [])];
}

function mergeRunSteps(steps: AgentRunStep[], run: AgentRun): AgentRunStep[] {
  const serverSteps = run.steps ?? [];
  if (serverSteps.length === 0) return steps;
  if (serverSteps.length >= steps.length) return [...serverSteps];
  return steps;
}

export function useAgentRunProgressSteps(run: AgentRun, _progressLabel: string | null): AgentRunStep[] {
  const [steps, setSteps] = useState<AgentRunStep[]>(() => seedFromRunSteps(run));
  const runIdRef = useRef(run.id);

  useEffect(() => {
    if (runIdRef.current !== run.id) {
      runIdRef.current = run.id;
      setSteps(seedFromRunSteps(run));
    }
  }, [run, run.id]);

  useEffect(() => {
    setSteps((prev) => mergeRunSteps(prev, run));
  }, [run, run.steps]);

  return useMemo(() => steps, [steps]);
}

/** @deprecated Use useAgentRunProgressSteps for timeline UI. */
export function useAgentRunProgressLog(run: AgentRun, progressLabel: string | null): string[] {
  const steps = useAgentRunProgressSteps(run, progressLabel);
  return steps.map((step) => step.label.trim()).filter(Boolean);
}
