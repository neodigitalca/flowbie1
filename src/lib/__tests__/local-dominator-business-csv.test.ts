import { describe, expect, it } from "vitest";
import { parseLocalDominatorCsv } from "@/lib/local-dominator-csv";

describe("parseLocalDominatorCsv business listing export", () => {
  it("reads Local Dominator business CSV with Average Rank when keyword is supplied", () => {
    const csv = [
      "Business Name,Address,Average Rank,Latitude,Longitude,Place ID",
      '"Advance Blinds","303A Main Ave",3.46,49.1904838,-97.7626737,ChIJabc',
      '"Budget Blinds","195 Mountain St",2.06,49.1873487,-98.1136833,ChIJdef',
    ].join("\n");

    const parsed = parseLocalDominatorCsv(csv, { defaultKeyword: "blinds near me" });
    expect(parsed.error).toBeUndefined();
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]?.keyword).toBe("blinds near me");
    expect(parsed.rows[0]?.rank).toBe(3.46);
    expect(parsed.rows[0]?.business).toBe("Advance Blinds");
  });
});
