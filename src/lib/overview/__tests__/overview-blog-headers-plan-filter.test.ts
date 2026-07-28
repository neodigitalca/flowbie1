import { describe, expect, it } from "vitest";
import { filterNoOpBlogHeadersPlan } from "@/lib/overview/overview-blog-headers-plan-filter";

describe("filterNoOpBlogHeadersPlan", () => {
  const existing = [
    "Why the CRA May Contact You in 2026",
    "Digital Mail Is Now the Default",
  ];

  it("drops optimize actions where NEW equals WAS", () => {
    const filtered = filterNoOpBlogHeadersPlan(
      {
        h2Actions: [
          { action: "optimize", index: 0, proposedText: "Why the CRA May Contact You in 2026", rationale: "" },
          {
            action: "optimize",
            index: 1,
            proposedText: "CRA Digital Mail Default in 2026",
            rationale: "",
          },
        ],
      },
      existing,
    );
    expect(filtered.h2Actions).toHaveLength(1);
    expect(filtered.h2Actions[0]?.index).toBe(1);
    expect(filtered.h2Actions[0]?.proposedText).toBe("CRA Digital Mail Default in 2026");
  });
});
