import type { AgentRun } from "@/lib/agent-runs-types";
import type { WorkflowStepOutputFileRef } from "@/lib/workflow/workflow-types";

export type GridExportChainPayload = {
  fileRefs?: WorkflowStepOutputFileRef[];
};

type GridExportChainHandler = (run: AgentRun, payload: GridExportChainPayload) => Promise<void>;

let gridExportChainHandler: GridExportChainHandler | null = null;

export function registerWorkflowGridExportChain(handler: GridExportChainHandler | null): void {
  gridExportChainHandler = handler;
}

async function invokeWorkflowAgentChain(run: AgentRun, payload: GridExportChainPayload): Promise<void> {
  if (!gridExportChainHandler) {
    throw new Error("Workflow agent chain is not registered.");
  }
  await gridExportChainHandler(run, payload);
}

/** CSV is on disk — start the next workflow agent immediately. */
export async function chainWorkflowOnGridExport(
  run: AgentRun,
  payload: GridExportChainPayload,
): Promise<void> {
  await invokeWorkflowAgentChain(run, payload);
}

/** Run Then / archive steps for this client after the agent harness finishes. */
export async function chainWorkflowAfterAgentComplete(
  run: AgentRun,
  payload: GridExportChainPayload = {},
): Promise<void> {
  await invokeWorkflowAgentChain(run, payload);
}
