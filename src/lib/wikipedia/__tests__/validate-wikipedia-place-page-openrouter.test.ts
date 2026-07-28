import { describe, expect, it } from "vitest";
import {
  isAcceptedWikiPlaceValidation,
  type WikiPlaceValidation,
} from "@/lib/wikipedia/validate-wikipedia-place-page-openrouter";

describe("isAcceptedWikiPlaceValidation", () => {
  it("accepts neighbourhood in the expected city on neighbourhood tier", () => {
    const result: WikiPlaceValidation = {
      kind: "neighbourhood",
      matchesExpectedCity: true,
    };
    expect(isAcceptedWikiPlaceValidation(result, "neighbourhood")).toBe(true);
  });

  it("accepts district in the expected city on neighbourhood tier", () => {
    const result: WikiPlaceValidation = {
      kind: "district",
      matchesExpectedCity: true,
    };
    expect(isAcceptedWikiPlaceValidation(result, "neighbourhood")).toBe(true);
  });

  it("rejects disambiguation pages on neighbourhood tier", () => {
    const result: WikiPlaceValidation = {
      kind: "disambiguation",
      matchesExpectedCity: false,
    };
    expect(isAcceptedWikiPlaceValidation(result, "neighbourhood")).toBe(false);
  });

  it("rejects other/wrong-kind pages even if city somehow matches", () => {
    expect(
      isAcceptedWikiPlaceValidation(
        { kind: "other", matchesExpectedCity: true },
        "neighbourhood",
      ),
    ).toBe(false);
    expect(
      isAcceptedWikiPlaceValidation(
        { kind: "city", matchesExpectedCity: true },
        "neighbourhood",
      ),
    ).toBe(false);
  });

  it("rejects neighbourhood pages for the wrong city", () => {
    expect(
      isAcceptedWikiPlaceValidation(
        { kind: "neighbourhood", matchesExpectedCity: false },
        "neighbourhood",
      ),
    ).toBe(false);
  });

  it("city tier accepts only city kind with matching city", () => {
    expect(
      isAcceptedWikiPlaceValidation({ kind: "city", matchesExpectedCity: true }, "city"),
    ).toBe(true);
    expect(
      isAcceptedWikiPlaceValidation(
        { kind: "neighbourhood", matchesExpectedCity: true },
        "city",
      ),
    ).toBe(false);
    expect(
      isAcceptedWikiPlaceValidation({ kind: "city", matchesExpectedCity: false }, "city"),
    ).toBe(false);
  });

  it("rejects null or undefined validation", () => {
    expect(isAcceptedWikiPlaceValidation(null, "neighbourhood")).toBe(false);
    expect(isAcceptedWikiPlaceValidation(undefined, "city")).toBe(false);
  });
});
