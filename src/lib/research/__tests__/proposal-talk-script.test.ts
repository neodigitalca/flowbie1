import { describe, expect, it } from "vitest";
import {
  buildProposalTalkScriptUserMessage,
  PROPOSAL_TALK_SCRIPT_SYSTEM,
} from "@/lib/research/proposal-talk-script";

describe("proposal-talk-script", () => {
  it("buildProposalTalkScriptUserMessage includes metadata, grid, and proposal blocks", () => {
    const msg = buildProposalTalkScriptUserMessage({
      gridSummaryMarkdown: "## Grid\nRow A",
      combinedMarkdown: "# Competitor strategy\nX",
      meta: {
        siteLabel: "Acme",
        months: 3,
        entitySapRowCount: 12,
        contentBlogRowCount: 6,
        geoLabel: "Georgia, United States",
      },
    });
    expect(msg).toContain("METADATA_JSON:");
    expect(msg).toContain('"siteLabel":"Acme"');
    expect(msg).toContain('"entitySapRowCount":12');
    expect(msg).toContain("GRID_SUMMARY_MARKDOWN:");
    expect(msg).toContain("## Grid");
    expect(msg).toContain("COMBINED_PROPOSAL_MARKDOWN:");
    expect(msg).toContain("# Competitor strategy");
  });

  it("PROPOSAL_TALK_SCRIPT_SYSTEM forbids em dash and requires glossary and specialist role", () => {
    expect(PROPOSAL_TALK_SCRIPT_SYSTEM).toContain("U+2014");
    expect(PROPOSAL_TALK_SCRIPT_SYSTEM).toContain("Partner tips");
    expect(PROPOSAL_TALK_SCRIPT_SYSTEM).toContain("## Glossary");
    expect(PROPOSAL_TALK_SCRIPT_SYSTEM).toContain("# Client meeting script");
    expect(PROPOSAL_TALK_SCRIPT_SYSTEM).not.toMatch(/\u2014/);
  });
});
