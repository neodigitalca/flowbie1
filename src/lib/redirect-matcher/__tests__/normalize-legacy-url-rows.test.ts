import { describe, expect, it } from "vitest";
import { ensureAbsoluteLegacyUrl, normalizeLegacyUrlRows } from "@/lib/redirect-matcher/normalize-legacy-url-rows";

const site = {
  id: "site-1",
  name: "KWB",
  siteUrl: "https://www.kwbllp.com",
  username: "u",
  appPassword: "p",
} as const;

describe("ensureAbsoluteLegacyUrl", () => {
  it("prefixes date-archive path with site domain", () => {
    expect(ensureAbsoluteLegacyUrl("2026/03/10/tax-deductions/", site as any)).toBe(
      "https://www.kwbllp.com/2026/03/10/tax-deductions/",
    );
  });

  it("keeps absolute URL unchanged", () => {
    expect(
      ensureAbsoluteLegacyUrl("https://www.kwbllp.com/2017/06/13/gluten-free-food/", site as any),
    ).toBe("https://www.kwbllp.com/2017/06/13/gluten-free-food/");
  });
});

describe("normalizeLegacyUrlRows", () => {
  it("accepts relative date paths after domain prefix", () => {
    const result = normalizeLegacyUrlRows(
      [{ legacyUrl: "2020/05/04/cpp-death-benefit/", uploadRow: 1 }],
      site as any,
    );
    expect(result.error).toBeUndefined();
    expect(result.rows[0]?.legacyUrl).toBe("https://www.kwbllp.com/2020/05/04/cpp-death-benefit/");
  });
});
