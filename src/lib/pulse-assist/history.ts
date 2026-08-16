import type { AssistHistoryMessage } from "./types";
import type { PlatformDataResearchMeta } from "@/lib/platform-data/types";
import { extractPulseNavLinksFromMarkdown } from "./navigation";
import type { AssistCardLink } from "./types";

export type AssistChatTurn =
  | { kind: "user"; text: string }
  | ({ kind: "card"; card: NonNullable<AssistHistoryMessage["card"]> } & PlatformDataResearchMeta);

/** Rebuild visible chat turns from persisted Assist history JSON. */
export function turnsFromAssistHistory(history: AssistHistoryMessage[]): AssistChatTurn[] {
  const turns: AssistChatTurn[] = [];
  for (const msg of history) {
    if (msg.role === "user") {
      const text = msg.content?.trim();
      if (text) turns.push({ kind: "user", text });
      continue;
    }
    if (msg.role === "assistant" && msg.card && typeof msg.card === "object") {
      const meta = msg.researchMeta;
      turns.push({
        kind: "card",
        card: msg.card,
        researchedDataToolIds: meta?.researchedDataToolIds,
        dataToolClassifierReason: meta?.dataToolClassifierReason,
        researchedDataBlock: meta?.researchedDataBlock,
        inventorySource: meta?.inventorySource,
        acfComplete: meta?.acfComplete,
        sliceTeam: meta?.sliceTeam,
        leadAgentUsed: meta?.leadAgentUsed,
        intentSummary: meta?.intentSummary,
        researchArtifacts: meta?.researchArtifacts,
      });
    }
  }
  return turns;
}

/** Merge explicit card links with pulse:nav links parsed from markdown body. */
export function mergeAssistCardLinks(
  links: AssistCardLink[] | undefined,
  body: string | undefined,
): AssistCardLink[] | undefined {
  const merged = [...(links ?? [])];
  const seen = new Set(merged.map((l) => l.url).filter(Boolean) as string[]);
  for (const link of extractPulseNavLinksFromMarkdown(body ?? "")) {
    if (!link.url || seen.has(link.url)) continue;
    merged.push(link);
    seen.add(link.url);
  }
  return merged.length > 0 ? merged : undefined;
}
