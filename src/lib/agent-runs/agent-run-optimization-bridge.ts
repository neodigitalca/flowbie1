import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { ContinueOptimizationFn } from "@/hooks/content-optimization/continue-optimization";
import type {
  BulkOptimizationState,
  OptimizationProgressState,
} from "@/hooks/content-optimization/use-optimization-state";
import type { OptimizationFileManager } from "@/lib/optimization-file-manager";

type AgentRunOptimizationBridge = {
  setIsOptimizingContent: Dispatch<SetStateAction<Record<string, boolean>>>;
  setOptimizationProgress: Dispatch<SetStateAction<Record<string, OptimizationProgressState>>>;
  setBulkOptimizationState: Dispatch<SetStateAction<Record<string, BulkOptimizationState>>>;
  setOptimizationFileManagers: Dispatch<SetStateAction<Record<string, OptimizationFileManager>>>;
  optimizationFileManagers: Record<string, OptimizationFileManager>;
  continueOptimizationRef: MutableRefObject<ContinueOptimizationFn | null>;
};

let bridge: AgentRunOptimizationBridge | null = null;

export function registerAgentRunOptimizationBridge(next: AgentRunOptimizationBridge): void {
  bridge = next;
}

export function unregisterAgentRunOptimizationBridge(): void {
  bridge = null;
}

export function getAgentRunOptimizationBridge(): AgentRunOptimizationBridge | null {
  return bridge;
}
