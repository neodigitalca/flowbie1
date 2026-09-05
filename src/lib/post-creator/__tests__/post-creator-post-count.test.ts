import { describe, expect, it } from "vitest";
import type { AgentRun } from "@/lib/agent-runs-types";
import {
  clampPostCreatorPostCount,
  resolvePostCreatorPostCount,
} from "@/lib/post-creator/post-creator-post-count";

describe("resolvePostCreatorPostCount", () => {
  it("uses payload postCount", () => {
    expect(resolvePostCreatorPostCount({ postCount: 3 })).toBe(3);
  });

  it("uses run contract postCount when payload is empty", () => {
    const run = {
      plan: { clientRunContract: { postCount: 5 } },
    } as AgentRun;
    expect(resolvePostCreatorPostCount(null, run)).toBe(5);
  });

  it("does not infer postCount from task keyword", () => {
    const run = {
      context: { taskKeyword: "monthly-3-posts-run" },
    } as AgentRun;
    expect(() => resolvePostCreatorPostCount(null, run)).toThrow(/postCount is required/i);
  });

  it("throws when postCount is missing", () => {
    expect(() => resolvePostCreatorPostCount({})).toThrow(/postCount is required/i);
  });

  it("clamps to max", () => {
    expect(clampPostCreatorPostCount(99)).toBe(31);
  });
});
