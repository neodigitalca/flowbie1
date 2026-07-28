import { describe, expect, it } from "vitest";
import { syncPromptBlogRowsToCount } from "@/lib/bulk/prompt-blog-slots";
import { allocatePagesAcrossNeighbourhoodPicks } from "@/lib/local-analysis/entity-grid-location-wiki-agent";
import {
  assignUniqueEntitiesToSlots,
  fillBlankEntitySlotEntities,
  fillBlankEntitySlotKeywords,
  isBadPreloadEntityLabel,
  pickUniqueSuggestedKeywords,
} from "@/lib/local-analysis/entity-preload-suggested-keywords";

describe("entity-preload-suggested-keywords", () => {
  it("pickUniqueSuggestedKeywords returns unique list and respects alreadyUsed", () => {
    const out = pickUniqueSuggestedKeywords(
      ["blinds edmonton", "roman shades", "Blinds Edmonton", "solar shades", "roman shades"],
      3,
      ["roman shades"],
    );
    expect(out).toEqual(["blinds edmonton", "solar shades"]);
  });

  it("pickUniqueSuggestedKeywords returns empty when candidates empty", () => {
    expect(pickUniqueSuggestedKeywords([], 5, [])).toEqual([]);
  });

  it("fillBlankEntitySlotKeywords fills blanks and preserves edits", () => {
    const rows = fillBlankEntitySlotKeywords(
      [
        { keyword: "kept by user", title: "" },
        { keyword: "", title: "" },
        { keyword: "  ", title: "" },
        { keyword: "", title: "t" },
      ],
      ["a", "b", "c"],
    );
    expect(rows.map((r) => r.keyword)).toEqual(["kept by user", "a", "b", "c"]);
    expect(rows[3].title).toBe("t");
  });

  it("isBadPreloadEntityLabel rejects street addresses", () => {
    expect(
      isBadPreloadEntityLabel("10615 170 St NW, Edmonton, Alberta T5P 4W2, CA"),
    ).toBe(true);
    expect(isBadPreloadEntityLabel("Edmonton, AB")).toBe(false);
    expect(isBadPreloadEntityLabel("Mill Woods, Edmonton, AB")).toBe(false);
  });

  it("fillBlankEntitySlotEntities replaces street address with city place", () => {
    const rows = fillBlankEntitySlotEntities(
      [
        { keyword: "a", title: "", entity: "Westmount, Edmonton" },
        {
          keyword: "b",
          title: "",
          entity: "10615 170 St NW, Edmonton, Alberta T5P 4W2, CA",
        },
        { keyword: "c", title: "" },
      ],
      "Edmonton, AB",
    );
    expect(rows.map((r) => r.entity)).toEqual([
      "Westmount, Edmonton",
      "Edmonton, AB",
      "Edmonton, AB",
    ]);
  });

  it("assignUniqueEntitiesToSlots fills bad/blank only", () => {
    const rows = assignUniqueEntitiesToSlots(
      [
        { keyword: "a", title: "", entity: "Oliver, Edmonton, AB" },
        { keyword: "b", title: "" },
        { keyword: "c", title: "", entity: "123 Main St, Edmonton, AB" },
      ],
      ["Mill Woods, Edmonton, AB", "Westmount, Edmonton, AB"],
    );
    expect(rows.map((r) => r.entity)).toEqual([
      "Oliver, Edmonton, AB",
      "Mill Woods, Edmonton, AB",
      "Westmount, Edmonton, AB",
    ]);
  });

  it("allocatePagesAcrossNeighbourhoodPicks gives multi-page AdGroups from POS weights", () => {
    const alloc = allocatePagesAcrossNeighbourhoodPicks(
      [
        { name: "Mill Woods, Edmonton, AB", posWeight: 30 },
        { name: "Oliver, Edmonton, AB", posWeight: 10 },
        { name: "Westmount, Edmonton, AB", posWeight: 5 },
        { name: "Canora, Edmonton, AB", posWeight: 5 },
        { name: "Namao, Edmonton, AB", posWeight: 5 },
        { name: "Erin Ridge, St. Albert, AB", posWeight: 5 },
        { name: "Meadowlark Park, Edmonton, AB", posWeight: 5 },
      ],
      7,
    );
    expect(alloc.length).toBeLessThanOrEqual(2);
    expect(alloc.reduce((s, a) => s + a.pages, 0)).toBe(7);
    expect(alloc.every((a) => a.pages >= 1)).toBe(true);
    expect(Math.max(...alloc.map((a) => a.pages))).toBeGreaterThan(1);
  });

  it("syncing amount 3→5 pads; 5→2 trims; keywords preserved on surviving indices", () => {
    const at3 = syncPromptBlogRowsToCount(
      [
        { keyword: "one", title: "" },
        { keyword: "two", title: "" },
        { keyword: "three", title: "" },
      ],
      3,
    );
    const at5 = syncPromptBlogRowsToCount(at3, 5);
    expect(at5).toHaveLength(5);
    expect(at5[0].keyword).toBe("one");
    expect(at5[1].keyword).toBe("two");
    expect(at5[2].keyword).toBe("three");
    expect(at5[3].keyword).toBe("");
    expect(at5[4].keyword).toBe("");

    const at2 = syncPromptBlogRowsToCount(at5, 2);
    expect(at2).toHaveLength(2);
    expect(at2[0].keyword).toBe("one");
    expect(at2[1].keyword).toBe("two");
  });
});
