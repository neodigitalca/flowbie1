import { describe, expect, it } from "vitest";
import {
  modifierLinksFromJson,
  parseModifierLinksJson,
  serializeModifierLinksJson,
} from "@/lib/bulk/bulk-csv-parser";

describe("parseModifierLinksJson", () => {
  it("parses url objects", () => {
    const out = parseModifierLinksJson('[{"url":"https://example.com/a"}]');
    expect(out).toEqual([{ url: "https://example.com/a" }]);
  });

  it("parses string entries", () => {
    const out = parseModifierLinksJson('["https://example.com/b"]');
    expect(out).toEqual([{ url: "https://example.com/b" }]);
  });

  it("filters invalid URLs and dedupes", () => {
    const out = parseModifierLinksJson(
      '[{"url":"not-a-url"},{"url":"https://example.com/a"},{"url":"https://example.com/a"}]',
    );
    expect(out).toEqual([{ url: "https://example.com/a" }]);
  });

  it("returns null for empty input", () => {
    expect(parseModifierLinksJson("")).toBeNull();
    expect(parseModifierLinksJson(undefined)).toBeNull();
  });
});

describe("serializeModifierLinksJson", () => {
  it("round-trips valid URLs", () => {
    const json = serializeModifierLinksJson([
      "https://example.com/a",
      "",
      "https://example.com/b",
    ]);
    expect(parseModifierLinksJson(json)).toEqual([
      { url: "https://example.com/a" },
      { url: "https://example.com/b" },
    ]);
    expect(modifierLinksFromJson(json)).toEqual([
      "https://example.com/a",
      "",
      "https://example.com/b",
    ]);
  });

  it("preserves empty draft row after a valid URL", () => {
    const json = serializeModifierLinksJson(["https://example.com/a", ""]);
    expect(modifierLinksFromJson(json)).toEqual(["https://example.com/a", ""]);
  });

  it("returns undefined when only a single empty row", () => {
    expect(serializeModifierLinksJson([""])).toBeUndefined();
  });
});

describe("modifierLinksFromJson", () => {
  it("returns one empty row when json is missing", () => {
    expect(modifierLinksFromJson(undefined)).toEqual([""]);
  });
});
