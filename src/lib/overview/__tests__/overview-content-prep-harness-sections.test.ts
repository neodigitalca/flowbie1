import { describe, expect, it } from "vitest";
import { buildEntityClusterLiveHarnessSections } from "@/lib/overview/overview-content-prep-harness-sections";

describe("buildEntityClusterLiveHarnessSections", () => {
  it("marks keywords section generating during keyword hydrate", () => {
    const sections = buildEntityClusterLiveHarnessSections("Assigning unique keywords from GSC");
    expect(sections).toHaveLength(3);
    expect(sections[0]?.status).toBe("generating");
    expect(sections[1]?.status).toBe("waiting");
  });

  it("marks titles section generating during title hydrate", () => {
    const sections = buildEntityClusterLiveHarnessSections("Writing titles");
    expect(sections[0]?.status).toBe("done");
    expect(sections[1]?.status).toBe("generating");
  });
});
