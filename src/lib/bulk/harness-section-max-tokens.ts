import type { AgentConfig } from "@/types/agent-config";
import { BLOG_HARNESS_SUMMARY_AGENT_ID } from "@/lib/bulk/blog-harness-summary-agent";

const TOKEN_SANITY_MIN = 256;
const BASE_NEED_PER_WEIGHT_UNIT = 480;

export type HarnessSectionTokenInput = {
  sectionKey: string;
  agent: AgentConfig;
  isOverview: boolean;
  isSeoOpener?: boolean;
  importedExcerptChars?: number;
  bodySectionCount?: number;
};

export type HarnessSectionTokenSlot = {
  sectionKey: string;
  maxTokens: number;
  weight: number;
  estimatedNeed: number;
};

function computeSectionWeight(input: HarnessSectionTokenInput): number {
  if (input.isOverview) {
    const n = input.bodySectionCount ?? 0;
    return 0.85 + 0.08 * n;
  }

  let weight = 1;
  const feat = input.agent.features.join(" ").toLowerCase();
  if (feat.includes("[table]")) weight += 0.6;
  if (feat.includes("[list]")) weight += 0.35;
  if (input.agent.h3Enabled) weight += 0.25;
  if ((input.importedExcerptChars ?? 0) > 0) weight += 0.2;
  if (input.isSeoOpener) weight += 0.15;
  return weight;
}

function estimatedNeedForWeight(weight: number, importedExcerptChars: number): number {
  let need = BASE_NEED_PER_WEIGHT_UNIT * weight;
  if (importedExcerptChars > 800) need += 320;
  else if (importedExcerptChars > 400) need += 200;
  else if (importedExcerptChars > 0) need += 120;
  return Math.ceil(need);
}

/** Weighted split of row output budget across harness sections (no fixed per-section caps). */
export function computeHarnessSectionTokenBudgets(
  sections: HarnessSectionTokenInput[],
  totalBudget: number,
): HarnessSectionTokenSlot[] {
  if (!sections.length) return [];
  if (totalBudget < TOKEN_SANITY_MIN * sections.length) {
    throw new Error(
      `Increase max tokens for this row (need at least ${TOKEN_SANITY_MIN * sections.length}, have ${totalBudget} for ${sections.length} sections)`,
    );
  }

  const weighted = sections.map((section) => {
    const weight = computeSectionWeight(section);
    return {
      sectionKey: section.sectionKey,
      weight,
      estimatedNeed: estimatedNeedForWeight(weight, section.importedExcerptChars ?? 0),
      maxTokens: TOKEN_SANITY_MIN,
    };
  });
  const sumWeights = weighted.reduce((sum, slot) => sum + slot.weight, 0);
  for (const slot of weighted) {
    slot.maxTokens = Math.max(TOKEN_SANITY_MIN, Math.floor((totalBudget * slot.weight) / sumWeights));
  }

  let allocated = weighted.reduce((sum, slot) => sum + slot.maxTokens, 0);
  let remainder = totalBudget - allocated;
  const byWeight = [...weighted].sort((a, b) => b.weight - a.weight);
  let idx = 0;
  while (remainder > 0 && byWeight.length) {
    const key = byWeight[idx % byWeight.length]!.sectionKey;
    const slot = weighted.find((s) => s.sectionKey === key);
    if (slot) slot.maxTokens += 1;
    remainder -= 1;
    idx += 1;
  }

  return weighted;
}

export function assertHarnessTokenBudgetPreflight(
  slots: HarnessSectionTokenSlot[],
  totalBudget: number,
  sectionCount: number,
): void {
  const totalNeed = slots.reduce((sum, slot) => sum + slot.estimatedNeed, 0);
  const underfunded = slots.filter((slot) => slot.maxTokens < slot.estimatedNeed);
  if (underfunded.length > 0 || totalBudget < totalNeed) {
    throw new Error(
      `Increase max tokens for this row (need ~${totalNeed}, have ${totalBudget} for ${sectionCount} sections)`,
    );
  }
}

export function isHarnessSeoOpenerBodyAgent(agent: AgentConfig): boolean {
  return agent.id !== BLOG_HARNESS_SUMMARY_AGENT_ID && agent.step === 1;
}
