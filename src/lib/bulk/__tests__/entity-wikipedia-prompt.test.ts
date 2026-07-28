import { describe, expect, it } from "vitest";
import {
  formatMandatoryEntityWikipediaForPrompt,
  injectEntityWikipediaIntoBlueprintAgents,
  injectEntityWikipediaIntoChecklist,
} from "@/lib/bulk/entity-wikipedia-prompt";

const WIKI = {
  entity: "Sherwood Park, AB",
  wikipediaUrl: "https://en.wikipedia.org/wiki/Sherwood_Park",
  wikipediaTitle: "Sherwood Park, Alberta",
};

describe("formatMandatoryEntityWikipediaForPrompt", () => {
  it("includes exact Wikipedia URL and entity", () => {
    const block = formatMandatoryEntityWikipediaForPrompt(WIKI);
    expect(block).toContain(WIKI.wikipediaUrl);
    expect(block).toContain(WIKI.entity);
    expect(block).toContain(WIKI.wikipediaTitle);
    expect(block).toContain("MANDATORY ENTITY WIKIPEDIA");
    expect(block).toContain("Overview");
  });

  it("returns empty when url or entity missing", () => {
    expect(formatMandatoryEntityWikipediaForPrompt({ entity: "", wikipediaUrl: WIKI.wikipediaUrl })).toBe("");
  });
});

describe("injectEntityWikipediaIntoChecklist", () => {
  it("prepends EXTERNAL_WIKI line with exact url and Overview", () => {
    const out = injectEntityWikipediaIntoChecklist(["1. Intro section"], WIKI);
    expect(out[0]).toContain("[EXTERNAL_WIKI]");
    expect(out[0]).toContain(WIKI.wikipediaUrl);
    expect(out[0]).toContain("Overview");
    expect(out[1]).toBe("1. Intro section");
  });

  it("does not duplicate when url already present", () => {
    const existing = [`[EXTERNAL_WIKI]: ${WIKI.wikipediaUrl}`];
    expect(injectEntityWikipediaIntoChecklist(existing, WIKI)).toEqual(existing);
  });
});

describe("injectEntityWikipediaIntoBlueprintAgents", () => {
  it("adds EXTERNAL_WIKI feature to intro agent", () => {
    const agents = [
      { step: 1, title: "Understanding Garbage Boxes", features: ["[LINK]: internal"] },
      { step: 2, title: "Benefits", features: [] },
    ];
    const out = injectEntityWikipediaIntoBlueprintAgents(agents, WIKI);
    expect(out[0]!.features!.some((f) => f.includes("[EXTERNAL_WIKI]"))).toBe(true);
    expect(out[0]!.features!.some((f) => f.includes(WIKI.wikipediaUrl))).toBe(true);
    expect(out[1]!.features).toEqual([]);
  });

  it("adds feature to We Care About agent", () => {
    const agents = [
      { step: 1, title: "Guide intro", features: [] },
      { step: 2, title: "We Care About Sherwood Park", features: [] },
    ];
    const out = injectEntityWikipediaIntoBlueprintAgents(agents, WIKI);
    expect(out[1]!.features!.some((f) => f.includes(WIKI.wikipediaUrl))).toBe(true);
  });
});
