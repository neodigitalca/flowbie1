import { describe, expect, it } from "vitest";
import {
  inferServiceCountry,
  normalizeServiceRegion,
  regionBelongsToCountry,
  SERVICE_COUNTRIES,
} from "../keyword-location-utils";

describe("us-canada service regions", () => {
  it("lists only Canada and the United States", () => {
    expect([...SERVICE_COUNTRIES]).toEqual(["Canada", "United States"]);
  });

  it("infers country from province and state names or codes", () => {
    expect(inferServiceCountry("AB")).toBe("Canada");
    expect(inferServiceCountry("Manitoba")).toBe("Canada");
    expect(inferServiceCountry("TX")).toBe("United States");
    expect(inferServiceCountry("california")).toBe("United States");
    expect(inferServiceCountry("")).toBe("");
  });

  it("prefers a stored country over inference", () => {
    expect(inferServiceCountry("TX", "Canada")).toBe("Canada");
  });

  it("normalizes abbreviations to list labels", () => {
    expect(normalizeServiceRegion("AB", "Canada")).toBe("Alberta");
    expect(normalizeServiceRegion("tx", "United States")).toBe("Texas");
    expect(normalizeServiceRegion("Ontario", "Canada")).toBe("Ontario");
  });

  it("knows whether a region belongs to the chosen country", () => {
    expect(regionBelongsToCountry("Alberta", "Canada")).toBe(true);
    expect(regionBelongsToCountry("AB", "Canada")).toBe(true);
    expect(regionBelongsToCountry("Texas", "Canada")).toBe(false);
    expect(regionBelongsToCountry("Texas", "United States")).toBe(true);
  });
});
