import { describe, it, expect, vi, beforeEach } from "vitest";
import type { WordPressSite } from "@/components/integrations/types";
import { pickListingForSiteHostname, pickListingForSiteHostnameStrict, type BusinessListingItem } from "@/lib/citation-research/dfs-business-listings-client";
import { extractCitationRecordWithOpenRouter } from "@/lib/citation-research/citation-extract-openrouter";

vi.mock("@/lib/competitor-research/competitor-report-openrouter", () => ({
  callOpenRouterChatCompletion: vi.fn(),
}));

import { callOpenRouterChatCompletion } from "@/lib/competitor-research/competitor-report-openrouter";

describe("pickListingForSiteHostname", () => {
  it("matches exact hostname", () => {
    const items: BusinessListingItem[] = [
      { title: "Other", url: "https://other.com" },
      { title: "Target", url: "https://www.example.com/path" },
    ];
    const got = pickListingForSiteHostname(items, "https://example.com/");
    expect(got?.title).toBe("Target");
  });

  it("falls back to first item when no domain match", () => {
    const items: BusinessListingItem[] = [{ title: "Only", url: "https://foo.test" }];
    const got = pickListingForSiteHostname(items, "https://nomatch.com");
    expect(got?.title).toBe("Only");
  });
});

describe("pickListingForSiteHostnameStrict", () => {
  it("returns null when no domain match", () => {
    const items: BusinessListingItem[] = [{ title: "Only", url: "https://foo.test" }];
    expect(pickListingForSiteHostnameStrict(items, "https://nomatch.com")).toBeNull();
  });

  it("matches exact hostname like non-strict", () => {
    const items: BusinessListingItem[] = [
      { title: "Other", url: "https://other.com" },
      { title: "Target", url: "https://www.example.com/path" },
    ];
    const got = pickListingForSiteHostnameStrict(items, "https://example.com/");
    expect(got?.title).toBe("Target");
  });

  it("matches website from contact_info when top-level url missing", () => {
    const items: BusinessListingItem[] = [
      {
        title: "Acme",
        contact_info: [{ type: "website", value: "https://www.example.com" }],
      },
    ];
    const got = pickListingForSiteHostnameStrict(items, "https://example.com/");
    expect(got?.title).toBe("Acme");
  });
});

const minimalSite = (over: Partial<WordPressSite> = {}): WordPressSite => ({
  id: "1",
  name: "Site",
  siteUrl: "https://example.com",
  username: "u",
  appPassword: "p",
  connectedAt: 0,
  ...over,
});

describe("extractCitationRecordWithOpenRouter", () => {
  beforeEach(() => {
    vi.mocked(callOpenRouterChatCompletion).mockReset();
  });

  it("parses model JSON into CitationRecord", async () => {
    vi.mocked(callOpenRouterChatCompletion).mockResolvedValue({
      raw: {},
      content: JSON.stringify({
        businessName: "Acme",
        address: "1 Main",
        phone: "555",
        websiteUrl: "https://example.com",
        gmbUrl: "",
        description: "Test desc.",
        keywords: "a, b",
        logoWide: "",
        logoSquare: "",
        instagramUrl: "",
        linkedinUrl: "",
        facebookUrl: "",
        discoveredUrls: "",
        hourMonday: "9–5",
        hourTuesday: "",
        hourWednesday: "",
        hourThursday: "",
        hourFriday: "",
        hourSaturday: "",
        hourSunday: "",
      }),
    });

    const rec = await extractCitationRecordWithOpenRouter({
      apiKey: "k",
      model: "openai/gpt-4o-mini",
      site: minimalSite(),
      businessListingsSearchResponse: {},
      googleBusinessInfoLiveResponse: null,
      pickedBusinessListingRow: null,
      serpOrganicUrls: [],
      serpSocialFromDfs: { linkedinUrl: "", instagramUrl: "", facebookUrl: "" },
    });

    expect(rec.businessName).toBe("Acme");
    expect(rec.phone).toBe("555");
    expect(rec.description).toBe("Test desc.");
  });
});
