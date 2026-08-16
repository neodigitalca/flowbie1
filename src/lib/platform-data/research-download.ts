import type { PlatformDataResearchMeta } from "./types";

export function downloadAgentArtifact(filename: string, data: unknown, exportedAt = new Date().toISOString()): void {
  const payload =
    typeof data === "object" && data !== null && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : { payload: data };
  const bundle = { exportedAt, ...payload };
  const json = JSON.stringify(bundle, null, 2);
  const stamp = exportedAt.replace(/[:.]/g, "-");
  const safeName = filename.replace(/[^\w.-]+/g, "-");
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = safeName.includes(".json") ? safeName : `pulse-assist-${safeName}-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadResearchBundle(
  meta: PlatformDataResearchMeta,
  exportedAt = new Date().toISOString(),
): void {
  if (!meta.researchArtifacts) return;

  const bundle = {
    exportedAt,
    intentSummary: meta.intentSummary,
    sliceTeam: meta.sliceTeam,
    leadAgentUsed: meta.leadAgentUsed,
    dataToolClassifierReason: meta.dataToolClassifierReason,
    researchedDataToolIds: meta.researchedDataToolIds,
    inventorySource: meta.inventorySource,
    acfComplete: meta.acfComplete,
    ...meta.researchArtifacts,
  };

  const json = JSON.stringify(bundle, null, 2);
  const stamp = exportedAt.replace(/[:.]/g, "-");
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pulse-assist-research-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function latestResearchTurnMeta(
  turns: Array<{ kind: string } & Partial<PlatformDataResearchMeta>>,
): PlatformDataResearchMeta | null {
  for (let i = turns.length - 1; i >= 0; i--) {
    const turn = turns[i];
    if (turn.kind === "card" && turn.researchArtifacts) {
      return {
        researchArtifacts: turn.researchArtifacts,
        intentSummary: turn.intentSummary,
        sliceTeam: turn.sliceTeam,
        leadAgentUsed: turn.leadAgentUsed,
        dataToolClassifierReason: turn.dataToolClassifierReason,
        researchedDataToolIds: turn.researchedDataToolIds,
        inventorySource: turn.inventorySource,
        acfComplete: turn.acfComplete,
      };
    }
  }
  return null;
}
