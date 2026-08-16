import { describe, expect, it } from "vitest";
import {
  buildMetaSeoContextBlock,
  fetchMetaAdSeoContext,
} from "@/lib/ppc/fetch-meta-ad-seo-context";

describe("buildMetaSeoContextBlock", () => {
  it("formats SEO context for prompts", () => {
    const block = buildMetaSeoContextBlock({
      url: "https://neodigital.ca/blog/elementor-help/",
      title: "Elementor Help",
      bodyText: "We help Edmonton businesses with Elementor.",
      focusKeyword: "elementor help",
    });
    expect(block).toContain("DataForSEO on_page/content_parsing");
    expect(block).toContain("Elementor Help");
    expect(block).toContain("elementor help");
  });
});

describe("fetchMetaAdSeoContext", () => {
  it("throws for invalid URL", async () => {
    await expect(fetchMetaAdSeoContext("not-a-url")).rejects.toThrow(
      "Context URL must start with http:// or https://.",
    );
  });

  it("returns URL-only context when DataForSEO body is empty", async () => {
    const block = buildMetaSeoContextBlock({
      url: "https://neodigital.ca/neo-pulse",
      title: "NEO Pulse",
      bodyText: "",
      focusKeyword: "seo audit",
    });
    expect(block).toContain("https://neodigital.ca/neo-pulse");
    expect(block).toContain("NEO Pulse");
    expect(block).not.toContain("Page content (excerpt)");
  });
});
