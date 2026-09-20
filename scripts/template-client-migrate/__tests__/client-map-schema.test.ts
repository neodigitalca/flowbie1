import { describe, expect, it } from "vitest";
import { isHex7, validateClientMap } from "../schema/client-map.mjs";
import { buildHexPairs, sortReplacePairs } from "../lib/apply-identity.mjs";

const valid = {
  company: "Designer's Resource Centre",
  description: "Blinds in Vancouver",
  phones: ["(800) 610-0331"],
  phoneLink: "tel:+18006100331",
  email: "info@drcentre.ca",
  address: "8449 Main St",
  hours: { monday: "10:00 am - 6:00 pm" },
  social: { instagram: "https://www.instagram.com/drcvancouver/" },
  colors: { primary: "#000000", secondary: "#5B6770", text: "#000000", accent: "#2C72DB" },
  team: [{ name: "Jindy Toor", role: "President" }],
  locations: [{ name: "Vancouver Showroom", address: "8449 Main St" }],
  products: [{ name: "Metal Blinds" }],
  searchReplace: [{ from: "Lindsey Blinds", to: "Designer's Resource Centre" }],
};

describe("validateClientMap", () => {
  it("accepts a full map and uppercases hex", () => {
    const map = validateClientMap(valid);
    expect(map.company).toBe("Designer's Resource Centre");
    expect(map.colors.accent).toBe("#2C72DB");
    expect(map.team[0].name).toBe("Jindy Toor");
  });

  it("fails when colors are missing", () => {
    expect(() => validateClientMap({ ...valid, colors: {} })).toThrow(/colors.primary/);
  });

  it("fails when company is empty", () => {
    expect(() => validateClientMap({ ...valid, company: "  " })).toThrow(/company/);
  });
});

describe("hex helpers", () => {
  it("accepts #RRGGBB", () => {
    expect(isHex7("#2C72DB")).toBe(true);
    expect(isHex7("#2C72D")).toBe(false);
  });

  it("builds same-length leftover to client hex pairs", () => {
    const pairs = buildHexPairs(
      { primary: "#4D2B82", accent: "#F68B21" },
      { primary: "#000000", secondary: "#5B6770", text: "#000000", accent: "#2C72DB" },
    );
    expect(pairs.some((p) => p.from === "#4D2B82" && p.to === "#000000")).toBe(true);
    expect(pairs.some((p) => p.from === "#F68B21" && p.to === "#2C72DB")).toBe(true);
  });

  it("sorts replace pairs longest first", () => {
    const sorted = sortReplacePairs([
      { from: "Lindsey", to: "DRC" },
      { from: "Lindsey Blinds", to: "DRC" },
    ]);
    expect(sorted[0].from).toBe("Lindsey Blinds");
  });
});
