import type { TaskExecutionClientRunContract, TaskExecutionPayload } from "@/lib/tasks-types";

export function mergeRunContractOptimizationOptions(
  payload: Pick<TaskExecutionPayload, "optimizationOptions"> | null | undefined,
  client: Pick<TaskExecutionClientRunContract, "optimizationOptions"> | null | undefined,
): NonNullable<TaskExecutionClientRunContract["optimizationOptions"]> {
  const payloadOpts = payload?.optimizationOptions ?? {};
  const clientOpts = client?.optimizationOptions ?? {};
  return {
    ...payloadOpts,
    ...clientOpts,
    forceNewResearch: payloadOpts.forceNewResearch === true || clientOpts.forceNewResearch === true,
  };
}
