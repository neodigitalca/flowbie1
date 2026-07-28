import { describe, expect, it } from "vitest";
import {
  extractUrlsFromModifierText,
  injectModifierExternalLinksIntoChecklist,
  formatModifierExternalLinksForPrompt,
} from "@/lib/bulk/modifier-external-links";

describe("extractUrlsFromModifierText", () => {
  it("extracts bare https URLs from mixed modifier text", () => {
    const urls = extractUrlsFromModifierText(
      "focus on pricing https://example.com/page guide",
    );
    expect(urls).toEqual(["https://example.com/page"]);
  });

  it("extracts markdown link URLs", () => {
    const urls = extractUrlsFromModifierText("cite [Example](https://example.com/resource) here");
    expect(urls).toEqual(["https://example.com/resource"]);
  });

  it("dedupes duplicate URLs", () => {
    const urls = extractUrlsFromModifierText(
      "https://example.com/a and https://example.com/a again",
    );
    expect(urls).toEqual(["https://example.com/a"]);
  });

  it("returns empty for blank modifier", () => {
    expect(extractUrlsFromModifierText("")).toEqual([]);
    expect(extractUrlsFromModifierText(undefined)).toEqual([]);
  });
});

describe("injectModifierExternalLinksIntoChecklist", () => {
  it("forces full URL into checklist line", () => {
    const out = injectModifierExternalLinksIntoChecklist(["1. Intro section"], [
      { url: "https://www.example.com/resource", anchorText: "Example Resource" },
    ]);
    expect(out.some((line) => line.includes("https://www.example.com/resource"))).toBe(true);
    expect(out.some((line) => line.includes("[MODIFIER_EXTERNAL_LINK]"))).toBe(true);
    expect(out.some((line) => line.includes("[Example Resource](https://www.example.com/resource)"))).toBe(
      true,
    );
  });
});

describe("formatModifierExternalLinksForPrompt", () => {
  it("includes full URLs in prompt block", () => {
    const block = formatModifierExternalLinksForPrompt([
      { url: "https://example.com/full-path", anchorText: "Example" },
    ]);
    expect(block).toContain("https://example.com/full-path");
    expect(block).toContain("MODIFIER EXTERNAL LINKS");
  });
});
