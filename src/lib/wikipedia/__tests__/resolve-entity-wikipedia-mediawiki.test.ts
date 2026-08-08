import { describe, expect, it } from "vitest";
import { entityWikiLookupCandidates } from "@/lib/wikipedia/resolve-entity-wikipedia-mediawiki";

describe("entityWikiLookupCandidates", () => {
  it("walks comma entity from specific to city and province", () => {
    const c = entityWikiLookupCandidates("Saddleback, Edmonton, AB");
    expect(c[0]).toBe("Saddleback, Edmonton, AB");
    expect(c).toContain("Saddleback, Edmonton");
    expect(c).toContain("Edmonton");
    expect(c).toContain("Alberta");
  });

  it("peels leading words from space-separated entity", () => {
    const c = entityWikiLookupCandidates("Dental Cleaning Saddleback Edmonton AB");
    expect(c[0]).toBe("Dental Cleaning Saddleback Edmonton AB");
    expect(c).toContain("Edmonton AB");
    expect(c).toContain("Edmonton");
    expect(c).toContain("Alberta");
  });
});
