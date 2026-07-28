import { describe, expect, it } from "vitest";
import { workspaceDetailsCanOpen } from "@/lib/workspace/workspace-details-can-open";

describe("workspaceDetailsCanOpen", () => {
  it("returns false when all flags are false", () => {
    expect(workspaceDetailsCanOpen(false, false)).toBe(false);
  });

  it("returns true when any flag is true", () => {
    expect(workspaceDetailsCanOpen(false, true, false)).toBe(true);
  });
});
