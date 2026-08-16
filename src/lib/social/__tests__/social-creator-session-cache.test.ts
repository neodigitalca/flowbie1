import { beforeEach, describe, expect, it } from "vitest";
import {
  clearSocialCreatorSessionCache,
  getSocialCreatorSessionCache,
  setSocialCreatorSessionCache,
} from "@/lib/social/social-creator-session-cache";
import { createIdleSocialCreatorRow, type SocialCreatorRow } from "@/lib/social/social-creator-types";
import { syncSocialCreatorRowsToCount } from "@/lib/social/sync-social-creator-rows";

const SITE_ID = "test-site-social-creator";

function sampleRow(overrides: Partial<SocialCreatorRow> = {}): SocialCreatorRow {
  return {
    ...createIdleSocialCreatorRow(),
    focusKeyword: "edmonton seo",
    fbInstagramContent: "Hook line\n#Seo #Local",
    status: "ready",
    createdAt: "2026-08-12T00:00:00.000Z",
    ...overrides,
  };
}

describe("syncSocialCreatorRowsToCount", () => {
  it("pads idle rows to target count", () => {
    const rows = syncSocialCreatorRowsToCount([sampleRow()], 3);
    expect(rows).toHaveLength(3);
    expect(rows[0]?.focusKeyword).toBe("edmonton seo");
    expect(rows[1]?.status).toBe("idle");
  });

  it("trims trailing idle rows without content", () => {
    const rows = syncSocialCreatorRowsToCount(
      [sampleRow(), createIdleSocialCreatorRow(), createIdleSocialCreatorRow()],
      1,
    );
    expect(rows).toHaveLength(1);
  });
});

describe("social-creator session cache", () => {
  beforeEach(() => {
    clearSocialCreatorSessionCache(SITE_ID);
  });

  it("stores and reads rows from memory cache", () => {
    const rows = [sampleRow({ id: "social-creator-test-1" })];
    setSocialCreatorSessionCache(SITE_ID, rows);
    const restored = getSocialCreatorSessionCache(SITE_ID);
    expect(restored?.[0]?.id).toBe("social-creator-test-1");
    expect(restored?.[0]?.fbInstagramContent).toContain("#Seo");
  });

  it("normalizes generating status to idle on read", () => {
    setSocialCreatorSessionCache(SITE_ID, [sampleRow({ status: "generating" })]);
    const restored = getSocialCreatorSessionCache(SITE_ID);
    expect(restored?.[0]?.status).toBe("idle");
  });
});
