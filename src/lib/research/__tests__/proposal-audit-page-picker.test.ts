import { describe, expect, it } from "vitest";
import { PROPOSAL_AUDIT_PAGE_LIMIT } from "@/lib/research/proposal-audit-page-picker";

/** Test dedupe/cap via internal behavior: pick with seed only returns homepage. */
import { pickProposalAuditPages } from "@/lib/research/proposal-audit-page-picker";

describe("proposal-audit-page-picker", () => {
  it("caps at PROPOSAL_AUDIT_PAGE_LIMIT for seed-only temp mode", async () => {
    const urls = await pickProposalAuditPages({
      seedUrl: "https://example.com",
      site: null,
    });
    expect(urls.length).toBeLessThanOrEqual(PROPOSAL_AUDIT_PAGE_LIMIT);
    expect(urls[0]).toMatch(/^https:\/\/example\.com\/?$/i);
  });

  it("dedupes and keeps same-origin URLs", async () => {
    const urls = await pickProposalAuditPages({
      seedUrl: "https://www.client.com",
      site: null,
    });
    const origins = new Set(urls.map((u) => new URL(u).origin));
    expect(origins.size).toBe(1);
  });
});
