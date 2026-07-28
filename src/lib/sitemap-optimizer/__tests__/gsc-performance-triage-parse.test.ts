import { describe, expect, it } from "vitest";
import { parseGscPerformanceTriageJson } from "@/lib/sitemap-optimizer/gsc-performance-triage-parse";

describe("gsc-performance-triage-parse", () => {
  const allowed = ["wp:1", "wp:2"];

  it("parses decisions array with disposition aliases", () => {
    const raw = JSON.stringify({
      decisions: [
        { postId: "wp:1", disposition: "keep", rationale: "Strong CTR", confidence: "high" },
        { postId: "wp:2", action: "consolidate", reason: "Thin duplicate", confidence: "medium" },
      ],
    });
    const parsed = parseGscPerformanceTriageJson(raw, allowed);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]?.disposition).toBe("keep");
    expect(parsed[1]?.disposition).toBe("consolidate");
    expect(parsed[1]?.rationale).toBe("Thin duplicate");
  });

  it("unwraps nested triage root keys", () => {
    const raw = JSON.stringify({
      result: {
        rows: [{ id: "wp:1", verdict: "preserve", rationale: "Leader", confidence: "low" }],
      },
    });
    const parsed = parseGscPerformanceTriageJson(raw, ["wp:1"]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.disposition).toBe("keep");
  });

  it("ignores unknown postIds and duplicates", () => {
    const raw = JSON.stringify({
      decisions: [
        { postId: "wp:1", disposition: "keep", rationale: "ok" },
        { postId: "wp:1", disposition: "consolidate", rationale: "dup" },
        { postId: "wp:99", disposition: "keep", rationale: "unknown" },
      ],
    });
    const parsed = parseGscPerformanceTriageJson(raw, allowed);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.postId).toBe("wp:1");
  });
});
