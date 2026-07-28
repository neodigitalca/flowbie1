import { describe, expect, it } from "vitest";
import {
  hasOverviewContentDetailsActivity,
  overviewContentDetailsCanOpen,
} from "@/components/overview/overview-tab/OverviewContentDetailsPanel";

describe("overviewContentDetailsCanOpen", () => {
  const site = { id: "1" } as { id: string };

  it("returns false without site", () => {
    expect(overviewContentDetailsCanOpen(null, {}, undefined)).toBe(false);
  });

  it("returns false when only rows exist (no active run)", () => {
    expect(overviewContentDetailsCanOpen(site, {}, undefined)).toBe(false);
  });

  it("returns true when bulk slice is in progress", () => {
    expect(
      overviewContentDetailsCanOpen(site, { scrape: { total: 10, completed: 2 } }, undefined),
    ).toBe(true);
  });

  it("returns false when bulk slice is finished", () => {
    expect(
      overviewContentDetailsCanOpen(site, { scrape: { total: 10, completed: 10 } }, undefined),
    ).toBe(false);
  });

  it("returns true when batch has urls", () => {
    expect(
      overviewContentDetailsCanOpen(
        site,
        {},
        { urls: ["https://example.com/a"], urlStatuses: {} } as never,
      ),
    ).toBe(true);
  });
});

describe("hasOverviewContentDetailsActivity", () => {
  it("detects active slice vs completed slice", () => {
    expect(hasOverviewContentDetailsActivity({ contentKw: { total: 5, completed: 3 } }, undefined)).toBe(
      true,
    );
    expect(hasOverviewContentDetailsActivity({ contentKw: { total: 5, completed: 5 } }, undefined)).toBe(
      false,
    );
  });
});
