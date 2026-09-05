import { describe, expect, it } from "vitest";
import {
  formatEntityReferencePromptBlock,
  parseEntityPlaceParts,
  resolveServiceTopicKeyword,
} from "@/lib/entity-place-reference";

describe("parseEntityPlaceParts", () => {
  it("splits neighborhood, city, and province from comma entity", () => {
    const parts = parseEntityPlaceParts("Lacombe Park, St. Albert, AB");
    expect(parts.canonical).toBe("Lacombe Park, St. Albert, AB");
    expect(parts.neighborhood).toBe("Lacombe Park");
    expect(parts.city).toBe("St. Albert");
    expect(parts.province).toBe("AB");
    expect(parts.proseLabel).toBe("Lacombe Park, St. Albert");
  });
});

describe("resolveServiceTopicKeyword", () => {
  it("strips place tokens from geo-stuffed focus keyword", () => {
    expect(
      resolveServiceTopicKeyword(
        "blinds lacombe park st albert",
        "Lacombe Park, St. Albert, AB",
      ),
    ).toBe("blinds");
  });
});

describe("formatEntityReferencePromptBlock", () => {
  it("mandates comma grammar and forbids slug stacks", () => {
    const block = formatEntityReferencePromptBlock({
      entity: "Lacombe Park, St. Albert, AB",
      keyword: "blinds lacombe park st albert",
    });
    expect(block).toContain("Canonical entity: Lacombe Park, St. Albert, AB");
    expect(block).toContain("City: St. Albert");
    expect(block).toContain("homeowners in Lacombe Park, St. Albert");
    expect(block).toContain("Service topic (prose): blinds");
    expect(block).toContain("(no comma between place segments)");
  });
});
