import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  buildBlueprintPromptMessages,
  buildChecklistPromptMessages,
  buildKeywordAnalysisSystemPrompt,
  buildKeywordAnalysisUserPrompt,
} from "@/lib/post-creator/post-creator-generator-prompts";
import { parseBlogTemplateChecklist } from "@/lib/post-creator/post-creator-checklist-post-process";

const fixture = {
  title: "Alta Window Fashions Explained",
  keywordData: {
    keyword: "alta window fashions",
    searchVolume: 1200,
    difficulty: 42,
    intent: "informational",
  },
  selectedKeywords: ["alta blinds", "motorized shades"],
  selectedH2Sections: ["Why Alta Window Fashions Matter", "Smart Home Integration"],
  userPrompt: "Focus on Calgary homeowners.",
  connectedSite: { name: "Advance Blinds", siteUrl: "https://advanceblinds.ca" },
  wordPressPosts: [
    {
      title: "Hunter Douglas vs Alta",
      link: "https://advanceblinds.ca/blog/hunter-douglas-vs-alta",
      excerpt: "Compare brands",
    },
  ],
  bucketReadFirstBlock: "",
};

describe("post-creator-generator-prompts", () => {
  it("builds checklist prompts without ## examples in system", () => {
    const { system, user } = buildChecklistPromptMessages(fixture);
    expect(system).toContain("Do NOT use ## markdown headings");
    expect(system).toContain("WORDPRESS POSTS SOURCE");
    expect(system).toContain("FOCUS KEYWORD DENSITY");
    expect(user).toContain("5-6 checklist items");
    expect(system).not.toMatch(/^## /m);
  });

  it("builds blueprint prompts with intro rename rule", () => {
    const { system } = buildBlueprintPromptMessages({
      title: fixture.title,
      purpose: "Guide to alta window fashions",
      keyword: "alta window fashions",
      checklist: ["Why Alta Window Fashions Matter [EXACT PRIMARY PER H2]"],
      connectedSite: fixture.connectedSite,
      wordPressPosts: fixture.wordPressPosts,
    });
    expect(system).toContain("Rename Introduction/Intro");
    expect(system).toContain("Blueprint Architect");
  });

  it("matches exported PHP snapshot markers", () => {
    const snapshotPath = path.join(
      process.cwd(),
      "wordpress-plugins/neo-pulse-app/includes/agent-runs/prompts/.generator-prompt-snapshot.json",
    );
    if (!fs.existsSync(snapshotPath)) return;
    const snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf8")) as {
      checklistSystemMarkers?: string[];
    };
    const { system } = buildChecklistPromptMessages(fixture);
    for (const marker of snapshot.checklistSystemMarkers ?? []) {
      expect(system).toContain(marker);
    }
  });

  it("strips ## from parsed checklist lines", () => {
    const raw = [
      "1. ## Experience the Future of Window Coverings [STRUCTURE]: 2 paragraphs.",
      "2. Why Alta Window Fashions Matter [EXACT PRIMARY PER H2] [LINK]: 3-5 links.",
      "3. **Bold only:** stray bullet without markers.",
      "4. Installation Steps [LIST]: number steps [TABLE]: compare.",
      "5. Conclusion with alta window fashions [EXACT PRIMARY PER H2].",
    ].join("\n");
    const parsed = parseBlogTemplateChecklist(raw);
    expect(parsed.length).toBeGreaterThanOrEqual(4);
    for (const item of parsed) {
      expect(item).not.toMatch(/^##\s/);
      expect(item).not.toMatch(/^\*\*[^*]+\*\*:\s*$/);
    }
    expect(parsed[0]).toContain("Experience the Future");
    expect(parsed.some((i) => i.includes("[TABLE]"))).toBe(true);
  });

  it("exports keyword analysis prompt shape", () => {
    expect(buildKeywordAnalysisSystemPrompt()).toContain("JSON");
    expect(buildKeywordAnalysisUserPrompt("alta window fashions", "{}")).toContain(
      "alta window fashions",
    );
  });
});
