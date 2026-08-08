import { describe, expect, it } from "vitest";
import { buildImagePrompt } from "@/lib/image-prompt-builder";
import { buildSoloImagePrompt } from "@/lib/image-generator/image-generator-options";

const baseImageOptions = {
  includeText: false,
  includePeople: false,
  includeAnimals: false,
  includeCars: false,
  isInfographic: false,
  aspectRatio: "1:1" as const,
  style: "professional" as const,
  colorScheme: "vibrant" as const,
};

describe("relaxSafetyConstraints", () => {
  it("buildImagePrompt omits people/text bans when relaxSafetyConstraints is true", () => {
    const prompt = buildImagePrompt(
      { flowTitle: "Subject", flowPurpose: "Art" },
      {
        ...baseImageOptions,
        userPrompt: "explicit mature portrait",
        relaxSafetyConstraints: true,
      },
    );
    expect(prompt).not.toContain("Do NOT include people or animals");
    expect(prompt.toLowerCase()).not.toContain("absolutely no text");
  });

  it("buildSoloImagePrompt omits people/text bans when relaxSafetyConstraints is true", () => {
    const prompt = buildSoloImagePrompt(
      "mature portrait",
      {
        ...baseImageOptions,
        colorForeground: "",
        colorBackground: "",
      },
      false,
      true,
    );
    expect(prompt).not.toContain("Do not include people or animals");
    expect(prompt.toLowerCase()).not.toContain("absolutely no text");
  });
});
