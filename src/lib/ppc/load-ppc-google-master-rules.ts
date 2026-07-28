import {
  ensureMasterInstructionsInMemory,
  getMasterInstructionsPayload,
} from "@/lib/master-instructions-storage";

export type PpcMasterRulesContext = {
  sourceCount: number;
};

/** Always attempts to read per-site master rules; empty payload is valid and never throws. */
export async function loadPpcGoogleMasterRules(siteId: string): Promise<PpcMasterRulesContext> {
  await ensureMasterInstructionsInMemory(siteId);
  const payload = getMasterInstructionsPayload(siteId);
  return { sourceCount: payload.sources.length };
}
