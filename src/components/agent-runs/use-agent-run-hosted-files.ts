import { useEffect, useState } from "react";
import {
  getAgentRunHostedFiles,
  subscribeAgentRunHostedFiles,
  type AgentRunHostedFile,
} from "@/lib/agent-runs/agent-run-hosted-files";

export function useAgentRunHostedFiles(runId: number): AgentRunHostedFile[] {
  const [files, setFiles] = useState<AgentRunHostedFile[]>(() => getAgentRunHostedFiles(runId));

  useEffect(() => {
    setFiles(getAgentRunHostedFiles(runId));
    return subscribeAgentRunHostedFiles(runId, () => {
      setFiles(getAgentRunHostedFiles(runId));
    });
  }, [runId]);

  return files;
}
