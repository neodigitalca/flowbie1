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

describe("prepareHarnessContentForUpload", () => {
  it("expands Overview scroll links and strips orphan ]. artifacts", async () => {
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
    });

    expect(html).toContain('href="#sliding-glass-door-blinds-your-options"');
    expect(html).toContain('href="#exploring-styles-for-sliding-doors"');
    expect(html).not.toContain("[[SCROLL:");
    expect(html).not.toContain("].");
  });

  it("repairs broken bracket fragments in Overview bullets", async () => {
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
    });

    expect(html).not.toContain("].");
  });
});
