import { describe, it, expect } from "vitest";
import {
  applySerpSocialOverridesFromDfs,
  citationPartialFromGoogleBusinessItem,
  mergeCitationRecordWithDfsPartials,
} from "@/lib/citation-research/citation-merge-from-dfs";
import type { CitationRecord } from "@/lib/citation-research/citation-from-gmb-item";

const emptyRec = (): CitationRecord => ({
  businessName: "",
  address: "",
  phone: "",
  websiteUrl: "",
  gmbUrl: "",
  description: "",
  keywords: "",
  logoWide: "",
  logoSquare: "",
  instagramUrl: "",
  linkedinUrl: "",
  facebookUrl: "",
  discoveredUrls: "",
  hourMonday: "",
  hourTuesday: "",
  hourWednesday: "",
  hourThursday: "",
  hourFriday: "",
  hourSaturday: "",
  hourSunday: "",
});

describe("citation-merge-from-dfs", () => {
  it("fills NAP and gmbUrl from google_business_info-shaped item", () => {
    const partial = citationPartialFromGoogleBusinessItem({
      type: "google_business_info",
      title: "In The Shade",
      address: "123 Main St, Tampa, FL",
      phone: "(813) 555-0100",
      url: "https://www.google.com/maps?cid=1234567890",
      domain: "intheshadeflorida.com",
      logo: "https://example.com/logo.png",
    });
    const merged = mergeCitationRecordWithDfsPartials(emptyRec(), partial);
    expect(merged.businessName).toBe("In The Shade");
    expect(merged.address).toContain("Tampa");
    expect(merged.phone).toContain("813");
    expect(merged.gmbUrl).toContain("google.com/maps");
    expect(merged.websiteUrl).toContain("intheshadeflorida.com");
    expect(merged.logoWide).toContain("logo.png");
  });

  it("parses work_hours.timetable into hour fields", () => {
    const partial = citationPartialFromGoogleBusinessItem({
      type: "google_business_info",
      title: "Test",
      work_hours: {
        timetable: {
          monday: [
            {
              open: { hour: 9, minute: 0 },
              close: { hour: 17, minute: 0 },
            },
          ],
        },
      },
    });
    expect(partial.hourMonday).toMatch(/09:00-17:00/);
  });

  it("does not overwrite model-filled fields", () => {
    const base = emptyRec();
    base.businessName = "From model";
    const partial = citationPartialFromGoogleBusinessItem({
      type: "google_business_info",
      title: "From DFS",
      phone: "111",
    });
    const merged = mergeCitationRecordWithDfsPartials(base, partial);
    expect(merged.businessName).toBe("From model");
    expect(merged.phone).toBe("111");
  });

  it("applySerpSocialOverridesFromDfs sets social URLs from DFS site: SERP and overrides prior values", () => {
    const base = emptyRec();
    base.linkedinUrl = "https://www.linkedin.com/company/old";
    base.instagramUrl = "";
    base.facebookUrl = "";
    const out = applySerpSocialOverridesFromDfs(base, {
      linkedinUrl: "https://www.linkedin.com/company/acme",
      instagramUrl: "https://www.instagram.com/acme/",
      facebookUrl: "",
    });
    expect(out.linkedinUrl).toBe("https://www.linkedin.com/company/acme");
    expect(out.instagramUrl).toBe("https://www.instagram.com/acme/");
    expect(out.facebookUrl).toBe("");
  });
});
