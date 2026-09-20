import { describe, expect, it } from "vitest";
import { ensureConnectedSiteHarnessMarkers } from "@/lib/bulk/connected-site-harness-markers";
import { agentHasIllustrativeFeature } from "@/lib/bulk/bulk-harness-outline";

describe("ensureConnectedSiteHarnessMarkers", () => {
  it("keeps planner titles and does not invent ILLUSTRATIVE", () => {
    const agents = [
      "Criteria That Decide The Winner",
      "Side By Side Comparison",
      "Motorization Options",
    ].map((title, index) => ({
      id: `agent-${index + 1}`,
      step: index + 1,
      title,
      description: "",
      features: ["[STRUCTURE]: 2-3 paragraphs.", "[LINK]: 3-5 internal links."],
      h2Count: 1,
      h3Count: 0,
      h3Enabled: false,
      headingLevel: 1,
      maxTokens: 2000,
    }));

    const marked = ensureConnectedSiteHarnessMarkers(agents);
    expect(marked.map((a) => a.title)).toEqual([
      "Criteria That Decide The Winner",
      "Side By Side Comparison",
      "Motorization Options",
    ]);
    expect(marked.filter((a) => agentHasIllustrativeFeature(a))).toHaveLength(0);
  });

  it("keeps the first illustrative marker and strips extras without renaming", () => {
    const agents = [
      "Cost Differences",
      "Motorization Options",
      "Fabric Choices",
    ].map((title, index) => ({
      id: `agent-${index + 1}`,
      step: index + 1,
      title,
      description: "",
      features: ["[STRUCTURE]: 2-3 paragraphs.", "[ILLUSTRATIVE]: stray", "[BLOCKQUOTE]: stray"],
      h2Count: 1,
      h3Count: 0,
      h3Enabled: false,
      headingLevel: 1,
      maxTokens: 2000,
    }));

    const marked = ensureConnectedSiteHarnessMarkers(agents);
    const illustrativeAgents = marked.filter((a) => agentHasIllustrativeFeature(a));
    expect(illustrativeAgents).toHaveLength(1);
    expect(illustrativeAgents[0]?.title).toBe("Cost Differences");
    expect(marked[1]?.title).toBe("Motorization Options");
    expect(marked[1]?.features?.some((f) => f.toLowerCase().startsWith("[illustrative]"))).toBe(false);
  });

  it("keeps planner titles even when they look generic", () => {
    const agents = ["Section 1", "Humidity And Fabric Choice"].map((title, index) => ({
      id: `agent-${index + 1}`,
      step: index + 1,
      title,
      description: "",
      features: ["[STRUCTURE]: 2-3 paragraphs."],
      h2Count: 1,
      h3Count: 0,
      h3Enabled: false,
      headingLevel: 1,
      maxTokens: 2000,
    }));
    const marked = ensureConnectedSiteHarnessMarkers(agents);
    expect(marked.map((a) => a.title)).toEqual(["Section 1", "Humidity And Fabric Choice"]);
  });
});
