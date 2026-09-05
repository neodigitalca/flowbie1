import { describe, expect, it } from "vitest";
import {
  ILLUSTRATIVE_DEFAULT_H2,
  isBadIllustrativeH2Title,
  resolveIllustrativeH2Title,
  rewriteIllustrativeChecklistItemHeading,
  stripLegacyScenarioPhrasesFromExistingPageText,
} from "@/lib/content-optimization/first-party-authority-prompt";
import { finalizeHarnessSectionHtml, normalizeIllustrativeHarnessHtml } from "@/lib/bulk/harness-section-validate";
import { prepareChecklistForPipeline } from "@/lib/content-word-blocklist";
import { pinBlueprintAgentTitle, pinSapChecklistMandatoryHeadings, SAP_LOCAL_CONDITIONS_H2, SAP_NEXT_STEPS_H2, SAP_OPTIONS_FIT_H2, SAP_PROBLEM_H2 } from "@/lib/prompt-builders/sap-page-template";
import { AUTHENTICITY_CHECKLIST_RULE, generateSingleSectionPrompt } from "@/lib/prompt-builders/core";
import { UNIFIED_COPY_FORMATTING_RULE, HARNESS_HEADING_TITLE_CASE_RULE } from "@/lib/prompt-builders/title-rules";
import type { AgentConfig } from "@/types/agent-config";

describe("illustrative H2 helpers", () => {
  it("flags realistic local situation titles", () => {
    expect(
      isBadIllustrativeH2Title(
        "A realistic local situation: managing light and privacy near Blinds Sunset Park FL",
      ),
    ).toBe(true);
    expect(resolveIllustrativeH2Title("A realistic local situation: foo bar")).toBe(
      ILLUSTRATIVE_DEFAULT_H2,
    );
  });

  it("rewrites illustrative checklist item to fixed H2 when marker present", () => {
    const item =
      '4. A realistic local situation near Foo [STRUCTURE]: 2 paragraphs. [ILLUSTRATIVE] [BLOCKQUOTE]';
    expect(rewriteIllustrativeChecklistItemHeading(item)).toContain(ILLUSTRATIVE_DEFAULT_H2);
    expect(rewriteIllustrativeChecklistItemHeading(item)).not.toContain("realistic local");
  });

  it("rewrites bad illustrative title without [ILLUSTRATIVE] marker (SAP slot 4)", () => {
    const item =
      '4. A realistic local situation: managing light near Blinds Sunset Park FL [STRUCTURE]: 2 paragraphs.';
    const out = rewriteIllustrativeChecklistItemHeading(item, 3, "Sunset Park, FL");
    expect(out).toContain(ILLUSTRATIVE_DEFAULT_H2);
    expect(out).not.toMatch(/realistic local/i);
    expect(out).toContain("[STRUCTURE]");
  });

  it("strips legacy scenario phrases from existing page text", () => {
    const raw =
      "Intro copy. A realistic local situation: managing light near Foo. Scenario: Given humid climate, what fits? More facts.";
    const out = stripLegacyScenarioPhrasesFromExistingPageText(raw);
    expect(out).not.toMatch(/realistic local situation/i);
    expect(out).not.toMatch(/scenario:/i);
    expect(out).toContain("Intro copy");
  });
});

