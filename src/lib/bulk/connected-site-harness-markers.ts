import type { AgentConfig } from "@/types/agent-config";
import { extractChecklistItemTitle } from "@/lib/post-creator/post-creator-checklist-post-process";
import { ILLUSTRATIVE_DEFAULT_H2 } from "@/lib/content-optimization/first-party-authority-prompt";
import { INTERNAL_LINK_PLACEHOLDER_FEATURE_SUFFIX } from "@/lib/content-generation/internal-link-placeholders";

const LINK_FEATURE_PLACEHOLDER = `[LINK]: ${INTERNAL_LINK_PLACEHOLDER_FEATURE_SUFFIX}`;

const ILLUSTRATIVE_FEATURE =
  "[ILLUSTRATIVE]: short H2, intro p, blockquote named persona, h3 titled Recommendation, business p (once).";
const BLOCKQUOTE_FEATURE =
  "[BLOCKQUOTE]: scenario prose in blockquote after intro p; persona name inside quote only; never Scenario as h3.";
const DECISION_FEATURE =
  "[DECISION]: When does [key spec/tier] actually matter? matrix (Situation | Importance).";
const TRADEOFF_FEATURE =
  "[TRADEOFF]: Is premium/higher-tier worth the extra cost? Clear when/skip-if criteria.";
const RECOMMENDATION_FEATURE =
  "[RECOMMENDATION]: So what should I actually buy. Extractable Best for {job}: {option} list plus connected business name in the close.";

function agentTitle(agent: AgentConfig): string {
  return extractChecklistItemTitle(agent.title?.trim() || "").trim();
}

function featureHasPrefix(features: unknown[], prefix: string): boolean {
  const p = prefix.toLowerCase();
  return features.some((f) => typeof f === "string" && f.toLowerCase().trim().startsWith(p));
}

function addFeature(features: string[], feature: string, prefix: string): string[] {
  if (featureHasPrefix(features, prefix)) return features;
  return [...features, feature];
}

function scoreIllustrativeTitle(title: string): number {
  const t = title.toLowerCase();
  let score = 0;
  if (/choos|select|pick|right .+ for|which .+ for|versus|\bvs\b|compare|comparison|sizing|size your/.test(t)) {
    score += 12;
  }
  if (/example|scenario|hypothetical|case study/.test(t)) score += 15;
  if (/how to choose|finding the right|selecting/.test(t)) score += 10;
  if (/partner|contact us|about us|our team|your partner|call us|get in touch/.test(t)) score -= 25;
  if (/guide to|introduction|what is|benefits of/.test(t)) score -= 2;
  return score;
}

function scoreDecisionTitle(title: string): number {
  const t = title.toLowerCase();
  let score = 0;
  if (/factor|influenc|perform|climate|condition|when does|matter|affect/.test(t)) score += 8;
  if (/cost|price|roi|savings|payback/.test(t)) score += 5;
  if (/choos|select|right .+ for/.test(t)) score += 3;
  if (/partner|contact|about us/.test(t)) score -= 20;
  return score;
}

function scoreTradeoffTitle(title: string): number {
  const t = title.toLowerCase();
  let score = 0;
  if (/worth|tradeoff|trade-off|premium|maximiz|investment|roi|payback|efficiency affect/.test(t)) {
    score += 10;
  }
  if (/cost|budget|financ/.test(t)) score += 4;
  if (/partner|contact|about us/.test(t)) score -= 20;
  return score;
}

function scoreRecommendationTitle(title: string): number {
  const t = title.toLowerCase();
  let score = 0;
  if (/maximiz|next step|recommend|get started|partner|contact|find your|your guide to getting/.test(t)) {
    score += 6;
  }
  if (/partner|contact|call us|our team/.test(t)) score += 4;
  if (/factor|choos|what is|benefits/.test(t)) score -= 5;
  return score;
}

function pickBestIndex(
  titles: string[],
  scorer: (title: string) => number,
  exclude: Set<number>,
): number {
  let best = -1;
  let bestScore = -Infinity;
  for (let i = 0; i < titles.length; i++) {
    if (exclude.has(i)) continue;
    const s = scorer(titles[i]!);
    if (s > bestScore) {
      bestScore = s;
      best = i;
    }
  }
  return best;
}

