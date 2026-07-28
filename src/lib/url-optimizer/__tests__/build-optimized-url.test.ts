import { describe, expect, it } from "vitest";
import {
  buildOptimizedUrl,
  deterministicKeywordFromRow,
  urlsDiffer,
} from "@/lib/url-optimizer/build-optimized-url";

describe("build-optimized-url", () => {
  const oldUrl =
    "https://www.kwbllp.com/2022/10/12/canadian-digital-adoption-program-advisor/";

  it("maps legacy date URLs to /blog/ short slug", () => {
    const out = buildOptimizedUrl(oldUrl, "cdap digital adoption", "CDAP Advisor Guide");
    expect(out).toBe("https://www.kwbllp.com/blog/cdap-digital-adoption/");
    expect(urlsDiffer(oldUrl, out!)).toBe(true);
  });

  it("keeps /blog/ path when slug already matches keyword", () => {
    const blogUrl = "https://www.kwbllp.com/blog/cloud-accounting/";
    const out = buildOptimizedUrl(blogUrl, "cloud accounting", "Cloud Accounting");
    expect(out).toBe("https://www.kwbllp.com/blog/cloud-accounting/");
    expect(urlsDiffer(blogUrl, out!)).toBe(false);
  });

  it("deterministicKeywordFromRow prefers focus keyword then title", () => {
    expect(
      deterministicKeywordFromRow({
        page: oldUrl,
        title: "Canadian Digital Adoption Program Advisor",
        meta: "",
        focusKeyword: "cdap advisor",
      }),
    ).toBe("cdap advisor");

    expect(
      deterministicKeywordFromRow({
        page: oldUrl,
        title: "Canadian Digital Adoption Program Advisor",
        meta: "",
      }),
    ).toBe("Canadian Digital Adoption Program");
  });
});