describe("prepareChecklistForPipeline SAP pins", () => {
  it("pins Next Steps and illustrative H2 for SAP entity", () => {
    const checklist = [
      "1. Problem here [STRUCTURE]",
      "2. Local conditions [STRUCTURE]",
      "3. What fits [STRUCTURE]",
      "4. A realistic local situation: managing blinds near Sunset Park [STRUCTURE]",
      "5. What we offer locally [STRUCTURE]",
      "6. Our recommendation for homeowners in Sunset Park: best picks [STRUCTURE]",
      "7. Next Steps: Getting your ideal blinds in Sunset Park [STRUCTURE]",
    ];
    const out = prepareChecklistForPipeline(checklist, { sapEntity: "Sunset Park, FL" });
    expect(out[0]).toMatch(new RegExp(`^1\\. ${SAP_PROBLEM_H2.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
    expect(out[1]).toMatch(new RegExp(`^2\\. ${SAP_LOCAL_CONDITIONS_H2.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
    expect(out[2]).toMatch(new RegExp(`^3\\. ${SAP_OPTIONS_FIT_H2.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
    expect(out[3]).toContain(ILLUSTRATIVE_DEFAULT_H2);
    expect(out[4]).toMatch(/^5\. What We Offer/i);
    expect(out[6]).toMatch(/^7\. Next Steps /);
    expect(out[6]).toBe(`7. ${SAP_NEXT_STEPS_H2} [STRUCTURE]`);
    expect(out[6]).not.toContain(": Getting");
  });
});

describe("pinSapChecklistMandatoryHeadings", () => {
  it("pins item 7 to exact Next Steps without colon subtitle", () => {
    const out = pinSapChecklistMandatoryHeadings("Sunset Park, FL", [
      "1. A [STRUCTURE]",
      "2. B [STRUCTURE]",
      "3. C [STRUCTURE]",
      "4. Bad illustrative title here [STRUCTURE]",
      "5. Offerings [STRUCTURE]",
      "6. Rec [STRUCTURE]",
      "7. Next Steps: Getting your ideal blinds [STRUCTURE]",
    ]);
    expect(out[6]).toBe(`7. ${SAP_NEXT_STEPS_H2} [STRUCTURE]`);
  });

  it("blog keeps one illustrative H2 and leaves other titles intact", () => {
    const out = prepareChecklistForPipeline(
      [
        "1. Cost Differences [STRUCTURE] [ILLUSTRATIVE]",
        "2. Motorization Options [STRUCTURE] [ILLUSTRATIVE]",
        "3. Fabric Choices [STRUCTURE] [LIST]",
      ],
    );
    expect(out.filter((row) => row.includes(ILLUSTRATIVE_DEFAULT_H2))).toHaveLength(1);
    expect(out[0]).toContain(ILLUSTRATIVE_DEFAULT_H2);
    expect(out[1]).toContain("Motorization Options");
    expect(out[1]).not.toContain("[ILLUSTRATIVE]");
    expect(out[2]).toContain("Fabric Choices");
  });

  it("does not duplicate illustrative H2 when multiple rows carry [ILLUSTRATIVE]", () => {
    const out = prepareChecklistForPipeline(
      [
        "1. Sunlight issues [STRUCTURE]",
        "2. Local climate facts [STRUCTURE]",
        "3. Options overview [STRUCTURE]",
        "4. Slot four [STRUCTURE] [ILLUSTRATIVE] [BLOCKQUOTE]",
        "5. What we offer [STRUCTURE] [ILLUSTRATIVE]",
        "6. Recommendation [STRUCTURE] [ILLUSTRATIVE]",
        "7. Next steps [STRUCTURE] [ILLUSTRATIVE]",
      ],
      { sapEntity: "Sunset Park, FL" },
    );
    const illustrativeCount = out.filter((row) =>
      row.includes(ILLUSTRATIVE_DEFAULT_H2),
    ).length;
    expect(illustrativeCount).toBe(1);
    expect(out[3]).toContain(ILLUSTRATIVE_DEFAULT_H2);
    expect(out[4]).not.toContain("[ILLUSTRATIVE]");
    expect(out[5]).not.toContain("[ILLUSTRATIVE]");
  });
});

describe("prepareChecklistForPipeline blog (no pin)", () => {
  it("keeps LLM headings without pinned vs spine", () => {
    const out = prepareChecklistForPipeline(
      [
        "1. Brand Comparison [STRUCTURE] [ILLUSTRATIVE]",
        "2. Motorization Options [STRUCTURE] [ILLUSTRATIVE]",
        "3. Fabric Choices [STRUCTURE] [LIST]",
        "4. Energy Efficiency [STRUCTURE]",
        "5. How To Choose [STRUCTURE]",
        "6. Warranty Details [STRUCTURE] [ILLUSTRATIVE]",
      ],
    );
    expect(out).toHaveLength(6);
    expect(out.filter((row) => row.includes("Criteria That Decide The Winner"))).toHaveLength(0);
    expect(out[1]).not.toContain("Side By Side Comparison");
    expect(out.filter((row) => row.includes(ILLUSTRATIVE_DEFAULT_H2))).toHaveLength(1);
  });
});

describe("pinBlueprintAgentTitle blog", () => {
  it("does not rewrite a long non-illustrative title to the default H2", () => {
    const longTitle = "Hunter Douglas Versus Alta Motorization And Smart Home Control";
    expect(pinBlueprintAgentTitle(longTitle, ["[STRUCTURE]"], 0)).toBe(longTitle);
  });

  it("does not pin vs titles by content type (blog pinning removed)", () => {
    expect(pinBlueprintAgentTitle("Whatever", [], 0)).toBe("Whatever");
    expect(pinBlueprintAgentTitle("Whatever", [], 1)).toBe("Whatever");
    expect(
      pinBlueprintAgentTitle("A realistic local situation: managing light", ["[ILLUSTRATIVE]"], 0),
    ).toBe(ILLUSTRATIVE_DEFAULT_H2);
  });
});

describe("normalizeIllustrativeHarnessHtml (legacy helper)", () => {
  it("replaces bad H2 and strips Scenario label from intro", () => {
    const raw = `<h2>A realistic local situation: managing light near Blinds Sunset Park FL</h2>
<p>Scenario: Given the humid climate, what blinds fit Eleanor's home?</p>
<h3>Recommendation: Vinyl blinds</h3>
<p>In The Shade would recommend vinyl.</p>`;
    const out = normalizeIllustrativeHarnessHtml(raw);
    expect(out).toContain(`<h2>${ILLUSTRATIVE_DEFAULT_H2}</h2>`);
    expect(out.toLowerCase()).not.toContain("scenario:");
    expect(out).not.toMatch(/realistic local situation/i);
  });
});

describe("finalizeHarnessSectionHtml illustrative", () => {
  it("enforces pinned illustrative H2 without HTML normalize rewrite", () => {
    const raw = `<h2>A realistic local situation: managing light near Blinds Sunset Park FL</h2>
<p>Given the humid climate, Eleanor needs moisture-resistant options.</p>`;
    const out = finalizeHarnessSectionHtml(raw, {
      isOverview: false,
      isIllustrative: true,
      title: ILLUSTRATIVE_DEFAULT_H2,
    });
    expect(out).toContain(`<h2 id="a-local-homeowner-example">${ILLUSTRATIVE_DEFAULT_H2}</h2>`);
    expect(out).not.toMatch(/realistic local situation/i);
  });
});

describe("unified formatting prompt", () => {
  it("includes unified rule in checklist and writer prompts", () => {
    expect(AUTHENTICITY_CHECKLIST_RULE).toContain("UNIFIED COPY FORMATTING");
    expect(AUTHENTICITY_CHECKLIST_RULE).not.toContain("keyword jobs");
    expect(UNIFIED_COPY_FORMATTING_RULE).toContain("Title Case everywhere");
    expect(HARNESS_HEADING_TITLE_CASE_RULE).toContain("Title Case");

    const agent: AgentConfig = {
      id: "agent-5",
      step: 5,
      title: "What We Offer",
      description: "Catalog section",
      features: ["[STRUCTURE]: 2 paragraphs.", "[TABLE]"],
      h2Count: 1,
      h3Count: 0,
      h3Enabled: false,
      headingLevel: 1,
      maxTokens: 2000,
    };
    const prompt = generateSingleSectionPrompt(agent, "html");
    expect(prompt).toContain("UNIFIED COPY FORMATTING");
  });
});
