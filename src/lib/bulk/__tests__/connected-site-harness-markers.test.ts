import { describe, expect, it } from "vitest";
import {
  ensureConnectedSiteHarnessMarkers,
  pickIllustrativeHarnessTitle,
} from "@/lib/bulk/connected-site-harness-markers";
import { agentHasIllustrativeFeature } from "@/lib/bulk/bulk-harness-outline";
import { ILLUSTRATIVE_DEFAULT_H2 } from "@/lib/content-optimization/first-party-authority-prompt";
import { SAP_NEXT_STEPS_H2, SAP_PROBLEM_H2, SAP_LOCAL_CONDITIONS_H2, SAP_OPTIONS_FIT_H2, SAP_WHAT_WE_OFFER_H2 } from "@/lib/prompt-builders/sap-page-template";

const solarTitles = [
  "Your Guide to Solar Panel Efficiency in Edmonton",
  "How Solar Panel Efficiency Affects Your Energy Savings",
  "Factors Influencing Solar Panel Performance in Alberta",
  "Choosing the Right Solar Panels for Your Home",
  "Maximizing Your Solar Investment in Edmonton",
  "Ridgeline Solar: Your Partner for Efficient Energy Solutions",
];

describe("pickIllustrativeHarnessTitle", () => {
  it("prefers choosing/selecting H2 over partner CTA", () => {
    expect(pickIllustrativeHarnessTitle(solarTitles)).toBe(
      "Choosing the Right Solar Panels for Your Home",
    );
  });
});

describe("ensureConnectedSiteHarnessMarkers", () => {
  it("assigns ILLUSTRATIVE and BLOCKQUOTE to best-fit H2 when planner omitted markers", () => {
    const agents = solarTitles.map((title, index) => ({
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
    const illustrative = marked.find((a) => agentHasIllustrativeFeature(a));

    expect(illustrative?.title).toBe(ILLUSTRATIVE_DEFAULT_H2);
    expect(
      illustrative?.features?.some((f) => f.toLowerCase().trim().startsWith("[blockquote]")),
    ).toBe(true);

    const recommendation = marked
      .flatMap((a) => a.features ?? [])
      .find((f) => f.toLowerCase().trim().startsWith("[recommendation]"));
    expect(recommendation).toContain("Best for {job}: {option}");
    expect(recommendation).toContain("connected business name");
  });

  it("blog strips extra ILLUSTRATIVE so only one Chloe section exists", () => {
    const agents = [
      "Cost Differences",
      "Motorization Options",
      "Fabric Choices",
      "Quality Standards",
      "Product Range",
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
    expect(illustrativeAgents[0]?.title).toBe(ILLUSTRATIVE_DEFAULT_H2);
    expect(marked.filter((a) => a.title === ILLUSTRATIVE_DEFAULT_H2)).toHaveLength(1);
  });

  it("does not duplicate ILLUSTRATIVE when already present", () => {
    const agents = [
      {
        id: "agent-1",
        step: 1,
        title: "Choosing Panels",
        description: "",
        features: ["[ILLUSTRATIVE]: existing", "[BLOCKQUOTE]: existing"],
        h2Count: 1,
        h3Count: 0,
        h3Enabled: false,
        headingLevel: 1,
        maxTokens: 2000,
      },
      {
        id: "agent-2",
        step: 2,
        title: "Partner Section",
        description: "",
        features: ["[STRUCTURE]: 2-3 paragraphs."],
        h2Count: 1,
        h3Count: 0,
        h3Enabled: false,
        headingLevel: 1,
        maxTokens: 2000,
      },
    ];

    const marked = ensureConnectedSiteHarnessMarkers(agents);
    const illustrativeCount = marked.filter((a) => agentHasIllustrativeFeature(a)).length;
    expect(illustrativeCount).toBe(1);
    expect(marked[0]?.features?.filter((f) => f.toLowerCase().startsWith("[illustrative]")).length).toBe(1);
  });

  it("SAP entity pins illustrative marker only on agent index 3", () => {
    const sapTitles = [
      SAP_PROBLEM_H2,
      SAP_LOCAL_CONDITIONS_H2,
      SAP_OPTIONS_FIT_H2,
      ILLUSTRATIVE_DEFAULT_H2,
      SAP_WHAT_WE_OFFER_H2,
      "Our Recommendation for Homeowners in Sunset Park, FL",
      SAP_NEXT_STEPS_H2,
    ];
    const agents = sapTitles.map((title, index) => ({
      id: `agent-${index + 1}`,
      step: index + 1,
      title,
      description: "",
      features: [
        "[STRUCTURE]: 2-3 paragraphs.",
        "[LINK]: 3-5 internal links.",
        ...(index === 4 || index === 5 ? ["[ILLUSTRATIVE]: stray duplicate"] : []),
      ],
      h2Count: 1,
      h3Count: 0,
      h3Enabled: false,
      headingLevel: 1,
      maxTokens: 2000,
    }));

    const marked = ensureConnectedSiteHarnessMarkers(agents, "Sunset Park, FL");
    const illustrativeAgents = marked.filter((a) => agentHasIllustrativeFeature(a));
    expect(illustrativeAgents).toHaveLength(1);
    expect(illustrativeAgents[0]?.title).toBe(ILLUSTRATIVE_DEFAULT_H2);
    expect(marked[4]?.features?.some((f) => f.toLowerCase().startsWith("[illustrative]"))).toBe(false);
  });

  it("blog content picks highest-scoring illustrative title and renames H2", () => {
    const titles = [
      "Criteria That Decide The Winner",
      "Side By Side Comparison",
      "Motorization Options",
      "When One Brand Fits",
      "How To Choose",
      "Site First Recommendation",
    ];
    const agents = titles.map((title, index) => ({
      id: `agent-${index + 1}`,
      step: index + 1,
      title,
      description: "",
      features: ["[STRUCTURE]: 2-3 paragraphs.", "[LINK]: at least 1 [[LINK:query|anchor]]"],
      h2Count: 1,
      h3Count: 0,
      h3Enabled: false,
      headingLevel: 1,
      maxTokens: 2000,
    }));
    const marked = ensureConnectedSiteHarnessMarkers(agents);
    const illustrativeAgents = marked.filter((a) => agentHasIllustrativeFeature(a));
    expect(illustrativeAgents).toHaveLength(1);
    const illustrativeIndex = marked.findIndex((a) => agentHasIllustrativeFeature(a));
    expect(illustrativeIndex).toBe(4);
    expect(marked[illustrativeIndex]?.title).toBe(ILLUSTRATIVE_DEFAULT_H2);
    expect(agentHasIllustrativeFeature(marked[illustrativeIndex]!)).toBe(true);
    expect(marked[0]?.title).toBe("Criteria That Decide The Winner");
  });
});
