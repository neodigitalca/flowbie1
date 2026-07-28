import { describe, expect, it } from "vitest";
import { pickFirstExternalOrganicUrl } from "../serp-first-external-url";

/** Minimal DataForSEO-style root ([extractDataForSeoSerpBrief](b:/USE THIS/Flowbie/src/lib/overview-seo-content-brief.ts)). */
function serpRootWithOrganics(urls: Array<{ url: string }>) {
  return {
    tasks: [
      {
        result: [
          {
            items: urls.map((o) => ({
              type: "organic",
              url: o.url,
              domain: (() => {
                try {
                  return new URL(o.url).hostname;
                } catch {
                  return "";
                }
              })(),
            })),
          },
        ],
      },
    ],
  };
}

describe("pickFirstExternalOrganicUrl", () => {
  it("returns first organic whose host differs from site", () => {
    const root = serpRootWithOrganics([
      { url: "https://mysite.com/post" },
      { url: "https://news.example.com/article" },
    ]);
    const u = pickFirstExternalOrganicUrl(root, "https://mysite.com");
    expect(u).toBe("https://news.example.com/article");
  });

  it("normalizes www and skips target site", () => {
    const root = serpRootWithOrganics([
      { url: "https://www.client.example/page" },
      { url: "https://authority.org/ref" },
    ]);
    const u = pickFirstExternalOrganicUrl(root, "https://client.example");
    expect(u).toBe("https://authority.org/ref");
  });

  it("returns null when only target domain appears", () => {
    const root = serpRootWithOrganics([{ url: "https://solo.com/only" }]);
    expect(pickFirstExternalOrganicUrl(root, "https://solo.com")).toBeNull();
  });
});
