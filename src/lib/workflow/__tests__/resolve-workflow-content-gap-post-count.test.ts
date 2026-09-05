import { describe, expect, it } from "vitest";
import {
  applyContentGapPostCountToPostCreatorPayload,
  parseGapCountFromContentGapText,
  resolveUpstreamContentGapPostCount,
} from "@/lib/workflow/resolve-workflow-content-gap-post-count";
import type { WorkflowDefinition } from "@/lib/workflow/workflow-types";

const gapPreview = [
  "Content: Posts",
  "Measure: posts scheduled or posted in August 2026",
  "Scheduled in month: 0",
  "Posted in month: 0",
  "Current: 0",
  "Target: 3",
  "Gap: 3",
  "Create 3 post(s) to reach the target.",
].join("\n");

describe("parseGapCountFromContentGapText", () => {
  it("reads Gap line from content gap context", () => {
    expect(parseGapCountFromContentGapText(gapPreview)).toBe(3);
  });

  it("reads Create N post(s) fallback", () => {
    expect(parseGapCountFromContentGapText("Create 2 post(s) to reach the target.")).toBe(2);
  });
});

describe("resolveUpstreamContentGapPostCount", () => {
  const workflow: WorkflowDefinition = {
    id: 1,
    teamId: 1,
    name: "Editorial gap",
    status: "published",
    wordpressSiteId: null,
    nodes: [
      {
        id: "gap-1",
        kind: "action_agent",
        label: "Content gap check",
        config: { executionKind: "content_gap_check", ragVariableKey: "step_gap" },
        position: { x: 0, y: 0 },
      },
      {
        id: "post-1",
        kind: "action_agent",
        label: "Create posts",
        config: { executionKind: "post_creator", executionPayload: { postCount: 1 } },
        position: { x: 0, y: 140 },
      },
    ],
    edges: [{ id: "e1", source: "gap-1", target: "post-1" }],
    ragVariables: [],
  };

  it("uses upstream content gap output for post creator", () => {
    const count = resolveUpstreamContentGapPostCount(
      workflow,
      "post-1",
      [
        {
          id: 1,
          runId: 1,
          nodeId: "gap-1",
          variableKey: "step_gap",
          scope: "run",
          label: "Content gap check",
          textPreview: gapPreview,
          fileRefs: [],
          agentRunId: 668,
          siteId: "site-a",
          createdAt: "2026-08-20T00:00:00.000Z",
        },
      ],
      "site-a",
      ["site-a"],
    );
    expect(count).toBe(3);
  });

  it("overrides post creator payload postCount from gap", () => {
    const payload = applyContentGapPostCountToPostCreatorPayload(
      { postCount: 1, scheduleTimesPerMonth: 1 },
      workflow,
      "post-1",
      [
        {
          id: 1,
          runId: 1,
          nodeId: "gap-1",
          variableKey: "step_gap",
          scope: "run",
          label: "Content gap check",
          textPreview: gapPreview,
          fileRefs: [],
          createdAt: "2026-08-20T00:00:00.000Z",
        },
      ],
      "site-a",
      ["site-a"],
    );
    expect(payload.postCount).toBe(3);
    expect(payload.scheduleTimesPerMonth).toBe(3);
    expect(payload.keywordSource).toBe("gsc");
  });
});
