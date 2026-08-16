import type { PlatformDataCardTurn, PlatformDataResearchMeta } from "./types";

export function appendResearchMetaToTurn<T extends { kind: string; card?: unknown }>(
  turn: T,
  meta?: PlatformDataResearchMeta,
): T | PlatformDataCardTurn {
  if (turn.kind !== "card") return turn;
  return {
    kind: "card",
    card: turn.card,
    researchedDataToolIds: meta?.researchedDataToolIds,
    dataToolClassifierReason: meta?.dataToolClassifierReason,
    researchedDataBlock: meta?.researchedDataBlock,
    inventorySource: meta?.inventorySource,
    acfComplete: meta?.acfComplete,
    sliceTeam: meta?.sliceTeam,
    leadAgentUsed: meta?.leadAgentUsed,
    intentSummary: meta?.intentSummary,
    researchArtifacts: meta?.researchArtifacts,
  };
}
