import { describe, expect, it, vi, beforeEach } from "vitest";
import type { AgentConfig } from "@/types/agent-config";
import { prepareHarnessContentForUpload } from "../harness-upload-prep";

vi.mock("@/lib/competitor-research/competitor-report-openrouter", () => ({
  callOpenRouterChatCompletion: vi.fn(),
}));

import { callOpenRouterChatCompletion } from "@/lib/competitor-research/competitor-report-openrouter";

beforeEach(() => {
  vi.mocked(callOpenRouterChatCompletion).mockReset();
});

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

function mockScrollLinkBullets() {
  vi.mocked(callOpenRouterChatCompletion).mockResolvedValueOnce({
    content: JSON.stringify({
      bullets: [
        {
          anchorId: "sliding-glass-door-blinds-your-options",
          bulletLabel: "Options",
          sentenceHtml:
            'Review several <a href="#sliding-glass-door-blinds-your-options">blind options</a> for sliding doors.',
        },
        {
          anchorId: "exploring-styles-for-sliding-doors",
          bulletLabel: "Styles",
          sentenceHtml:
            'Explore <a href="#exploring-styles-for-sliding-doors">popular styles</a> in this guide.',
        },
      ],
    }),
  });
}

describe("prepareHarnessContentForUpload", () => {
  it("expands Overview scroll links and strips orphan ]. artifacts", async () => {
    mockScrollLinkBullets();

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
      apiKey: "test-key",
      keyword: "sliding glass door blinds",
      articleTitle: "Sliding Glass Door Blinds Guide",
    });

    expect(html).toContain('href="#sliding-glass-door-blinds-your-options"');
    expect(html).toContain('href="#exploring-styles-for-sliding-doors"');
    expect(html).not.toContain("[[SCROLL:");
    expect(html).not.toContain("].");
    expect(html).not.toContain("Families can review");
    expect(html).not.toContain("This guide walks through");
    expect(callOpenRouterChatCompletion).toHaveBeenCalledTimes(1);
  });

  it("repairs broken bracket fragments in Overview bullets via AI rebuild", async () => {
    vi.mocked(callOpenRouterChatCompletion).mockResolvedValueOnce({
      content: JSON.stringify({
        bullets: [
          {
            anchorId: "sliding-glass-door-blinds-your-options",
            bulletLabel: "Options",
            sentenceHtml:
              'Review <a href="#sliding-glass-door-blinds-your-options">blind options</a> for your doors.',
          },
        ],
      }),
    });

    const markdown = `## Overview

<p>Intro text.</p>

<ul>
<li><strong>Options</strong>: Review several ].</li>
</ul>

## Sliding Glass Door Blinds: Your Options

Body section.
`;

    const html = await prepareHarnessContentForUpload({
      markdownContent: markdown,
      blueprintAgents: [OVERVIEW_AGENT, BODY_AGENTS[0]!],
      apiKey: "test-key",
      keyword: "sliding glass door blinds",
      articleTitle: "Sliding Glass Door Blinds Guide",
    });

    expect(html).not.toContain("].");
    expect(html).toContain('href="#sliding-glass-door-blinds-your-options"');
  });

  it("throws when Overview exists but apiKey is missing", async () => {
    const markdown = `## Overview

Lead paragraph.

## Sliding Glass Door Blinds: Your Options

Body section.
`;

    await expect(
      prepareHarnessContentForUpload({
        markdownContent: markdown,
        blueprintAgents: [OVERVIEW_AGENT, BODY_AGENTS[0]!],
      }),
    ).rejects.toThrow(/OpenRouter API key/);
  });
});
