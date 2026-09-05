import { describe, expect, it } from "vitest";
import {
  importRowLinkEditorUrls,
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

describe("importRowLinkEditorUrls", () => {
  it("uses stored Links when present", () => {
    expect(
      importRowLinkEditorUrls({
        modifier_links_json: JSON.stringify(["https://example.com/stored"]),
        imported_markdown: "See [other](https://example.com/source).",
      }),
    ).toEqual(["https://example.com/stored"]);
  });

  it("parses hrefs from that piece when Links is empty", () => {
    expect(
      importRowLinkEditorUrls({
        imported_markdown:
          "Reach [HR Resource](https://hr-resource.ca/) or click [here](https://kwbllp.com/consultation/).",
      }),
    ).toEqual(["https://hr-resource.ca/", "https://kwbllp.com/consultation/"]);
  });

  it("keeps an empty slot when the piece has no hrefs", () => {
    expect(
      importRowLinkEditorUrls({
        imported_markdown: "| Value Driver | Why Buyers Care |\n| Profitability | Earnings |",
      }),
    ).toEqual([""]);
  });
});
