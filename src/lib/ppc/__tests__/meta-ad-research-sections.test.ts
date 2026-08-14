import { describe, expect, it } from "vitest";
import {
  buildInstagramGoalMarkdown,
  metaAdResearchDownloadFiles,
} from "@/lib/ppc/meta-ad-research-sections";
import { META_RESEARCH_SECTION_IDS } from "@/lib/ppc/meta-ad-research-sections";
import type { MetaAdInstagramGoal } from "@/lib/ppc/meta-ads-types";

const sampleGoal: MetaAdInstagramGoal = {
  goalStatement: "Drive contact form leads for Neo Digital digital presence services.",
  primaryTopic: "Neo Digital digital presence and contact",
  audience: "Edmonton business owners",
  adAngle: "Get found online with our help",
  hook: "Stop guessing your digital presence",
  visualDirection: "Branded graphic with contact motif, no SaaS UI",
  creativeMode: "agency_service",
  onImageTextHint: "We help you grow",
  referenceQueries: ["instagram ad contact us minimal text", "digital presence branded graphic"],
};

describe("meta-ad-research-sections", () => {
  it("builds instagram goal markdown", () => {
    const md = buildInstagramGoalMarkdown(sampleGoal);
    expect(md).toContain("Drive contact form leads");
    expect(md).toContain("Reference queries");
    expect(md).not.toContain("Forbidden visuals");
  });

  it("builds downloadable research files", () => {
    const files = metaAdResearchDownloadFiles(
      [
        {
          id: META_RESEARCH_SECTION_IDS.instagramGoal,
          title: "Instagram ad goal",
          status: "done",
          markdown: buildInstagramGoalMarkdown(sampleGoal),
        },
      ],
      "digital-presence",
    );
    expect(files).toHaveLength(1);
    expect(files[0]?.name).toContain("digital-presence");
    expect(files[0]?.name.endsWith(".md")).toBe(true);
  });
});
