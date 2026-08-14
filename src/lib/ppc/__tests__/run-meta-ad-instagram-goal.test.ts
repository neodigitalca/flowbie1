import { describe, expect, it } from "vitest";
import { parseMetaInstagramGoal } from "@/lib/ppc/meta-ad-prompt-builder";

describe("parseMetaInstagramGoal", () => {
  it("parses a complete goal payload", () => {
    const goal = parseMetaInstagramGoal({
      goalStatement: "Drive contact leads.",
      primaryTopic: "Neo Digital contact page",
      audience: "Local businesses",
      adAngle: "We help you get found",
      hook: "Ready for more leads?",
      visualDirection: "Clean branded graphic, no product UI",
      creativeMode: "agency_service",
      onImageTextHint: "Contact us today",
      referenceQueries: ["instagram ad agency minimal text"],
    });

    expect(goal.creativeMode).toBe("agency_service");
    expect(goal.referenceQueries).toHaveLength(1);
  });

  it("throws when goal is incomplete", () => {
    expect(() =>
      parseMetaInstagramGoal({
        goalStatement: "Incomplete",
      }),
    ).toThrow(/incomplete JSON/i);
  });
});