export function pickIllustrativeHarnessTitle(titles: string[]): string | undefined {
  const trimmed = titles.map((t) => t.trim()).filter(Boolean);
  if (!trimmed.length) return undefined;
  const idx = pickBestIndex(trimmed, scoreIllustrativeTitle, new Set());
  if (idx < 0 || scoreIllustrativeTitle(trimmed[idx]!) < 1) {
    const fallback = trimmed.find((t) => !/partner|contact us|about us|our team/i.test(t));
    return fallback ?? trimmed[Math.min(1, trimmed.length - 1)];
  }
  return trimmed[idx];
}

/** Deterministic A-level harness markers when the planner omitted them. */
export function ensureConnectedSiteHarnessMarkers<T extends AgentConfig>(
  agents: T[],
  sapEntity?: string,
): T[] {
  if (!agents.length) return agents;

  const titles = agents.map(agentTitle);
  const sap = sapEntity?.trim();
  const used = new Set<number>();

  let illustrativeTarget: number;
  let decisionTarget: number;
  let tradeoffTarget: number;
  let recommendationTarget: number;

  if (sap && agents.length >= 7) {
    illustrativeTarget = 3;
    decisionTarget = 2;
    tradeoffTarget = -1;
    recommendationTarget = 5;
    used.add(2);
    used.add(3);
    used.add(5);
  } else {
    const illustrativeIdx = agents.findIndex((a) =>
      featureHasPrefix(Array.isArray(a.features) ? a.features : [], "[illustrative]"),
    );
    illustrativeTarget =
      illustrativeIdx >= 0 ? illustrativeIdx : pickBestIndex(titles, scoreIllustrativeTitle, used);
    if (illustrativeTarget < 0) illustrativeTarget = Math.min(1, agents.length - 1);
    used.add(illustrativeTarget);

    const decisionExisting = agents.findIndex((a) =>
      featureHasPrefix(Array.isArray(a.features) ? a.features : [], "[decision]"),
    );
    decisionTarget =
      decisionExisting >= 0
        ? decisionExisting
        : pickBestIndex(titles, scoreDecisionTitle, used);
    if (decisionTarget >= 0) used.add(decisionTarget);

    const tradeoffExisting = agents.findIndex((a) =>
      featureHasPrefix(Array.isArray(a.features) ? a.features : [], "[tradeoff]"),
    );
    tradeoffTarget =
      tradeoffExisting >= 0 ? tradeoffExisting : pickBestIndex(titles, scoreTradeoffTitle, used);
    if (tradeoffTarget >= 0) used.add(tradeoffTarget);

    const recommendationExisting = agents.findIndex((a) =>
      featureHasPrefix(Array.isArray(a.features) ? a.features : [], "[recommendation]"),
    );
    recommendationTarget =
      recommendationExisting >= 0
        ? recommendationExisting
        : pickBestIndex(titles, scoreRecommendationTitle, used);
    if (recommendationTarget >= 0) used.add(recommendationTarget);
  }

  return agents.map((agent, index) => {
    let features = (Array.isArray(agent.features) ? agent.features : []).filter(
      (f): f is string => typeof f === "string",
    );
    if (index !== illustrativeTarget) {
      features = features.filter((f) => {
        const lo = f.toLowerCase().trim();
        return !lo.startsWith("[illustrative]") && !lo.startsWith("[blockquote]");
      });
    }
    if (!features.some((f) => f.toLowerCase().trim().startsWith("[structure]"))) {
      features = ["[STRUCTURE]: 2-3 paragraphs.", ...features];
    }
    if (!featureHasPrefix(features, "[link]")) {
      features = addFeature(features, LINK_FEATURE_PLACEHOLDER, "[link]");
    }

    if (index === illustrativeTarget) {
      features = addFeature(features, ILLUSTRATIVE_FEATURE, "[illustrative]");
      features = addFeature(features, BLOCKQUOTE_FEATURE, "[blockquote]");
    }
    if (decisionTarget >= 0 && index === decisionTarget) {
      features = addFeature(features, DECISION_FEATURE, "[decision]");
    }
    if (tradeoffTarget >= 0 && index === tradeoffTarget) {
      features = addFeature(features, TRADEOFF_FEATURE, "[tradeoff]");
    }
    if (recommendationTarget >= 0 && index === recommendationTarget) {
      features = addFeature(features, RECOMMENDATION_FEATURE, "[recommendation]");
    }

    const title =
      index === illustrativeTarget ? ILLUSTRATIVE_DEFAULT_H2 : agentTitle(agent);

    return { ...agent, title, features };
  });
}

/** Checklist row suffixes for optimize fallback rows (same marker picks as blueprint). */
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
