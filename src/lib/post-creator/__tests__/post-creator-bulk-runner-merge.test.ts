import { describe, expect, it } from "vitest";
import { postCreatorBlueprintMergeFields } from "@/lib/post-creator/post-creator-bulk-runner";

describe("postCreatorBlueprintMergeFields", () => {
  it("returns null merge fields when keyword phase was skipped", () => {
    expect(postCreatorBlueprintMergeFields(null)).toEqual({
      primaryExternalCitationUrl: null,
      intelligentMerge: null,
    });
    expect(postCreatorBlueprintMergeFields(undefined)).toEqual({
      primaryExternalCitationUrl: null,
      intelligentMerge: null,
    });
  });

  it("passes merge outputs through to blueprint generation", () => {
    const merge = {
      primaryIntent: "commercial",
      recommendedExternalUrl: "https://example.com/page",
      rationale: "best match",
    };
    expect(
      postCreatorBlueprintMergeFields({
        merge,
        primaryExternalCitationUrl: "https://example.com/page",
      }),
    ).toEqual({
      primaryExternalCitationUrl: "https://example.com/page",
      intelligentMerge: merge,
    });
  });
});
