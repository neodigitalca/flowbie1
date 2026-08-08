import { describe, expect, it } from "vitest";
import type { AgentConfig } from "@/types/agent-config";
import {
  assertHarnessTokenBudgetPreflight,
  computeHarnessSectionTokenBudgets,
  isHarnessSeoOpenerBodyAgent,
} from "@/lib/bulk/harness-section-max-tokens";
import { BLOG_HARNESS_SUMMARY_AGENT_ID } from "@/lib/bulk/blog-harness-summary-agent";

const bodyAgent = (overrides: Partial<AgentConfig> = {}): AgentConfig => ({
  id: "body-1",
  step: 1,
  title: "Section",
  description: "Desc",
  features: [],
  ...overrides,
});

const overviewAgent = (): AgentConfig => ({
  id: BLOG_HARNESS_SUMMARY_AGENT_ID,
  step: 0,
  title: "Overview",
  description: "Overview",
  features: [],
});

describe("computeHarnessSectionTokenBudgets", () => {
  it("allocates the full row budget across sections", () => {
    const sections = [
      { sectionKey: "Overview", agent: overviewAgent(), isOverview: true, bodySectionCount: 3 },
      { sectionKey: "Body A", agent: bodyAgent(), isOverview: false },
      { sectionKey: "Body B", agent: bodyAgent({ step: 2 }), isOverview: false },
    ];
    const slots = computeHarnessSectionTokenBudgets(sections, 6000);
    const allocated = slots.reduce((sum, slot) => sum + slot.maxTokens, 0);
    expect(allocated).toBe(6000);
    expect(slots.every((slot) => slot.maxTokens >= 256)).toBe(true);
  });

  it("gives heavier sections more tokens than lighter ones", () => {
    const sections = [
      { sectionKey: "Light", agent: bodyAgent({ step: 2 }), isOverview: false },
      {
        sectionKey: "Heavy",
        agent: bodyAgent({ features: ["[TABLE] pricing"], h3Enabled: true }),
        isOverview: false,
        isSeoOpener: true,
        importedExcerptChars: 900,
      },
    ];
    const slots = computeHarnessSectionTokenBudgets(sections, 8000);
    const light = slots.find((s) => s.sectionKey === "Light")!.maxTokens;
    const heavy = slots.find((s) => s.sectionKey === "Heavy")!.maxTokens;
    expect(heavy).toBeGreaterThan(light);
  });

  it("throws when row budget cannot cover sanity minimum per section", () => {
    expect(() =>
      computeHarnessSectionTokenBudgets(
        [{ sectionKey: "A", agent: bodyAgent(), isOverview: false }],
        128,
      ),
    ).toThrow(/Increase max tokens/);
  });
});

describe("assertHarnessTokenBudgetPreflight", () => {
  it("throws when total budget is below estimated need", () => {
    const sections = Array.from({ length: 8 }, (_, i) => ({
      sectionKey: `S${i}`,
      agent: bodyAgent({ step: i + 1, features: ["[TABLE]"] }),
      isOverview: false,
    }));
    const slots = computeHarnessSectionTokenBudgets(sections, 4000);
    expect(() => assertHarnessTokenBudgetPreflight(slots, 4000, sections.length)).toThrow(
      /Increase max tokens for this row/,
    );
  });

  it("passes when budget meets estimated need", () => {
    const sections = [
      { sectionKey: "Overview", agent: overviewAgent(), isOverview: true, bodySectionCount: 2 },
      { sectionKey: "Body", agent: bodyAgent(), isOverview: false },
    ];
    const slots = computeHarnessSectionTokenBudgets(sections, 24000);
    expect(() => assertHarnessTokenBudgetPreflight(slots, 24000, sections.length)).not.toThrow();
  });
});

describe("isHarnessSeoOpenerBodyAgent", () => {
  it("identifies first body step only", () => {
    expect(isHarnessSeoOpenerBodyAgent(bodyAgent({ step: 1 }))).toBe(true);
    expect(isHarnessSeoOpenerBodyAgent(bodyAgent({ step: 2 }))).toBe(false);
    expect(
      isHarnessSeoOpenerBodyAgent(bodyAgent({ id: BLOG_HARNESS_SUMMARY_AGENT_ID, step: 4 })),
    ).toBe(false);
  });
});
