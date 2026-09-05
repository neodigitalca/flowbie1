import { workflowClientVariableSuffix } from "@/lib/workflow/workflow-client-config";
import { workflowOutputsToContextBlocks } from "@/lib/workflow/workflow-context-inject";
import { effectiveClientSiteIds, filterWorkflowOutputsForSite } from "@/lib/workflow/workflow-rag-client";
import type { WorkflowStepOutput } from "@/lib/workflow/workflow-types";

export type WorkflowWalkClientScope = {
  /** Every client in the workflow (for RAG/context filtering). */
  allSiteIds: string[];
  /** Clients to execute on this walk (inline chain = one client). */
  activeSiteIds: string[];
};

export function buildWorkflowWalkClientScope(
  outputs: WorkflowStepOutput[],
  activeSiteIds: string[],
  allSiteIds?: string[],
): WorkflowWalkClientScope {
  const resolvedAll =
    allSiteIds && allSiteIds.length > 0
      ? allSiteIds
      : effectiveClientSiteIds(outputs, activeSiteIds);
  return {
    allSiteIds: resolvedAll,
    activeSiteIds: activeSiteIds.length > 0 ? activeSiteIds : resolvedAll,
  };
}

export function outputMatchesRagVariableKey(
  output: WorkflowStepOutput,
  ragKey: string,
  siteId: string,
  allSiteIds: string[],
): boolean {
  const key = ragKey.trim();
  if (!key) return false;
  const variableKey = output.variableKey.trim();
  if (variableKey === key) return true;
  if (allSiteIds.length <= 1) {
    return variableKey.startsWith(`${key}__`);
  }
  const suffix = workflowClientVariableSuffix(allSiteIds, siteId);
  return suffix ? variableKey === `${key}${suffix}` : false;
}

/** Build workflow RAG context for one client only. */
export function buildClientRunContextBlock(
  outputs: WorkflowStepOutput[],
  ragInputKeys: string[],
  siteId: string,
  clientSiteIds: string[],
): string {
  const targetSiteId = siteId.trim();
  if (!targetSiteId) return "";
  const allSiteIds = effectiveClientSiteIds(outputs, clientSiteIds);
  const scoped = filterWorkflowOutputsForSite(outputs, targetSiteId, allSiteIds);
  const keys = ragInputKeys.map((item) => item.trim()).filter(Boolean);
  if (keys.length === 0) return "";

  const runOutputs = scoped.filter(
    (output) =>
      output.scope === "run" &&
      keys.some((key) => outputMatchesRagVariableKey(output, key, targetSiteId, allSiteIds)),
  );
  return workflowOutputsToContextBlocks(runOutputs);
}
