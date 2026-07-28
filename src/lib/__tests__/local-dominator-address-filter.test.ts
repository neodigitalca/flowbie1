import { describe, it, expect } from "vitest";
import { stripLdCsvAddressPhoneSuffix } from "../local-dominator-address-filter";

describe("stripLdCsvAddressPhoneSuffix", () => {
  it("removes middle-dot phone suffix from Local Dominator Address cell", () => {
    expect(
      stripLdCsvAddressPhoneSuffix("23415 N Scottsdale Rd Ste G104 · (602) 820-2145")
    ).toBe("23415 N Scottsdale Rd Ste G104");
  });
});
