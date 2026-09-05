import { cancelAllLocalDominatorExportJobs, cancelLocalDominatorExportJob } from "@/lib/local-dominator-export-api";

const jobIdByAgentRunId = new Map<number, string>();

export function registerLocalDominatorExportJob(agentRunId: number, jobId: string): void {
  if (agentRunId < 1 || !jobId.trim()) return;
  jobIdByAgentRunId.set(agentRunId, jobId.trim());
}

export function unregisterLocalDominatorExportJob(agentRunId: number): void {
  if (agentRunId < 1) return;
  jobIdByAgentRunId.delete(agentRunId);
}

export async function cancelLocalDominatorExportJobForAgentRun(agentRunId: number): Promise<void> {
  const jobId = jobIdByAgentRunId.get(agentRunId);
  if (!jobId) return;
  jobIdByAgentRunId.delete(agentRunId);
  await cancelLocalDominatorExportJob(jobId);
}

export async function cancelAllRegisteredLocalDominatorExportJobs(): Promise<void> {
  const jobs = [...jobIdByAgentRunId.values()];
  jobIdByAgentRunId.clear();
  if (jobs.length === 0) return;
  await Promise.all(jobs.map((jobId) => cancelLocalDominatorExportJob(jobId)));
  await cancelAllLocalDominatorExportJobs();
}
