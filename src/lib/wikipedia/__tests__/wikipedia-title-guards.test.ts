import { describe, expect, it } from "vitest";
import { filterNonCommunityWikipediaTitles } from "@/lib/wikipedia/wikipedia-title-guards";

describe("filterNonCommunityWikipediaTitles", () => {
  it("drops archaeology / MPS-style titles", () => {
    const out = filterNonCommunityWikipediaTitles([
      "Hopewell tradition",
      "American Indian Rock Art in Minnesota MPS",
      "Neighbourhood, Edmonton",
    ]);
    expect(out).toEqual(["Neighbourhood, Edmonton"]);
  });

  it("keeps a normal neighbourhood-style title", () => {
    expect(filterNonCommunityWikipediaTitles(["Aster, Edmonton"])).toEqual(["Aster, Edmonton"]);
  });

  it("drops NRHP-style … Site and prehistoric Armstrong culture", () => {
    expect(
      filterNonCommunityWikipediaTitles(["Big Eddy Site", "Armstrong culture", "Kennesaw, Georgia"])
    ).toEqual(["Kennesaw, Georgia"]);
  });

  it("keeps two-word modern sociology culture titles when allowlisted", () => {
    expect(filterNonCommunityWikipediaTitles(["Youth culture", "Office culture"])).toEqual([
      "Youth culture",
      "Office culture",
    ]);
  });

  it("drops US state / province umbrella titles", () => {
    expect(filterNonCommunityWikipediaTitles(["Georgia", "Kennesaw, Georgia"])).toEqual(["Kennesaw, Georgia"]);
    expect(filterNonCommunityWikipediaTitles(["Ontario", "Neighbourhood, Toronto"])).toEqual([
      "Neighbourhood, Toronto",
    ]);
  });

  it("keeps Washington, D.C. and Georgia (country)", () => {
    expect(filterNonCommunityWikipediaTitles(["Washington, D.C.", "Georgia (country)", "Georgia"])).toEqual([
      "Washington, D.C.",
      "Georgia (country)",
    ]);
  });
});
