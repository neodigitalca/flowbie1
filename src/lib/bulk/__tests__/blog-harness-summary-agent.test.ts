import { describe, expect, it } from "vitest";
import type { AgentConfig } from "@/types/agent-config";
import {
  BLOG_HARNESS_SUMMARY_AGENT_ID,
  ensureBlogHarnessSummaryFirst,
} from "@/lib/bulk/blog-harness-summary-agent";

const body = (id: string, step: number, title = id): AgentConfig => ({
  id,
  step,
  title,
  description: `${id} desc`,
  features: [],
  headingLevel: 1,
});

describe("ensureBlogHarnessSummaryFirst", () => {
  it("prepends the summary agent at index 0 and reindexes steps", () => {
    const agents = [body("a", 1), body("b", 2), body("c", 3)];
    const out = ensureBlogHarnessSummaryFirst(agents);

    expect(out[0].id).toBe(BLOG_HARNESS_SUMMARY_AGENT_ID);
    expect(out).toHaveLength(4);
    expect(out.map((a) => a.step)).toEqual([1, 2, 3, 4]);
    expect(out.slice(1).map((a) => a.id)).toEqual(["a", "b", "c"]);
  });

  it("does not duplicate the summary agent when already present", () => {
    const first = ensureBlogHarnessSummaryFirst([body("a", 1), body("b", 2)]);
    const second = ensureBlogHarnessSummaryFirst(first);

    const summaryCount = second.filter((a) => a.id === BLOG_HARNESS_SUMMARY_AGENT_ID).length;
    expect(summaryCount).toBe(1);
    expect(second[0].id).toBe(BLOG_HARNESS_SUMMARY_AGENT_ID);
    expect(second.map((a) => a.step)).toEqual([1, 2, 3]);
  });

  it("removes a blueprint's own bare top Summary/Overview section to avoid duplicates", () => {
    const agents = [body("x", 1, "Overview"), body("y", 2, "Costs")];
    const out = ensureBlogHarnessSummaryFirst(agents);

    expect(out[0].id).toBe(BLOG_HARNESS_SUMMARY_AGENT_ID);
    expect(out).toHaveLength(2);
    expect(out[1].title).toBe("Costs");
  });

  it("leaves press releases unchanged", () => {
    const agents = [body("a", 1), body("b", 2)];
    const out = ensureBlogHarnessSummaryFirst(agents, "press_release");

    expect(out).toBe(agents);
    expect(out.some((a) => a.id === BLOG_HARNESS_SUMMARY_AGENT_ID)).toBe(false);
  });
});
