import type { AgentConfig } from "@/types/agent-config";
import { extractChecklistItemTitle } from "@/lib/post-creator/post-creator-checklist-post-process";
import { INTERNAL_LINK_PLACEHOLDER_FEATURE_SUFFIX } from "@/lib/content-generation/internal-link-placeholders";

const LINK_FEATURE_PLACEHOLDER = `[LINK]: ${INTERNAL_LINK_PLACEHOLDER_FEATURE_SUFFIX}`;

function agentTitle(agent: AgentConfig): string {
  return extractChecklistItemTitle(agent.title?.trim() || "").trim();
}

function featureHasPrefix(features: unknown[], prefix: string): boolean {
  const p = prefix.toLowerCase();
  return features.some((f) => typeof f === "string" && f.toLowerCase().trim().startsWith(p));
}

/** Keep planner titles. Strip extra [ILLUSTRATIVE] after the first. Never invent markers or pin H2s. */
export function ensureConnectedSiteHarnessMarkers<T extends AgentConfig>(
  agents: T[],
  _sapEntity?: string,
): T[] {
  if (!agents.length) return agents;

  const firstIllustrative = agents.findIndex((a) =>
    featureHasPrefix(Array.isArray(a.features) ? a.features : [], "[illustrative]"),
  );

  return agents.map((agent, index) => {
    let features = (Array.isArray(agent.features) ? agent.features : []).filter(
      (f): f is string => typeof f === "string",
    );
    if (firstIllustrative >= 0 && index !== firstIllustrative) {
      features = features.filter((f) => {
        const lo = f.toLowerCase().trim();
        return !lo.startsWith("[illustrative]") && !lo.startsWith("[blockquote]");
      });
    }
    if (!features.some((f) => f.toLowerCase().trim().startsWith("[structure]"))) {
      features = ["[STRUCTURE]: 2-3 paragraphs.", ...features];
    }
    if (!featureHasPrefix(features, "[link]")) {
      features = [...features, LINK_FEATURE_PLACEHOLDER];
    }
    const title = agentTitle(agent) || agent.title?.trim() || "";
    return { ...agent, title, features };
  });
}

/** Checklist row suffixes from markers the planner already wrote. */
export function connectedSiteChecklistMarkerSuffixes(titles: string[]): Map<number, string> {
  const agents = titles.map((title, index) => ({
    id: `row-${index + 1}`,
    step: index + 1,
    title,
    description: "",
    features: ["[STRUCTURE]: 2-3 paragraphs.", LINK_FEATURE_PLACEHOLDER],
    h2Count: 1,
    h3Count: 0,
    h3Enabled: false,
    headingLevel: 1,
    maxTokens: 2000,
  })) as AgentConfig[];

  const marked = ensureConnectedSiteHarnessMarkers(agents);
  const out = new Map<number, string>();
  for (let i = 0; i < marked.length; i++) {
    const extras = (marked[i]!.features ?? []).filter((f) => {
      const lo = f.toLowerCase().trim();
      return (
        lo.startsWith("[illustrative]") ||
        lo.startsWith("[blockquote]") ||
        lo.startsWith("[decision]") ||
        lo.startsWith("[tradeoff]") ||
        lo.startsWith("[recommendation]")
      );
    });
    if (extras.length) out.set(i, ` ${extras.join(" ")}`);
  }
  return out;
}
