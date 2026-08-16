import { describe, expect, it } from "vitest";
import {
  applyManualContentCalendarTools,
  assignContentCalendarLandingPages,
} from "@/lib/social/content-creator-manual-tools";
import { createIdleContentCalendarRow } from "@/lib/social/content-creator-types";

describe("assignContentCalendarLandingPages", () => {
  it("round-robin assigns landing pages for pages source", () => {
    const rows = assignContentCalendarLandingPages(
      [createIdleContentCalendarRow(), createIdleContentCalendarRow()],
      [
        { url: "https://example.com/a", title: "A" },
        { url: "https://example.com/b", title: "B" },
      ],
      "pages",
    );
    expect(rows[0]?.landingPageUrl).toBe("https://example.com/a");
    expect(rows[1]?.landingPageUrl).toBe("https://example.com/b");
  });

  it("random assigns from the pool", () => {
    const rows = assignContentCalendarLandingPages(
      [createIdleContentCalendarRow()],
      [
        { url: "https://example.com/a", title: "A" },
        { url: "https://example.com/b", title: "B" },
      ],
      "random",
    );
    expect(["https://example.com/a", "https://example.com/b"]).toContain(rows[0]?.landingPageUrl);
  });
});

describe("applyManualContentCalendarTools", () => {
  it("assigns landing pages without auto schedule or events", () => {
    const rows = applyManualContentCalendarTools(
      [createIdleContentCalendarRow(), createIdleContentCalendarRow()],
      {
        landingPages: [{ url: "https://example.com/blog/a", title: "A" }],
        landingPageSource: "posts",
      },
    );
    expect(rows[0]?.date).toBeUndefined();
    expect(rows[0]?.dayOfWeek).toBeUndefined();
    expect(rows[0]?.events).toBeUndefined();
    expect(rows[0]?.landingPageUrl).toBe("https://example.com/blog/a");
  });

  it("replaces excluded careers landing pages", () => {
    const rows = applyManualContentCalendarTools(
      [
        {
          ...createIdleContentCalendarRow(),
          landingPageUrl: "https://neodigital.ca/careers/",
        },
      ],
      {
        landingPages: [{ url: "https://neodigital.ca/website-design/", title: "Website Design" }],
        landingPageSource: "pages",
      },
    );
    expect(rows[0]?.landingPageUrl).toBe("https://neodigital.ca/website-design/");
  });

  it("preserves user-provided events and imported dates", () => {
    const rows = applyManualContentCalendarTools(
      [
        {
          ...createIdleContentCalendarRow(),
          events: "Site launch promo",
          date: "8/12/2026",
          dayOfWeek: "Wednesday",
        },
      ],
      {
        landingPages: [],
        landingPageSource: "random",
      },
    );
    expect(rows[0]?.events).toBe("Site launch promo");
    expect(rows[0]?.date).toBe("8/12/2026");
    expect(rows[0]?.dayOfWeek).toBe("Wednesday");
  });
});
