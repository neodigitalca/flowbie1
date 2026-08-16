import { describe, expect, it } from "vitest";
import type { AgentConfig } from "@/types/agent-config";
import { prepareHarnessContentForUpload } from "../harness-upload-prep";

const BODY_AGENTS: AgentConfig[] = [
  {
    id: "section-1",
    title: "Sliding Glass Door Blinds: Your Options",
    description: "Options section",
    features: [],
  },
  {
    id: "section-2",
    title: "Exploring Styles for Sliding Doors",
    description: "Styles section",
    features: [],
  },
];

const OVERVIEW_AGENT: AgentConfig = {
  id: "ai-overview-summary",
  title: "Overview",
  description: "Overview",
  features: [],
};

function countBodyH2(html: string): number {
  return (html.match(/<h2[^>]+id="(?!overview)[^"]+"/gi) ?? []).length;
}

describe("prepareHarnessContentForUpload", () => {
  it("aligns Overview scroll links to injected body H2 ids without OpenRouter", async () => {
    const markdown = `## Overview

Lead paragraph about blinds for sliding glass doors.

- **Options:** Review several [[SCROLL:#sliding-glass-door-blinds-your-options|blind options]] for your home.
- **Styles:** Explore [[SCROLL:#exploring-styles-for-sliding-doors|popular styles]] in this guide.

## Sliding Glass Door Blinds: Your Options

Body content about vertical blinds and panel tracks.

## Exploring Styles for Sliding Doors

More body content about roller shades.
`;

    const html = await prepareHarnessContentForUpload({
      markdownContent: markdown,
      blueprintAgents: [OVERVIEW_AGENT, ...BODY_AGENTS],
      keyword: "sliding glass door blinds",
      articleTitle: "Sliding Glass Door Blinds Guide",
    });

    expect(html).toContain('href="#sliding-glass-door-blinds-your-options"');
    expect(html).toContain('href="#exploring-styles-for-sliding-doors"');
    expect(html).not.toContain("[[SCROLL:");
    expect(html).not.toContain("].");
    expect(countBodyH2(html)).toBe(2);
  });

  it("does not duplicate body sections (server-style overview without flo-overview wrapper)", async () => {
    const markdown = `## Overview

Lead about smart blinds.

- **What Are Smart Blinds?:** Learn [[SCROLL:#what-are-smart-blinds|smart blind basics]] in this guide.
- **Benefits:** Review [[SCROLL:#benefits-of-smart-blinds-for-your-home|key home benefits]] in this section.

## What Are Smart Blinds?

Body one paragraph.

## Benefits of Smart Blinds for Your Home

Body two paragraph.
`;

    const html = await prepareHarnessContentForUpload({
      markdownContent: markdown,
      blueprintAgents: [
        OVERVIEW_AGENT,
        { id: "section-1", title: "What Are Smart Blinds?", description: "", features: [] },
        {
          id: "section-2",
          title: "Benefits of Smart Blinds for Your Home",
          description: "",
          features: [],
        },
      ],
    });

    expect(html).toContain('href="#what-are-smart-blinds"');
    expect(html).toContain('href="#benefits-of-smart-blinds-for-your-home"');
    expect(countBodyH2(html)).toBe(2);
    expect(html.match(/Body one paragraph/g)?.length).toBe(1);
    expect(html.match(/Body two paragraph/g)?.length).toBe(1);
  });

  it("throws when Overview is missing scroll-link bullets", async () => {
    const markdown = `## Overview

Lead paragraph only.

## Sliding Glass Door Blinds: Your Options

Body section.
`;

    await expect(
      prepareHarnessContentForUpload({
        markdownContent: markdown,
        blueprintAgents: [OVERVIEW_AGENT, BODY_AGENTS[0]!],
      }),
    ).rejects.toThrow(/missing bullet|scroll link/i);
  });
});
