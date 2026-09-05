import { describe, expect, it } from "vitest";
import {
  workflowCardDescriptionText,
  workflowCardTitleCase,
} from "@/components/manager/workflow/forge-workflow-styles";

describe("workflowCardTitleCase", () => {
  it("caps the first letter of each word and strips punctuation", () => {
    expect(workflowCardTitleCase("GSC monthly MoM report")).toBe("GSC Monthly MoM Report");
    expect(workflowCardTitleCase("blog content gap check.")).toBe("Blog Content Gap Check");
    expect(workflowCardTitleCase("Blog Content Gap Check.")).toBe("Blog Content Gap Check");
  });
});

describe("workflowCardDescriptionText", () => {
  it("joins blurb lines so the card can wrap them", () => {
    expect(
      workflowCardDescriptionText("Checks who needs posts.\nCreates posts when needed."),
    ).toBe("Checks who needs posts. Creates posts when needed.");
  });

  it("returns empty when description is missing", () => {
    expect(workflowCardDescriptionText(undefined)).toBe("");
    expect(workflowCardDescriptionText("")).toBe("");
  });
});
